import { memoryKeyring } from "@wirecat/cli-base"
import { recalledAccount } from "@wirecat/cli-core/cli"
import { expect, it } from "vitest"
import { VERIFY } from "../generated/wirecat-config.js"
import { IDENTITY } from "../identity.js"
import { FAKE_API_TOKEN, fakeServiceApi } from "../testing/fake-api.js"
import { runCli } from "../testing/harness.js"

// fakeServiceApi answers the call auth.verify names with a sample of its answer schema, and only for FAKE_API_TOKEN.
it("session start checks the token with the call auth.verify names and remembers the account; status and end", async () => {
  const keyring = memoryKeyring()
  const fake = fakeServiceApi()
  const started = await runCli(["personal", "session", "start", "--json"], {
    keyring,
    service: fake,
    stdin: FAKE_API_TOKEN,
  })
  expect(started.code, started.err).toBe(0)
  expect(fake.calls.map((call) => call.operation)).toEqual([VERIFY?.operation])
  expect(fake.refusals).toEqual([])
  const { id } = started.json().item as { id: string }
  expect(id).toEqual(expect.any(String))
  expect(recalledAccount(IDENTITY, "any", "personal", process.env)?.account).toBe(id)
  const status = await runCli(["personal", "session", "status", "--check", "--json"], { keyring, service: fake })
  expect(status.json().item).toMatchObject({ state: "saved", token_from: "keyring", verified: true })
  expect((await runCli(["personal", "session", "end", "--json"], { keyring })).code).toBe(0)
  const ended = await runCli(["personal", "session", "status", "--json"], { keyring })
  expect(ended.json().item).toMatchObject({ state: "missing" })
})

it("session start keeps nothing when the service refuses the token", async () => {
  const keyring = memoryKeyring()
  const refused = await runCli(["personal", "session", "start", "--json"], {
    keyring,
    service: fakeServiceApi(),
    stdin: "wrong0token",
  })
  expect(refused.json()).toMatchObject({ error: { code: "authentication_error" } })
  const status = await runCli(["personal", "session", "status", "--json"], { keyring })
  expect(status.json().item).toMatchObject({ state: "missing" })
})
