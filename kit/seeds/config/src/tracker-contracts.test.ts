import { memoryKeyring } from "@wirecat/cli-base"
import { parseTrackerManifest } from "@wirecat/cli-core/tracker"
import { expect, it } from "vitest"
import { API } from "./config.js"
import { SOURCE } from "./generated/wirecat-config.js"
import { FAKE_API_TOKEN, fakeServiceApi } from "./testing/fake-api.js"
import { runCli } from "./testing/harness.js"

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
  // A kind that failed is a partial answer with exit 0: its issues name it.
  expect(synced.json().issues ?? []).toEqual([])
  const listed = await runCli(["personal", "issues", "list", "--json"], { keyring, service: fake })
  expect(listed.code, listed.err).toBe(0)
  expect(fake.refusals).toEqual([])
})
