import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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

describe("crmSyncContract over this CLI's store", () => {
  for (const { name, run } of crmSyncContract(async () => {
    const store = await openStore({ path: join(mkdtempSync(join(tmpdir(), "crm-sync-")), "store.db") })
    stores.push(store)
    return { store, account: { provider: String(SOURCE?.provider), account: "example.test" } }
  }))
    it(name, run)
})
