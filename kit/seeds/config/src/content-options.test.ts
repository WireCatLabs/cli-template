import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { memoryKeyring } from "@wirecat/cli-base"
import { contentManifestFake } from "@wirecat/cli-core/content/testing"
import { expect, it } from "vitest"
import { API } from "./config.js"
import { SOURCE } from "./generated/wirecat-config.js"
import { FAKE_API_TOKEN, FAKE_SITE, fakeServiceApi } from "./testing/fake-api.js"
import { runCli } from "./testing/harness.js"

// The fake answers example rows, so this proves every content command and option runs, not what a real post holds.
it("every option of the content commands runs over a synced copy", async () => {
  const keyring = memoryKeyring()
  const [login, password] = FAKE_API_TOKEN.split(":") as [string, string]
  const started = await runCli(["options", "session", "start", "--site", FAKE_SITE, "--login", login, "--json"], {
    keyring,
    service: fakeServiceApi(),
    stdin: password,
  })
  expect(started.code, started.err).toBe(0)
  const service = contentManifestFake(SOURCE, { api: API.manifest })
  const ran = (argv: string[]) => runCli(["options", ...argv, "--json"], { keyring, service })
  const synced = await ran(["sync", "--rescan", "--max-pages", "50"])
  expect(synced.code, synced.err).toBe(0)
  // Pages are read but not written: the config's writes name the posts route only.
  const listed = (await ran(["posts", "list"])).json() as { items: { external_id: string; type: string }[] }
  const [first, second] = listed.items.filter((one) => one.type === "post").map((one) => one.external_id) as [
    string,
    string,
  ]
  const [tag] = service.ids("term") as [string]
  const text = join(process.env.CLIDEV_CONFIG_DIR ?? "", "..", "post.md")
  writeFileSync(text, "# Notes\n\nA short post.\n")
  for (const argv of [
    ["channels", "list"],
    ["posts", "list", "--limit", "1", "--page", "1"],
    ["posts", "show", first],
    ["posts", "search", "post", "--limit", "1", "--page", "1"],
    ["posts", "stats", first],
    ["users", "list", "--limit", "1", "--page", "1"],
    ["tags", "list", "--limit", "1", "--page", "1"],
  ]) {
    const answer = await ran(argv)
    expect(answer.code, `${argv.join(" ")}: ${answer.err}`).toBe(0)
  }
  expect(service.refusals).toEqual([])
  // A source without writes has no posts create, update, publish, unpublish or delete.
  if (!SOURCE.writes) return
  for (const argv of [
    [
      "posts",
      "create",
      "--title",
      "Notes",
      "--text-file",
      text,
      "--description",
      "Short",
      "--slug",
      "notes",
      "--tags",
      tag,
      "--type",
      "post",
      "--yes",
    ],
    ["posts", "update", first, "--text-file", text, "--description", "New", "--slug", "new", "--tags", tag, "--yes"],
    ["posts", "update", first, "--text-file", text, "--replace-body", "--yes"],
    ["posts", "publish", first, "--yes"],
    ["posts", "unpublish", first, "--yes"],
    ["posts", "publish", first, "--at-time", "2030-01-01T10:00:00Z", "--yes"],
    ["posts", "delete", second, "--yes"],
    ["posts", "delete", second, "--allow-delete", "--yes"],
  ]) {
    const answer = await ran(argv)
    expect(answer.code, `${argv.join(" ")}: ${answer.err}`).toBe(0)
  }
  expect(service.refusals).toEqual([])
})
