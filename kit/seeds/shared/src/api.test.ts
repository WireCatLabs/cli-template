import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fakeApi } from "@wirecat/cli-base/codegen"
import { afterEach, expect, it } from "vitest"
import { API_URL } from "./commands/api.js"
import { definitions } from "./generated/definitions.js"
import { operations } from "./generated/manifest.js"
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
    operations,
    definitions,
    baseUrl: API_URL,
    auth: { header: "authorization", value: `Bearer ${FAKE_TOKEN}` },
  })

// SAMPLE: a body each writing operation accepts; the fake checks it against the spec's schema.
const BODY = '{"text":"Plan"}'

const argsOf = (operation: (typeof operations)[number]) => [
  ...operation.parameters
    .filter((one) => one.required)
    .flatMap((one) => [
      `--${one.name
        .replace(/_/g, "-")
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .toLowerCase()}`,
      "x1",
    ]),
  ...(operation.request ? ["--body", BODY] : []),
  ...(operation.effect === "destructive" ? ["--yes"] : []),
]

it("sends every operation the spec offers as the spec describes it, with the profile's token", async () => {
  withPermissions({ api: "allow", "comments.delete": "allow" })
  const service = fake()
  for (const operation of operations) {
    const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service })
    expect(ran.code, `${operation.command}: ${ran.err}`).toBe(0)
  }
  expect(service.refusals).toEqual([])
  expect(service.calls).toHaveLength(operations.length)
})

it("a delete through api checks the CLI's delete key too, before anything is sent", async () => {
  withPermissions({ api: "allow", "comments.delete": "deny" })
  const service = fake()
  const destructive = operations.filter((one) => one.effect === "destructive")
  for (const operation of destructive) {
    const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service })
    expect(ran.json()).toMatchObject({ error: { code: "permission_error" } })
  }
  expect(service.calls).toEqual([])
})
