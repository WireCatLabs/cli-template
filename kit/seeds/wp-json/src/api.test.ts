import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fakeApi, sampleOf } from "@wirecat/cli-base/codegen"
import { apiFlagOf, manifestBaseUrl, type ServiceApiManifest, sendsBytes } from "@wirecat/cli-core/cli"
import { pacePathFor } from "@wirecat/cli-core/sends"
import { afterEach, expect, it } from "vitest"
import { API } from "./config.js"
import { definitions } from "./generated/definitions.js"
import { IDENTITY } from "./identity.js"
import { FAKE_API_TOKEN, FAKE_SITE } from "./testing/fake-api.js"
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

// A spec without sign-in, such as PokeAPI's, gives the manifest no securitySchemes.
const { security, securitySchemes }: ServiceApiManifest = API.manifest

// The fake is the profile's own site; it checks each call's path, parameters and body, and the password by Basic.
const fake = () =>
  fakeApi({
    operations: API.manifest.operations,
    definitions,
    baseUrl: manifestBaseUrl(API.manifest, undefined, { site: FAKE_SITE }),
    ...(security ? { security } : {}),
    ...(securitySchemes ? { securitySchemes } : {}),
    token: FAKE_API_TOKEN,
  })
// Signed in to the fake's site, as session start --site keeps it.
const env = { CLIDEV_TOKEN: FAKE_API_TOKEN, CLIDEV_TOKEN_SITE: FAKE_SITE }

const keys = [
  ...new Set(API.manifest.operations.flatMap((operation) => (operation.permissions ?? []).map(({ key }) => key))),
]
const deleteKeys = keys.filter((key) => key.endsWith(".delete"))

const argsOf = (operation: Operation) => [
  ...operation.parameters
    // A required parameter with a default is left out: the command sends the default itself.
    .filter((parameter) => parameter.required && parameter.schema.default === undefined)
    .flatMap((parameter) => [`--${apiFlagOf(parameter.name)}`, String(sampleOf(parameter.schema, definitions))]),
  ...(sendsBytes(operation) ? ["--body-file", upload] : []),
  ...(operation.request?.schema
    ? ["--body", JSON.stringify(sampleOf({ type: "ref", ref: operation.request.schema }, definitions))]
    : []),
  ...(operation.effect === "destructive" ? ["--yes"] : []),
]

it("the spec offers operations", () => {
  expect(API.manifest.operations.length).toBeGreaterThan(0)
})

it("api show describes an operation from the generated files, without calling the service", async () => {
  const [operation] = API.manifest.operations
  const service = fake()
  const shown = await runCli(["personal", "api", "show", String(operation?.command), "--json"], { service, env })
  expect(shown.code, shown.err).toBe(0)
  expect(shown.json().item).toMatchObject({ operation: { id: operation?.id } })
  expect(service.calls).toEqual([])
})

// One test each, so a large API stays inside the per-test timeout and a failure names its operation.
it.each(API.manifest.operations.map((operation) => [operation.command, operation] as const))(
  "sends %s as the spec describes it",
  async (_, operation) => {
    writeFileSync(upload, new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    withPermissions({ api: "allow", ...Object.fromEntries(keys.map((key) => [key, "allow"])) })
    const service = fake()
    const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service, env })
    expect(ran.code, ran.err).toBe(0)
    expect(service.refusals).toEqual([])
    expect(service.calls).toHaveLength(1)
  },
)

const destructive = API.manifest.operations.filter((operation) => operation.effect === "destructive")

// A service whose API only reads has no delete to check.
it.runIf(destructive.length > 0)(
  "a delete through api checks the manifest's delete key too, before anything is sent",
  async () => {
    expect(deleteKeys.length).toBeGreaterThan(0)
    withPermissions({
      api: "allow",
      ...Object.fromEntries(keys.map((key) => [key, "allow"])),
      ...Object.fromEntries(deleteKeys.map((key) => [key, "deny"])),
    })
    const service = fake()
    for (const operation of destructive) {
      const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service, env })
      expect(ran.json()).toMatchObject({ error: { code: "permission_error" } })
    }
    expect(service.calls).toEqual([])
  },
)

const writes = API.manifest.operations.filter((operation) =>
  (operation.permissions ?? []).some(({ key, body }) => key.endsWith(".publish") && body?.includes("date")),
)

// WordPress publishes a scheduled post whose date moves into the past, with no status in the call.
it.runIf(writes.length > 0)("a date change needs the publish key unless the call keeps a draft", async () => {
  const [operation] = writes as [Operation]
  const key = (operation.permissions ?? []).find(({ key }) => key.endsWith(".publish"))?.key as string
  withPermissions({ api: "allow", [key]: "deny" })
  const service = fake()
  const path = operation.parameters
    .filter((parameter) => parameter.in === "path")
    .flatMap((parameter) => [`--${apiFlagOf(parameter.name)}`, "1"])
  for (const body of ['{"date":"2000-01-01T00:00:00"}', '{"date":null}', '{"password":""}'])
    expect(
      (
        await runCli(["personal", "api", operation.command, ...path, "--body", body, "--json"], { service, env })
      ).json(),
    ).toMatchObject({ error: { code: "permission_error" } })
  expect(service.calls).toEqual([])
  const draft = '{"date":"2000-01-01T00:00:00","status":"draft"}'
  const kept = await runCli(["personal", "api", operation.command, ...path, "--body", draft, "--json"], {
    service,
    env,
  })
  expect(kept.code, kept.err).toBe(0)
})
