import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { memoryKeyring } from "@wirecat/cli-base"
import { contentManifestFake } from "@wirecat/cli-core/content/testing"
import { expect, it } from "vitest"
import { API } from "./config.js"
import { SOURCE } from "./generated/wirecat-config.js"
import { FAKE_API_TOKEN, FAKE_SITE, fakeServiceApi } from "./testing/fake-api.js"
import { runCli } from "./testing/harness.js"

// Each write's answer is the post as the fake holds it after the write, read back through the source's map.
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
  type Answer = { item: { post?: Record<string, unknown> } }
  const wrote = async (argv: string[]) => {
    const answer = await ran([...argv, "--yes"])
    expect(answer.code, `${argv.join(" ")}: ${answer.err}`).toBe(0)
    return (answer.json() as Answer).item.post ?? {}
  }
  const created = await wrote([
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
  ])
  expect(created).toMatchObject({ status: "draft", title: "Notes", excerpt: "Short", slug: "notes", terms: [tag] })
  expect(created.body).toContain("A short post.")
  expect(
    await wrote([
      "posts",
      "update",
      first,
      "--text-file",
      text,
      "--description",
      "New",
      "--slug",
      "new",
      "--tags",
      tag,
    ]),
  ).toMatchObject({ excerpt: "New", slug: "new", terms: [tag] })
  expect(await wrote(["posts", "update", first, "--text-file", text, "--replace-body"])).toMatchObject({
    body: expect.stringContaining("A short post."),
  })
  expect(await wrote(["posts", "publish", first])).toMatchObject({ status: "published" })
  expect(await wrote(["posts", "unpublish", first])).toMatchObject({ status: "draft" })
  expect(await wrote(["posts", "publish", first, "--at-time", "2030-01-01T10:00:00Z"])).toMatchObject({
    status: "scheduled",
    scheduled_for: "2030-01-01T10:00:00.000Z",
  })
  expect(await wrote(["posts", "delete", second])).toMatchObject({ status: "trashed" })
  await wrote(["posts", "delete", second, "--allow-delete"])
  expect(service.ids("post")).not.toContain(second)
  expect(service.refusals).toEqual([])

  // The same write through the api group checks the content command's key (WC-PERM-22).
  const create = API.manifest.operations.find(
    (operation) => operation.id === (SOURCE.writes as { create?: { operation: string } }).create?.operation,
  )
  if (!create) return
  // --dry-run names what the write checks: the content key at its built-in level, and the api key it sends through.
  type Preview = { item: { permission: { key: string; level: string; also?: { key: string }[] } } }
  const preview = async (argv: string[]) => ((await ran([...argv, "--dry-run"])).json() as Preview).item.permission
  const drafted = await preview(["posts", "create", "--title", "Notes"])
  expect(drafted).toMatchObject({ key: "posts.create", level: "ask" })
  expect(drafted.also?.map(({ key }) => key)).toContain(`api.${create.command}`)
  const erased = await preview(["posts", "delete", first, "--allow-delete"])
  expect(erased).toMatchObject({ key: "posts.delete", level: "ask" })
  expect(erased.also?.map(({ key }) => key)).toContain("posts.delete.force")
  const trash = API.manifest.operations.find(
    (operation) => operation.id === (SOURCE.writes as { trash?: { operation: string } }).trash?.operation,
  )
  if (trash) expect(erased.also?.map(({ key }) => key)).toContain(`api.${trash.command}`)
  expect((await ran(["config", "set", "permissions.posts.create", "deny"])).code).toBe(0)
  const refused = await ran(["api", create.command, "--body", "{}", "--dry-run"])
  expect(refused.json()).toMatchObject({ error: { code: "permission_error", details: { permission: "posts.create" } } })
})

// The mass-deletion guard is the owner's to lift, by count: a rescan only lists everything again.
it("holds a sync that would mark every post deleted, rescan or not, until --allow-deletions names the count", async () => {
  const keyring = memoryKeyring()
  const [login, password] = FAKE_API_TOKEN.split(":") as [string, string]
  await runCli(["guard", "session", "start", "--site", FAKE_SITE, "--login", login, "--json"], {
    keyring,
    service: fakeServiceApi(),
    stdin: password,
  })
  const service = contentManifestFake(SOURCE, { api: API.manifest })
  const ran = (argv: string[]) => runCli(["guard", ...argv, "--json"], { keyring, service })
  const posts = async () =>
    ((await ran(["posts", "list"])).json() as { items: { external_id: string; type: string }[] }).items.filter(
      (one) => one.type === "post",
    )
  expect((await ran(["sync"])).code).toBe(0)
  const ids = service.ids("post")
  const listed = (await posts()).length
  expect(listed).toBeGreaterThan(0)
  for (const id of ids) service.remove("post", id)

  const held = await ran(["sync", "--rescan"])
  expect(held.code, held.err).toBe(0)
  expect(held.out).toContain(`--allow-deletions ${ids.length}`)
  expect((await posts()).length).toBe(listed)

  const allowed = await ran(["sync", "--rescan", "--allow-deletions", String(ids.length)])
  expect(allowed.code, allowed.err).toBe(0)
  expect(await posts()).toEqual([])
})
