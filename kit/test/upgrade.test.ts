import { execFileSync } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { runNew } from "../src/new.js"
import { loadSource, renderTemplate, type TemplateSource } from "../src/source.js"
import { runUpgrade, type UpgradeOptions } from "../src/upgrade.js"
import {
  commitAll,
  type Files,
  fixture,
  io,
  NOTES_FLAGS,
  onClidev,
  read,
  removeTempDirs,
  status,
  tempDir,
  V1,
} from "./fixture.js"

afterAll(removeTempDirs)

const V2: Files = {
  ...V1,
  ".github/workflows/ci.yml":
    V1[".github/workflows/ci.yml"]?.replace("personal doctor", "personal doctor --json") ?? "",
  "AGENTS.md": V1["AGENTS.md"]?.replace("Keep APP_HOME out of logs.", "Keep APP_HOME and tokens out of logs.") ?? "",
  "docs/meta.json": '{ "title": "app", "pages": [] }\n',
  "docs/new-page.md": "# app pages\n",
  "README.md": "# app\n\nA new seed text.\n",
  "template.json": JSON.stringify({
    files: [".github/", "AGENTS.md", "bin/release", "docs/meta.json", "docs/new-page.md"],
    seeds: ["src/", "README.md", "docs/", "skills/", "vitest.config.ts", "config/wirecat/"],
  }),
}

const sourceAt = (sources: Map<string, TemplateSource>, version: string): TemplateSource => {
  const source = sources.get(version)
  if (!source) throw new Error(`no fixture for template ${version}`)
  return source
}

const setup = async () => {
  const sources = new Map<string, TemplateSource>()
  for (const [version, files] of [["0.1.0", V1] as const, ["0.2.0", V2] as const]) {
    sources.set(version, await loadSource(fixture(version, files)))
  }
  const cwd = tempDir("upgrade")
  await runNew(cwd, sourceAt(sources, "0.1.0"), { name: "cal-cli", flags: NOTES_FLAGS }, io())
  const dir = join(cwd, "cal-cli")
  writeFileSync(join(dir, "docs/meta.json"), '{ "title": "Calendar" }\n')
  writeFileSync(join(dir, "README.md"), "# cal\n\nOur own words.\n")
  commitAll(dir)
  const fetched: string[] = []
  const disposed: string[] = []
  const fetchVersion = async (_name: string, version: string) => {
    fetched.push(version)
    return {
      source: sourceAt(sources, version),
      dispose: async () => {
        disposed.push(version)
      },
    }
  }
  const upgrade = (options: UpgradeOptions, terminal = io()) =>
    runUpgrade(dir, sourceAt(sources, "0.2.0"), fetchVersion, options, terminal)
  return { dir, upgrade, fetched, disposed }
}

const manifest = (dir: string) => JSON.parse(read(dir, "template.json"))

describe("upgrade", () => {
  it("--dry-run lists each changed file and what it would get, writing nothing", async () => {
    const { dir, upgrade } = await setup()

    const out = await upgrade({ dryRun: true, mode: "apply" })

    expect(out).toContain(".github/workflows/ci.yml (clean): applied")
    expect(out).toContain("AGENTS.md (edited): applied")
    expect(out).toContain("docs/meta.json (edited): conflict")
    expect(out).toContain("docs/new-page.md (new): applied")
    expect(out).not.toContain("README.md")
    expect(status(dir)).toBe("")
  })

  it("reads a file checked out with CRLF as the LF text it was made from", async () => {
    const { dir, upgrade } = await setup()
    // With autocrlf on, as on the Windows runner, git would store LF and leave nothing to commit.
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: dir })
    for (const path of [".github/workflows/ci.yml", "AGENTS.md"]) {
      writeFileSync(join(dir, path), read(dir, path).replaceAll("\n", "\r\n"))
    }
    commitAll(dir)

    const out = await upgrade({ dryRun: false, mode: "apply" })

    expect(out).toContain(".github/workflows/ci.yml (clean): applied")
    expect(out).toContain("AGENTS.md (edited): applied")
    expect(read(dir, "AGENTS.md")).toContain("Keep CAL_HOME and tokens out of logs.")
  })

  it("without a terminal or a flag, stops and names the choices", async () => {
    const { upgrade } = await setup()

    await expect(upgrade({ dryRun: false })).rejects.toThrow(/pass --apply, --replace or --skip/)
  })

  it("--apply merges each change, keeps the CLI's edits, marks the conflict and leaves seeds alone", async () => {
    const { dir, upgrade, fetched, disposed } = await setup()

    const out = await upgrade({ dryRun: false, mode: "apply" })

    expect(read(dir, ".github/workflows/ci.yml")).toContain("node dist/bin/cal.js personal doctor --json")
    const agents = read(dir, "AGENTS.md")
    expect(agents).toContain("Keep CAL_HOME and tokens out of logs.")
    expect(agents).toContain("[cli-memo](https://github.com/WireCatLabs/cli-memo)")
    expect(read(dir, "docs/meta.json")).toMatch(
      /<<<<<<< this CLI[\s\S]*Calendar[\s\S]*=======[\s\S]*>>>>>>> template now/,
    )
    expect(read(dir, "docs/new-page.md")).toBe("# cal pages\n")
    expect(read(dir, "README.md")).toBe("# cal\n\nOur own words.\n")
    expect(fetched).toEqual(["0.1.0"])
    expect(disposed).toEqual(["0.1.0"])
    expect(existsSync(tmpdir())).toBe(true)
    expect(out).toContain("stays on 0.1.0 until they are resolved")
    expect(manifest(dir)).toMatchObject({
      version: "0.1.0",
      pending: { version: "0.2.0", conflicts: ["docs/meta.json"] },
    })

    await expect(upgrade({ dryRun: false, mode: "apply" })).rejects.toThrow(
      /markers are still in:\n {2}docs\/meta.json/,
    )

    writeFileSync(join(dir, "docs/meta.json"), '{ "title": "Calendar", "pages": [] }\n')
    expect(await upgrade({ dryRun: false })).toContain("now on 0.2.0")
    expect(manifest(dir).version).toBe("0.2.0")
    expect(manifest(dir).pending).toBeUndefined()
    commitAll(dir)
    expect(await upgrade({ dryRun: false })).toBe("Already on @wirecat/cli-template@0.2.0.")
  })

  it("--replace takes the template's files as they are", async () => {
    const { dir, upgrade } = await setup()

    await upgrade({ dryRun: false, mode: "replace" })

    expect(read(dir, "docs/meta.json")).toBe('{ "title": "cal", "pages": [] }\n')
    expect(read(dir, "AGENTS.md")).not.toContain("cli-memo")
    expect(read(dir, "README.md")).toBe("# cal\n\nOur own words.\n")
    expect(manifest(dir).version).toBe("0.2.0")
  })

  it("--skip keeps the CLI's files and moves the version, so a skipped change is not asked again", async () => {
    const { dir, upgrade } = await setup()

    await upgrade({ dryRun: false, mode: "skip" })

    expect(read(dir, "docs/meta.json")).toBe('{ "title": "Calendar" }\n')
    expect(status(dir)).toBe(" M template.json\n")
    commitAll(dir)
    expect(await upgrade({ dryRun: false })).toBe("Already on @wirecat/cli-template@0.2.0.")
  })

  it("asks per file in a terminal, showing the diff on request", async () => {
    const { dir, upgrade } = await setup()
    const terminal = io(["a", "s", "d", "r", "a"], true)

    await upgrade({ dryRun: false }, terminal)

    expect(terminal.text()).toContain('+{ "title": "cal", "pages": [] }')
    expect(read(dir, ".github/workflows/ci.yml")).toContain("--json")
    expect(read(dir, "AGENTS.md")).toContain("Keep CAL_HOME out of logs.")
    expect(read(dir, "docs/meta.json")).toBe('{ "title": "cal", "pages": [] }\n')
    expect(manifest(dir).version).toBe("0.2.0")
  })

  it("needs a clean working tree", async () => {
    const { dir, upgrade } = await setup()
    writeFileSync(join(dir, "scratch.txt"), "x")

    await expect(upgrade({ dryRun: false, mode: "apply" })).rejects.toThrow(/working tree has changes/)
  })
})

describe("upgrade across the placeholder rename", () => {
  const OLD: Files = {
    ...V1,
    "AGENTS.md": `${V1["AGENTS.md"]}\nThe skill is skills/app-cli/SKILL.md, from WireCatLabs/app-cli.\n`,
    "template.json": JSON.stringify({
      ...JSON.parse(V1["template.json"] ?? "{}"),
      placeholders: { command: "app", package: "@wirecat/app-cli", repository: "WireCatLabs/app-cli" },
    }),
  }
  const renamed = onClidev(OLD)
  const NEW: Files = {
    ...renamed,
    "AGENTS.md": renamed["AGENTS.md"]?.replace("Keep CLIDEV_HOME out", "Keep CLIDEV_HOME and tokens out") ?? "",
  }

  it("renders 0.1.1 on app and the next version on clidev, so only real changes are merged", async () => {
    const sources = new Map<string, TemplateSource>()
    for (const [version, files] of [["0.1.1", OLD] as const, ["0.1.2", NEW] as const]) {
      sources.set(version, await loadSource(fixture(version, files)))
    }
    const cwd = tempDir("rename")
    // A name that is not <command>-cli, so a wrong "name" placeholder cannot hide behind the command word.
    const flags = { ...NOTES_FLAGS, package: "@example/calendar" }
    await runNew(cwd, sourceAt(sources, "0.1.1"), { name: "calendar", flags }, io())
    const dir = join(cwd, "calendar")
    writeFileSync(join(dir, "AGENTS.md"), read(dir, "AGENTS.md").replace("## Commands", "## Commands\n\nOur own rule."))
    commitAll(dir)
    const fetchVersion = async (_name: string, version: string) => ({
      source: sourceAt(sources, version),
      dispose: async () => {},
    })

    const out = await runUpgrade(dir, sourceAt(sources, "0.1.2"), fetchVersion, { dryRun: false, mode: "apply" }, io())

    expect(out.split("\n").filter((line) => line.startsWith("  "))).toEqual(["  AGENTS.md (edited): applied"])
    const agents = read(dir, "AGENTS.md")
    expect(agents).toContain("Our own rule.")
    expect(agents).toContain("Keep CAL_HOME and tokens out of logs.")
    expect(agents).toContain("The skill is skills/calendar/SKILL.md, from example/calendar.")
    expect(manifest(dir)).toMatchObject({ version: "0.1.2" })
    expect(manifest(dir).pending).toBeUndefined()
    const base = await renderTemplate(sourceAt(sources, "0.1.1"), manifest(dir).names)
    expect(base.get("AGENTS.md")?.content.toString()).toContain("skills/calendar/SKILL.md")
  })
})
