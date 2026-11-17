import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { memoryKeyring } from "@wirecat/cli-base"
import { parseCrmManifest } from "@wirecat/cli-core/crm"
import {
  type CrmManifestFake,
  crmManifestFixture,
  crmSourceContract,
  crmSyncContract,
} from "@wirecat/cli-core/crm/testing"
import { type MessageStore, openStore } from "@wirecat/cli-core/store"
import { afterEach, describe, expect, it } from "vitest"
import { API } from "./config.js"
import { definitions } from "./generated/definitions.js"
import { HOOKS, SOURCE } from "./generated/wirecat-config.js"
import { FAKE_API_TOKEN, fakeServiceApi } from "./testing/fake-api.js"
import { runCli } from "./testing/harness.js"

const manifest = parseCrmManifest(SOURCE, API.manifest)
const fakes: CrmManifestFake[] = []
const stores: MessageStore[] = []

afterEach(async () => {
  // A call the fake refused is one the API description does not allow: the source would fail on the real service.
  expect(fakes.splice(0).flatMap((fake) => fake.refusals)).toEqual([])
  await Promise.all(stores.splice(0).map((store) => store.close()))
})

describe("crmSourceContract over a fake of the API, from wirecat.config.ts", () => {
  for (const { name, run } of crmSourceContract(() => {
    const fixture = crmManifestFixture(manifest, { api: API.manifest, definitions, ...(HOOKS ? { hooks: HOOKS } : {}) })
    fakes.push(fixture.fake)
    return fixture
  }))
    it(name, run)
})

describe("crmSyncContract over a store", () => {
  for (const { name, run } of crmSyncContract(async () => {
    const store = await openStore({ path: join(mkdtempSync(join(tmpdir(), "crm-sync-")), "store.db") })
    stores.push(store)
    return { store, account: { provider: String(SOURCE?.provider), account: "example.test" } }
  }))
    it(name, run)
})

it("sync through this CLI keeps the rows under the account session start checked", async () => {
  const keyring = memoryKeyring()
  const fake = fakeServiceApi()
  const started = await runCli(["personal", "session", "start", "--json"], {
    keyring,
    service: fake,
    stdin: FAKE_API_TOKEN,
  })
  expect(started.code, started.err).toBe(0)
  const synced = await runCli(["personal", "sync", "--json"], { keyring, service: fake })
  expect(synced.code, synced.err).toBe(0)
  const status = await runCli(["personal", "store", "status", "--json"], { keyring, service: fake })
  expect(status.code, status.err).toBe(0)
  expect(fake.refusals).toEqual([])
})
