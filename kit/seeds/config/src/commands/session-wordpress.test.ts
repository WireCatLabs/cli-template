import { memoryKeyring } from "@wirecat/cli-base"
import { recalledAccount } from "@wirecat/cli-core/cli"
import { expect, it } from "vitest"
import { VERIFY } from "../generated/wirecat-config.js"
import { IDENTITY } from "../identity.js"
import { FAKE_API_TOKEN, FAKE_SITE, fakeServiceApi } from "../testing/fake-api.js"
import { runCli } from "../testing/harness.js"

// fakeServiceApi answers the call auth.verify names with a sample of its answer schema, at FAKE_SITE, and only for
// FAKE_API_TOKEN: the user name and the application password.
const [login, password] = FAKE_API_TOKEN.split(":") as [string, string]
const site = ["--site", FAKE_SITE, "--login", login]
it("session start checks the token with the call auth.verify names and remembers the account; status and end", async () => {
  const keyring = memoryKeyring()
  const fake = fakeServiceApi()
  const started = await runCli(["personal", "session", "start", ...site, "--json"], {
    keyring,
    service: fake,
    stdin: password,
  })
  expect(started.code, started.err).toBe(0)
  expect(fake.calls.map((call) => call.operation)).toEqual([VERIFY.operation])
  expect(fake.refusals).toEqual([])
  const { id } = started.json().item as { id: string }
  expect(id).toEqual(expect.any(String))
  // Each site numbers its users from 1: the account names the site too.
  expect(recalledAccount(IDENTITY, "any", "personal", process.env)?.account).toBe(`${FAKE_SITE}:${id}`)
  const status = await runCli(["personal", "session", "status", "--check", "--json"], { keyring, service: fake })
  expect(status.json().item).toMatchObject({ state: "saved", token_from: "keyring", verified: true, site: FAKE_SITE })
  expect((await runCli(["personal", "session", "end", "--json"], { keyring })).code).toBe(0)
  const ended = await runCli(["personal", "session", "status", "--json"], { keyring })
  expect(ended.json().item).toMatchObject({ state: "missing" })
})

it("session start keeps nothing when the site refuses the password, or names no site", async () => {
  const keyring = memoryKeyring()
  const unsited = await runCli(["personal", "session", "start", "--login", login, "--json"], {
    keyring,
    stdin: password,
  })
  expect(unsited.err).toContain('"code":"validation_error"')
  const refused = await runCli(["personal", "session", "start", ...site, "--json"], {
    keyring,
    service: fakeServiceApi(),
    stdin: "wrong0password",
  })
  expect(refused.err).toContain('"code":"authentication_error"')
  const status = await runCli(["personal", "session", "status", "--json"], { keyring })
  expect(status.json().item).toMatchObject({ state: "missing" })
})

it("a sign-in kept in a private file is listed among the sessions; api list names the generated operations", async () => {
  const keyring = memoryKeyring()
  const started = await runCli(["files", "session", "start", ...site, "--credential-storage", "file", "--json"], {
    keyring,
    service: fakeServiceApi(),
    stdin: password,
  })
  expect(started.code, started.err).toBe(0)
  const sessions = await runCli(["session", "list", "--json"], { keyring })
  expect(sessions.code, sessions.err).toBe(0)
  expect(sessions.json().items).toEqual(expect.arrayContaining([expect.objectContaining({ profile: "files" })]))
  const operations = await runCli(["api", "list", "--json"], { keyring })
  expect((operations.json().items as unknown[]).length).toBeGreaterThan(0)
  expect((await runCli(["files", "session", "end", "--json"], { keyring })).code).toBe(0)
})
