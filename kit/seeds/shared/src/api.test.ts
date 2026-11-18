import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fakeApi, sampleOf } from "@wirecat/cli-base/codegen"
import { apiFlagOf, manifestBaseUrl, type ServiceApiManifest, sendsBytes } from "@wirecat/cli-core/cli"
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

// A spec without sign-in, such as PokeAPI's, gives the manifest no securitySchemes.
const { security, securitySchemes }: ServiceApiManifest = API.manifest

// The fake checks each call's path, parameters and body, and the token where its security, else the spec's, names it.
const fake = () =>
  fakeApi({
    operations: API.manifest.operations,
    definitions,
    baseUrl: manifestBaseUrl(API.manifest),
    ...(security ? { security } : {}),
    ...(securitySchemes ? { securitySchemes } : {}),
    token: FAKE_TOKEN,
  })

const deleteKeys = [
  ...new Set(
    API.manifest.operations.flatMap((operation) =>
      (operation.permissions ?? []).map((permission) => permission.key).filter((key) => key.endsWith(".delete")),
    ),
  ),
]

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
