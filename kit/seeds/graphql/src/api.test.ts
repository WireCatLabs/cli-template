import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { graphqlFake, type SchemaNode, sampleOf } from "@wirecat/cli-base/codegen"
import { apiFlagOf, manifestBaseUrl, sendsBytes } from "@wirecat/cli-core/cli"
import { pacePathFor } from "@wirecat/cli-core/sends"
import { afterEach, expect, it } from "vitest"
import { API } from "./config.js"
import { definitions } from "./generated/definitions.js"
import { IDENTITY } from "./identity.js"
import { FAKE_TOKEN } from "./testing/fake-comments.js"
import { runCli } from "./testing/harness.js"

const configFile = join(process.env.CLIDEV_CONFIG_DIR ?? "", "config.json")
const upload = join(process.env.CLIDEV_CONFIG_DIR ?? "", "..", "upload.bin")
const withPermissions = (permissions: Record<string, string>) => {
  mkdirSync(join(configFile, ".."), { recursive: true })
  writeFileSync(configFile, JSON.stringify({ profiles: { personal: { permissions } } }))
}
// Every case shares the profile's pace file, and a few hundred operations would wait for real past its burst.
afterEach(() => {
  rmSync(configFile, { force: true })
  rmSync(upload, { force: true })
  rmSync(pacePathFor(IDENTITY, "personal", process.env), { force: true })
})

type Operation = (typeof API.manifest.operations)[number]

// The fake checks each call's document against the schema (the operation, the selection, the variables) and the key.
const fake = () =>
  graphqlFake({
    operations: API.manifest.operations,
    definitions,
    url: manifestBaseUrl(API.manifest),
    auth: { header: "Authorization", value: FAKE_TOKEN },
  })

const deleteKeys = [
  ...new Set(
    API.manifest.operations.flatMap((operation) =>
      (operation.permissions ?? []).map((permission) => permission.key).filter((key) => key.endsWith(".delete")),
    ),
  ),
]

// What an operation requires, plus its optional fields that hold a plain value. GraphQL inputs nest in each other
// (Linear's IssueFilter reaches TeamFilter and back), so sampling every optional object grows past memory and past
// what one argument can hold.
const NESTED = new Set(["ref", "object", "array", "union", "allOf"])
const requiredSample = (node: SchemaNode, seen: ReadonlySet<string> = new Set()): unknown => {
  if (node.type === "ref") {
    const target = definitions[node.ref as keyof typeof definitions] as SchemaNode | undefined
    return target && !seen.has(node.ref) ? requiredSample(target, new Set([...seen, node.ref])) : null
  }
  if (node.type === "object")
    return Object.fromEntries(
      Object.entries(node.properties)
        .filter(([name, property]) => node.required.includes(name) || !NESTED.has(property.type))
        .map(([name, property]) => [name, requiredSample(property, seen)]),
    )
  if (node.type === "array") {
    const item = requiredSample(node.items, seen)
    return item === null ? [] : Array.from({ length: Math.max(node.minItems ?? 1, 1) }, () => item)
  }
  return sampleOf(node, definitions)
}

const flagValue = (value: unknown) => (typeof value === "object" ? JSON.stringify(value) : String(value))

const bodyFileOf = (operation: Operation) => {
  const path = join(upload, "..", `${operation.command}.json`)
  writeFileSync(path, JSON.stringify(requiredSample({ type: "ref", ref: String(operation.request?.schema) })))
  return path
}

const argsOf = (operation: Operation) => [
  // Every variable as its flag, so each flag is driven once; an optional input object goes as its required part.
  ...operation.parameters.flatMap((parameter) => [
    `--${apiFlagOf(parameter.name)}`,
    flagValue(requiredSample(parameter.schema)),
  ]),
  ...(sendsBytes(operation) ? ["--body-file", upload] : []),
  ...(operation.request?.schema
    ? ["--body", JSON.stringify(requiredSample({ type: "ref", ref: operation.request.schema }))]
    : []),
  ...(operation.effect === "destructive" ? ["--yes"] : []),
]

it("the spec offers operations", () => {
  expect(API.manifest.operations.length).toBeGreaterThan(0)
})

it("api show describes an operation from the generated files, without calling the service", async () => {
  const [operation] = API.manifest.operations
  const service = fake()
  const shown = await runCli(["personal", "api", "show", String(operation?.command), "--json"], { service })
  expect(shown.code, shown.err).toBe(0)
  expect(shown.json().item).toMatchObject({ operation: { id: operation?.id } })
  expect(service.calls).toEqual([])
})

// One test each, so a large API stays inside the per-test timeout and a failure names its operation.
it.each(API.manifest.operations.map((operation) => [operation.command, operation] as const))(
  "sends %s as the spec describes it",
  async (_, operation) => {
    writeFileSync(upload, new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    withPermissions({ api: "allow", ...Object.fromEntries(deleteKeys.map((key) => [key, "allow"])) })
    const service = fake()
    const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service })
    expect(ran.code, ran.err).toBe(0)
    expect(service.refusals).toEqual([])
    expect(service.calls).toHaveLength(1)
    if (operation.request?.schema) {
      // The body file alone: with the variables also given as flags, an ignored file would still send them.
      const bodyFile = bodyFileOf(operation)
      const fromFile = await runCli(
        [
          "personal",
          "api",
          operation.command,
          "--body-file",
          bodyFile,
          ...(operation.effect === "destructive" ? ["--yes"] : []),
          "--json",
        ],
        { service },
      )
      expect(fromFile.code, fromFile.err).toBe(0)
      expect(service.calls[1]?.variables).toEqual(JSON.parse(readFileSync(bodyFile, "utf8")))
    }
    if (!operation.pagination) return
    // The fake's sample of pageInfo says no next page, so --all sends one more call and ends.
    const before = service.calls.length
    const all = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--all", "--json"], {
      service,
    })
    expect(all.code, all.err).toBe(0)
    expect(service.calls).toHaveLength(before + 1)
    expect(service.calls.at(-1)?.operation).toBe(operation.id)
    expect(service.refusals).toEqual([])
  },
)

const destructive = API.manifest.operations.filter((operation) => operation.effect === "destructive")

// A service whose API only reads has no delete to check.
it.runIf(destructive.length > 0)(
  "a delete through api checks the manifest's delete key too, before anything is sent",
  async () => {
    expect(deleteKeys.length).toBeGreaterThan(0)
    withPermissions({ api: "allow", ...Object.fromEntries(deleteKeys.map((key) => [key, "deny"])) })
    const service = fake()
    for (const operation of destructive) {
      const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service })
      expect(ran.json()).toMatchObject({ error: { code: "permission_error" } })
    }
    expect(service.calls).toEqual([])
  },
)
