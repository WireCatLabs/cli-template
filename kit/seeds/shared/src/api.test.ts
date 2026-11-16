import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fakeApi, sampleOf } from "@wirecat/cli-base/codegen"
import { apiFlagOf, manifestBaseUrl } from "@wirecat/cli-core/cli"
import { afterEach, expect, it } from "vitest"
import { API } from "./config.js"
import { definitions } from "./generated/definitions.js"
import { FAKE_TOKEN } from "./testing/fake-comments.js"
import { runCli } from "./testing/harness.js"

const configFile = join(process.env.CLIDEV_CONFIG_DIR ?? "", "config.json")
const withPermissions = (permissions: Record<string, string>) => {
  mkdirSync(join(configFile, ".."), { recursive: true })
  writeFileSync(configFile, JSON.stringify({ profiles: { personal: { permissions } } }))
}
afterEach(() => rmSync(configFile, { force: true }))

const fake = () =>
  fakeApi({
    operations: API.manifest.operations,
    definitions,
    baseUrl: manifestBaseUrl(API.manifest),
    // SAMPLE: the header the spec's sign-in names; an `apiKey` scheme sends the bare token in its own header.
    auth: { header: "authorization", value: `Bearer ${FAKE_TOKEN}` },
  })

type Operation = (typeof API.manifest.operations)[number]

const deleteKeys = [
  ...new Set(
    API.manifest.operations.flatMap((operation) =>
      (operation.permissions ?? []).map((permission) => permission.key).filter((key) => key.endsWith(".delete")),
    ),
  ),
]

const argsOf = (operation: Operation) => [
  ...operation.parameters
    .filter((parameter) => parameter.required)
    .flatMap((parameter) => [`--${apiFlagOf(parameter.name)}`, String(sampleOf(parameter.schema, definitions))]),
  ...(operation.request?.schema
    ? ["--body", JSON.stringify(sampleOf({ type: "ref", ref: operation.request.schema }, definitions))]
    : []),
  ...(operation.effect === "destructive" ? ["--yes"] : []),
]

it("sends every operation the spec offers as the spec describes it, with the profile's token", async () => {
  withPermissions({ api: "allow", ...Object.fromEntries(deleteKeys.map((key) => [key, "allow"])) })
  const service = fake()
  expect(API.manifest.operations.length).toBeGreaterThan(0)
  for (const operation of API.manifest.operations) {
    const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service })
    expect(ran.code, `${operation.command}: ${ran.err}`).toBe(0)
  }
  expect(service.refusals).toEqual([])
  expect(service.calls).toHaveLength(API.manifest.operations.length)
})

it("a delete through api checks the manifest's delete key too, before anything is sent", async () => {
  expect(deleteKeys.length).toBeGreaterThan(0)
  withPermissions({ api: "allow", ...Object.fromEntries(deleteKeys.map((key) => [key, "deny"])) })
  const service = fake()
  const destructive = API.manifest.operations.filter((operation) => operation.effect === "destructive")
  expect(destructive.length).toBeGreaterThan(0)
  for (const operation of destructive) {
    const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service })
    expect(ran.json()).toMatchObject({ error: { code: "permission_error" } })
  }
  expect(service.calls).toEqual([])
})
