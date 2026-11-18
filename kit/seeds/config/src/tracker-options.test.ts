import { memoryKeyring } from "@wirecat/cli-base"
import { expect, it } from "vitest"
import { FAKE_API_TOKEN, fakeServiceApi } from "./testing/fake-api.js"
import { runCli } from "./testing/harness.js"

// The fake answers a sample of each selection, so this proves every command and option runs, not what a real row holds.
it("every option of the tracker commands runs over a synced copy", async () => {
  const keyring = memoryKeyring()
  const service = fakeServiceApi()
  const started = await runCli(["options", "session", "start", "--json"], { keyring, service, stdin: FAKE_API_TOKEN })
  expect(started.code, started.err).toBe(0)
  const ran = (argv: string[]) => runCli(["options", ...argv, "--json"], { keyring, service })
  const synced = await ran(["sync", "--rescan", "--max-pages", "50"])
  expect(synced.code, synced.err).toBe(0)
  const listed = (await ran(["issues", "list"])).json() as { items: { key?: string; id?: string; title?: string }[] }
  const [issue] = listed.items
  expect(issue).toBeDefined()
  const ref = String(issue?.key ?? issue?.id)
  const word =
    String(issue?.title ?? "")
      .split(/\W+/)
      .find((one) => one.length > 2) ?? ref
  for (const argv of [
    ["issues", "list", "--limit", "1", "--page", "1"],
    ["issues", "show", ref],
    ["issues", "search", word, "--limit", "1", "--page", "1"],
    ["issues", "assign", ref, "--due", "3d"],
    ...["projects", "teams", "users", "states", "labels"].map((group) => [
      group,
      "list",
      "--limit",
      "1",
      "--page",
      "1",
    ]),
  ]) {
    const answer = await ran(argv)
    expect(answer.code, `${argv.join(" ")}: ${answer.err}`).toBe(0)
  }
  expect(service.refusals).toEqual([])
})
