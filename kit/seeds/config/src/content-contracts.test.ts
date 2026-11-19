import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { memoryKeyring } from "@wirecat/cli-base"
import { contentSourceFromManifest, contentWriterFromManifest } from "@wirecat/cli-core/content"
import {
  type ContentManifestFake,
  contentManifestFake,
  contentSourceContract,
  contentSyncContract,
  contentWriteContract,
} from "@wirecat/cli-core/content/testing"
import { type MessageStore, openStore } from "@wirecat/cli-core/store"
import { Command } from "commander"
import { afterEach, describe, expect, it } from "vitest"
import { API } from "./config.js"
import { SOURCE } from "./generated/wirecat-config.js"
import { FAKE_API_TOKEN, FAKE_SITE, fakeServiceApi } from "./testing/fake-api.js"
import { runCli } from "./testing/harness.js"

const fakes: ContentManifestFake[] = []
const stores: MessageStore[] = []

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()))
  // A call the fake refused is one the API description does not allow: the source would fail on the real service.
  expect(fakes.splice(0).flatMap((fake) => fake.refusals)).toEqual([])
})

// The service wirecat.config.ts describes, in memory: example rows in its own shape, paged as its API pages.
const service = () => {
  const fake = contentManifestFake(SOURCE, { api: API.manifest })
  fakes.push(fake)
  const source = (skew = 0) =>
    contentSourceFromManifest(SOURCE, {
      api: API.manifest,
      call: fake.call,
      site: FAKE_SITE,
      now: () => Date.now() + skew,
    })
  return { fake, source }
}

describe("contentSourceContract over a fake of the API, from wirecat.config.ts", () => {
  for (const { name, run } of contentSourceContract(() => {
    const { fake, source } = service()
    const [changed, trashed, removed] = fake.ids("post")
    return {
      source: source(),
      held: { author: fake.ids("author"), term: fake.ids("term"), post: fake.ids("post") },
      deadCursor: { kind: "post", cursor: "not a time" },
      faults: {
        skewed: source,
        change: () => {
          fake.touch("post", changed as string)
          return { kind: "post", id: changed as string }
        },
        trash: () => {
          fake.trash(trashed as string)
          return trashed as string
        },
        remove: () => {
          fake.remove("post", removed as string)
          return { kind: "post", id: removed as string }
        },
      },
    }
  }))
    it(name, run)
})

describe("contentSyncContract over a store", () => {
  for (const { name, run } of contentSyncContract(async () => {
    const store = await openStore({ path: join(mkdtempSync(join(tmpdir(), "content-sync-")), "store.db") })
    stores.push(store)
    return { store, account: { provider: String(SOURCE.provider), account: `${FAKE_SITE}:1` } }
  }))
    it(name, run)
})

describe("contentWriteContract over the same fake", () => {
  for (const { name, run } of contentWriteContract(() => {
    const { fake, source } = service()
    return {
      writer: contentWriterFromManifest(SOURCE, {
        api: API.manifest,
        write: fake.write,
        command: new Command("write"),
        source: source(),
      }),
      loseNextAnswer: () => fake.loseNextAnswer(),
      requests: () => fake.writes.length,
      changeElsewhere: (id) => fake.touch("post", id),
    }
  }))
    it(name, run)
})

// session start checks the password with fakeServiceApi; the content commands then read and write the fake service.
const [login, password] = FAKE_API_TOKEN.split(":") as [string, string]

it("sync keeps the site's posts under the account session start checked, and a post update goes to the site", async () => {
  const keyring = memoryKeyring()
  const started = await runCli(["personal", "session", "start", "--site", FAKE_SITE, "--login", login, "--json"], {
    keyring,
    service: fakeServiceApi(),
    stdin: password,
  })
  expect(started.code, started.err).toBe(0)
  const { fake } = service()
  const synced = await runCli(["personal", "sync", "--json"], { keyring, service: fake })
  expect(synced.code, synced.err).toBe(0)
  expect(synced.json().item).toMatchObject({ state: "complete" })
  const listed = await runCli(["personal", "posts", "list", "--json"], { keyring, service: fake })
  const ids = (listed.json() as { items: { external_id: string }[] }).items.map((one) => one.external_id)
  expect(ids.sort()).toEqual(fake.ids("post").sort())
  const [first] = fake.ids("post")
  const updated = await runCli(
    ["personal", "posts", "update", first as string, "--title", "Renamed", "--yes", "--json"],
    {
      keyring,
      service: fake,
    },
  )
  expect(updated.code, updated.err).toBe(0)
  expect(fake.writes).toHaveLength(1)
})

it("sync before session start says to sign in, and sends nothing", async () => {
  const { fake } = service()
  const sent: string[] = []
  const counted = {
    fetch: (input: string | URL | Request, init?: RequestInit) => {
      sent.push(String(input instanceof Request ? input.url : input))
      return fake.fetch(input, init)
    },
  }
  const unsigned = await runCli(["work", "sync", "--json"], { keyring: memoryKeyring(), service: counted })
  expect(unsigned.json()).toMatchObject({ error: { code: "authentication_error" } })
  expect(sent).toEqual([])
})
