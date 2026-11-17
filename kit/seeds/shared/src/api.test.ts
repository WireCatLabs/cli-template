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

type Operation = (typeof API.manifest.operations)[number]

// The generated manifest has no `security` when the spec declares none at the top; then nothing is signed.
const documentSecurity = (API.manifest as { security?: Operation["security"] }).security

const fake = () =>
  fakeApi({
    // fakeApi reads only each operation's own security; the CLI falls back to the document's, as `security: []`.
    operations: API.manifest.operations.map((operation) => ({
      ...operation,
      security: operation.security ?? documentSecurity ?? [],
    })),
    definitions,
    baseUrl: manifestBaseUrl(API.manifest),
    // SAMPLE: the header the spec's sign-in names; an `apiKey` scheme sends the bare token in its own header.
    auth: { header: "authorization", value: `Bearer ${FAKE_TOKEN}` },
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
    .filter((parameter) => parameter.required)
    .flatMap((parameter) => [`--${apiFlagOf(parameter.name)}`, String(sampleOf(parameter.schema, definitions))]),
  ...(operation.request?.schema
    ? ["--body", JSON.stringify(sampleOf({ type: "ref", ref: operation.request.schema }, definitions))]
    : []),
  ...(operation.effect === "destructive" ? ["--yes"] : []),
]

it("the spec offers operations", () => {
  expect(API.manifest.operations.length).toBeGreaterThan(0)
})

// One test each, so a large API stays inside the per-test timeout and a failure names its operation.
it.each(API.manifest.operations.map((operation) => [operation.command, operation] as const))(
  "sends %s as the spec describes it, with the profile's token",
  async (_, operation) => {
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
