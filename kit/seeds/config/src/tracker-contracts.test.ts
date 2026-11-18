import { memoryKeyring } from "@wirecat/cli-base"
import { parseTrackerManifest } from "@wirecat/cli-core/tracker"
import {
  type TrackerManifestFake,
  trackerManifestFixture,
  trackerSourceContract,
} from "@wirecat/cli-core/tracker/testing"
import { afterEach, describe, expect, it } from "vitest"
import { API } from "./config.js"
import { definitions } from "./generated/definitions.js"
import { HOOK_OPTIONS, SOURCE } from "./generated/wirecat-config.js"
import { FAKE_API_TOKEN, fakeServiceApi } from "./testing/fake-api.js"
import { runCli } from "./testing/harness.js"

const fakes: TrackerManifestFake[] = []

afterEach(() => {
  // A call the fake refused is one the schema or the tracker would refuse: the source would fail on the real service.
  expect(fakes.splice(0).flatMap((fake) => fake.refusals)).toEqual([])
})

describe("trackerSourceContract over a fake of the API, from wirecat.config.ts", () => {
  for (const { name, run } of trackerSourceContract(() => {
    const fixture = trackerManifestFixture(SOURCE, { api: API.manifest, definitions, ...HOOK_OPTIONS })
    fakes.push(fixture.fake)
    return fixture
  }))
    it(name, run)
})

it("the source in wirecat.config.ts reads only what the generated API offers and selects", () => {
  expect(() => parseTrackerManifest(SOURCE, API.manifest)).not.toThrow()
})

// The fake answers a sample of each selection, so this checks the calls, not the mapping of real rows.
it("sync through this CLI sends only calls the schema allows, under the account session start checked", async () => {
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
  // A kind that failed is a partial answer with exit 0: its error is on its row, and a typo in a variable fails
  // every kind before anything is sent.
  const answer = synced.json() as { meta?: { issues?: unknown[] }; item: { synced: { error?: string }[] } }
  expect(answer.meta?.issues ?? []).toEqual([])
  expect(answer.item.synced.filter((one) => one.error)).toEqual([])
  const listed = await runCli(["personal", "issues", "list", "--json"], { keyring, service: fake })
  expect(listed.code, listed.err).toBe(0)
  expect(fake.refusals).toEqual([])
})

// Its own profile: the account another test signed in to stays remembered for this file.
it("sync before session start says to sign in, and after it --offline sends nothing", async () => {
  const keyring = memoryKeyring()
  const fake = fakeServiceApi()
  const unsigned = await runCli(["work", "sync", "--json"], { keyring, service: fake })
  expect(unsigned.json()).toMatchObject({ error: { code: "authentication_error" } })
  expect(unsigned.err).toContain("session start")
  await runCli(["work", "session", "start", "--json"], { keyring, service: fake, stdin: FAKE_API_TOKEN })
  const sent = fake.calls.length
  const offline = await runCli(["work", "sync", "--offline", "--json"], { keyring, service: fake })
  expect(JSON.stringify(offline.json())).toContain("offline.refused")
  expect(fake.calls.length).toBe(sent)
})
