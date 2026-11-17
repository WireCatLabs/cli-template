import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { memoryKeyring } from "@wirecat/cli-base"
import { parseCrmManifest } from "@wirecat/cli-core/crm"
import {
  type CrmManifestFake,
  crmManifestFake,
  crmManifestFixture,
  crmSourceContract,
  crmSyncContract,
  FAKE_MANIFEST_TOKEN,
} from "@wirecat/cli-core/crm/testing"
import { type MessageStore, openStore } from "@wirecat/cli-core/store"
import { afterEach, describe, expect, it } from "vitest"
import { API } from "./config.js"
import { definitions } from "./generated/definitions.js"
import { HOOKS, SOURCE, VERIFY } from "./generated/wirecat-config.js"
import { fakeServiceApi } from "./testing/fake-api.js"
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

// fakeServiceApi answers every page of a list with a sample row, and an offset list ends only on an empty page: a sync
// over it reads until its budget runs out. The CRM's rows come from crmManifestFake, which pages them to their end; the
// call auth.verify names stays with fakeServiceApi, which crmManifestFake does not answer.
const signInAndCrm = (crm: CrmManifestFake) => {
  const verify = API.manifest.operations.find((one) => one.id === VERIFY?.operation)
  const path = verify?.binding.kind === "http" ? verify.binding.path : undefined
  const pattern = path ? new RegExp(`${path.replace(/\{[^}]+\}/g, "[^/]+")}$`) : undefined
  const signIn = fakeServiceApi(FAKE_MANIFEST_TOKEN)
  return {
    fetch: (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input)
      return pattern?.test(url.pathname) ? signIn.fetch(input, init) : crm.fetch(input, init)
    },
  }
}

it("sync through this CLI keeps the rows under the account session start checked", async () => {
  const keyring = memoryKeyring()
  const crm = crmManifestFake(manifest, { api: API.manifest, definitions })
  fakes.push(crm)
  const service = signInAndCrm(crm)
  const started = await runCli(["personal", "session", "start", "--json"], {
    keyring,
    service,
    stdin: FAKE_MANIFEST_TOKEN,
  })
  expect(started.code, started.err).toBe(0)
  const synced = await runCli(["personal", "sync", "--json"], { keyring, service })
  expect(synced.code, synced.err).toBe(0)
  expect(synced.json().item).toMatchObject({ complete: true })
  const status = await runCli(["personal", "store", "status", "--json"], { keyring, service })
  expect(status.code, status.err).toBe(0)
  const kinds = (status.json() as { items: { kind: string; stored: number; state: string }[] }).items
  for (const kind of manifest.kinds)
    expect(
      kinds.find((one) => one.kind === kind),
      kind,
    ).toMatchObject({
      state: "complete",
      stored: crm.rows[kind]?.length,
    })
})
