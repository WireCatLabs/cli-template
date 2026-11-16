import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fakeApi, sampleOf } from "@wirecat/cli-base/codegen"
import { apiFlagOf } from "@wirecat/cli-core/cli"
import { afterEach, expect, it } from "vitest"
import { API_URL } from "./commands/api.js"
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
    operations: API.operations,
    definitions,
    baseUrl: API_URL,
    auth: { header: "authorization", value: `Bearer ${FAKE_TOKEN}` },
  })

type Operation = (typeof API.operations)[number]

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
  withPermissions({ api: "allow", [API.deleteKey]: "allow" })
  const service = fake()
  expect(API.operations.length).toBeGreaterThan(0)
  for (const operation of API.operations) {
    const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service })
    expect(ran.code, `${operation.command}: ${ran.err}`).toBe(0)
  }
  expect(service.refusals).toEqual([])
  expect(service.calls).toHaveLength(API.operations.length)
})

it("a delete through api checks the CLI's delete key too, before anything is sent", async () => {
  withPermissions({ api: "allow", [API.deleteKey]: "deny" })
  const service = fake()
  const destructive = API.operations.filter((operation) => operation.effect === "destructive")
  expect(destructive.length).toBeGreaterThan(0)
  for (const operation of destructive) {
    const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service })
    expect(ran.json()).toMatchObject({ error: { code: "permission_error" } })
  }
  expect(service.calls).toEqual([])
})
