import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { expect, it } from "vitest"
import { IDENTITY } from "./identity.js"
import { run } from "./program.js"

const ran = async (argv: string[]) => {
  const out: string[] = []
  const err: string[] = []
  const code = await run(argv, {
    streams: { data: (text) => out.push(text), diagnostic: (text) => err.push(text) },
    tty: false,
  })
  return { code, out: out.join("\n"), err: err.join("\n") }
}
const json = (text: string) => JSON.parse(text) as { item: Record<string, unknown> }

it("lists the required root commands and config", async () => {
  const { code, out } = await ran(["commands", "--json"])
  expect(code).toBe(0)
  const names = (JSON.parse(out) as { commands: { name: string }[] }).commands.map((command) => command.name)
  expect(names).toEqual(expect.arrayContaining(["commands", "doctor", "skill", "mcp", "upgrade", "config", "runs"]))
})

it("doctor answers without a config file", async () => {
  const { code, out } = await ran(["doctor", "--json"])
  expect(code).toBe(0)
  expect(json(out).item).toMatchObject({ config: { exists: false }, profiles: [], read_only: null })
})

it("doctor reports an unreadable config as a field", async () => {
  const dir = process.env.CLIDEV_CONFIG_DIR ?? ""
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "config.json"), "not json")
  try {
    const { code, out } = await ran(["doctor", "--json"])
    expect(code).toBe(0)
    expect(json(out).item.config).toMatchObject({ exists: true, error: expect.any(String) })
  } finally {
    rmSync(join(dir, "config.json"))
  }
})

it("config show names the profile it was given", async () => {
  const { code, out } = await ran(["personal", "config", "show", "--json"])
  expect(code).toBe(0)
  expect(json(out).item).toMatchObject({ profile: "personal", profile_from: "first word" })
})

it("skill show prints the packaged skill", async () => {
  const { code, out } = await ran(["skill", "show"])
  expect(code).toBe(0)
  expect(out).toContain(readFileSync(new URL("../skills/clidev-cli/SKILL.md", import.meta.url), "utf8").split("\n")[0])
})

it("mcp without a profile stops and says so", async () => {
  const { code, err } = await ran(["mcp", "--json"])
  expect(code).toBe(2)
  expect(err).toContain("validation_error")
})

it("upgrade --check installs nothing when npm cannot be reached", async () => {
  const { code, out } = await ran(["upgrade", "--check", "--json"])
  expect(code).toBe(0)
  expect(json(out).item).toMatchObject({ current: IDENTITY.version, latest: null, updated: false })
})

it("keeps a failed command as a run, and runs list, show and path read it back (WC-LIFE-15)", async () => {
  expect((await ran(["--no-such-flag"])).code).toBe(2)
  const listed = await ran(["runs", "list", "--limit", "5", "--page", "1", "--json"])
  expect(listed.code).toBe(0)
  const failed = (JSON.parse(listed.out) as { items: { run_id: string; status: string }[] }).items.find(
    (run) => run.status === "failed",
  )
  expect(failed).toBeDefined()
  const id = failed?.run_id ?? ""
  const shown = await ran(["runs", "show", id, "--json"])
  expect(shown.code).toBe(0)
  expect(shown.out).toContain(id)
  expect((await ran(["runs", "show", id, "--problems", "--json"])).code).toBe(0)
  const path = await ran(["runs", "path", id])
  expect(path.code).toBe(0)
  expect(path.out).toContain(id)
})
