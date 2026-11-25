import { brokenKeyring, memoryKeyring } from "@wirecat/cli-base"
import { ProfileTokenStore } from "@wirecat/cli-core/cli"
import { expect, it } from "vitest"
import { IDENTITY } from "../identity.js"
import { FAKE_TOKEN, fakeComments } from "../testing/fake-comments.js"
import { runCli } from "../testing/harness.js"

it("session start reads the token from stdin and checks it before keeping it; status, list and end", async () => {
  const keyring = memoryKeyring()
  const service = fakeComments()
  const started = await runCli(["personal", "session", "start", "--json"], { keyring, service, stdin: FAKE_TOKEN })
  expect(started.json().item).toMatchObject({ verified: true, id: "u1" })
  const status = await runCli(["personal", "session", "status", "--check", "--json"], { keyring, service })
  expect(status.json().item).toMatchObject({ state: "saved", token_from: "keyring", verified: true })
  expect((await runCli(["session", "list", "--json"], { keyring })).json().items).toContainEqual(
    expect.objectContaining({ profile: "personal", signed_in: true }),
  )
  expect((await runCli(["personal", "session", "end", "--json"], { keyring })).code).toBe(0)
  const ended = await runCli(["personal", "session", "status", "--json"], { keyring })
  expect(ended.json().item).toMatchObject({ state: "missing" })
})

it("session start --credential-storage file keeps the token in a private file instead of the keyring", async () => {
  const keyring = memoryKeyring()
  const started = await runCli(["personal", "session", "start", "--credential-storage", "file", "--json"], {
    keyring,
    stdin: FAKE_TOKEN,
  })
  expect(started.json().item).toMatchObject({ stored_in: "file" })
  const status = await runCli(["personal", "session", "status", "--json"], { keyring })
  expect(status.json().item).toMatchObject({ token_from: "file" })
  expect((await runCli(["personal", "session", "end", "--json"], { keyring })).json().item).toMatchObject({
    ended: expect.arrayContaining(["file"]),
  })
})

it("session start without a working keyring keeps the token in a private file, and says so on stderr", async () => {
  const keyring = brokenKeyring()
  const started = await runCli(["personal", "session", "start", "--json"], { keyring, stdin: FAKE_TOKEN })
  expect(started.json().item).toMatchObject({ stored_in: "file" })
  expect(started.err).toContain("keyring")
  expect(new ProfileTokenStore({ app: IDENTITY, keyring }).signedIn("personal")).toBe(true)
  expect((await runCli(["personal", "session", "end", "--json"], { keyring })).code).toBe(0)
  expect(new ProfileTokenStore({ app: IDENTITY, keyring }).signedIn("personal")).toBe(false)
})

it("session start refuses a storage it does not know, before asking for the token", async () => {
  const { code, err } = await runCli(["personal", "session", "start", "--credential-storage", "vault", "--json"])
  expect(code).toBe(2)
  expect(err).toContain("--credential-storage takes keyring or file")
})

it("session start keeps nothing when the service refuses the token", async () => {
  const keyring = memoryKeyring()
  const refused = await runCli(["personal", "session", "start", "--json"], { keyring, stdin: "wrong0token" })
  expect(refused.json()).toMatchObject({ error: { code: "authentication_error" } })
  const status = await runCli(["personal", "session", "status", "--json"], { keyring })
  expect(status.json().item).toMatchObject({ state: "missing" })
})
