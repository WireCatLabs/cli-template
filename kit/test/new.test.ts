import { execFileSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { languageWarnings, runNew, speechModels, withContentLanguages } from "../src/new.js"
import { renamer, stripKit } from "../src/rename.js"
import { listTemplate, loadSource, renderTemplate } from "../src/source.js"
import { fixture, io, NOTES_FLAGS, read, removeTempDirs, tempDir, V1 } from "./fixture.js"

afterAll(removeTempDirs)

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.name === ".git" ? [] : entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  )

const makeNew = async (flags: Record<string, string>, name = "cal-cli") => {
  const cwd = tempDir("new")
  const source = await loadSource(fixture("0.1.0", V1))
  const out = await runNew(cwd, source, { name, flags }, io())
  return { cwd, dir: join(cwd, name), out }
}

describe("new", () => {
  it.each([
    ["messenger", "whatsapp-cli"],
    ["mail", "No reference CLI"],
    ["notes", "cli-memo"],
    ["files", "drive-cli"],
    ["calendar", "No reference CLI"],
    ["meetings", "zoom-cli"],
    ["other:issue tracker", "No reference CLI"],
  ])("copies the template for the %s category", async (category, reference) => {
    const { dir, out } = await makeNew({ ...NOTES_FLAGS, category })

    expect(read(dir, "src/bin/cal.ts")).toContain('run({ app: CAL, command: "cal" })')
    expect(existsSync(join(dir, "kit"))).toBe(false)
    expect(existsSync(join(dir, ".git"))).toBe(true)
    expect(execFileSync("git", ["ls-files", "-s", "bin/release"], { cwd: dir, encoding: "utf8" })).toMatch(/^100755 /)
    for (const file of walk(dir).filter((path) => !path.endsWith("template.json"))) {
      expect(read(file, ""), file).not.toMatch(/(?<![A-Za-z0-9_])(app(?!: )|APP)(?![A-Za-z0-9])|kit\//)
    }
    expect(read(dir, "docs/index.md")).toBe(
      "# cal-cli\n\nInstall @example/cal-cli from example/cal-cli. An application for happy apps.\n",
    )
    expect(read(dir, "skills/cal-cli/SKILL.md")).toBe("---\nname: cal-cli\n---\n")
    expect(read(dir, "vitest.config.ts")).toBe('export default { include: ["src/**/*.test.ts"], exclude: [] }\n')
    expect(read(dir, "README.md")).toContain("node dist/bin/cal.js doctor")
    expect(read(dir, "AGENTS.md")).toContain(reference)
    expect(read(dir, "AGENTS.md")).toContain("Keep CAL_HOME out of logs.")
    expect(read(dir, "docs/dev/DESIGN.md")).toContain(`**Category:** ${category.replace("other:", "other: ")}`)
    expect(read(dir, "src/version.ts")).toBe('export const VERSION = "0.0.0"\n')
    expect(out).toContain("Create the repository example/cal-cli")
  })

  it("prints each next step on its own line, which PowerShell 5.1 can run", async () => {
    const { out } = await makeNew(NOTES_FLAGS)

    expect(out).toContain("\n  cd cal-cli\n  pnpm install\n  pnpm ci:quick\n  git add -A\n")
    expect(out).not.toContain("&&")
  })

  it("sends the person to the handbook's list of taken monthly cron minutes", async () => {
    const { out } = await makeNew(NOTES_FLAGS)

    expect(out).toContain("cron minute from the list in cli-base docs/standards/ci.md (WC-CI-9)")
  })

  it("rewrites package.json for the new CLI and drops the copy tool", async () => {
    const { dir } = await makeNew(NOTES_FLAGS)
    const pkg = JSON.parse(read(dir, "package.json"))

    expect(pkg.name).toBe("@example/cal-cli")
    expect(pkg.version).toBe("0.0.0")
    expect(pkg.bin).toEqual({ cal: "dist/bin/cal.js" })
    expect(pkg.files).not.toContain("kit/dist")
    expect(pkg.scripts).toEqual({ build: "tsc --build", prepack: "pnpm build" })
    expect(pkg.repository.url).toBe("git+https://github.com/example/cal-cli.git")
  })

  it("records the version, template-owned hashes and seeds in template.json", async () => {
    const { dir } = await makeNew(NOTES_FLAGS)
    const manifest = JSON.parse(read(dir, "template.json"))

    expect(manifest).toMatchObject({
      template: "@wirecat/cli-template",
      version: "0.1.0",
      names: { name: "cal-cli", command: "cal", package: "@example/cal-cli", owner: "example" },
      seeds: ["src/", "README.md", "docs/", "skills/", "vitest.config.ts", "config/wirecat/"],
    })
    expect(Object.keys(manifest.files).sort()).toEqual([
      ".github/workflows/ci.yml",
      "AGENTS.md",
      "bin/release",
      "docs/meta.json",
    ])
  })

  it("without a terminal, lists every missing answer with its choices", async () => {
    const { command: _, "sign-in": __, ...flags } = NOTES_FLAGS
    const error = await makeNew(flags).catch((caught: Error) => caught.message)

    expect(error).toContain("--command:")
    expect(error).toContain("--sign-in: oauth, token, session, none, or other:<your answer>")
    expect(error).not.toContain("--owner")
  })

  it("rejects an answer outside the choices", async () => {
    await expect(makeNew({ ...NOTES_FLAGS, api: "magic" })).rejects.toThrow(/--api: "magic" is not one of the choices/)
    await expect(makeNew({ ...NOTES_FLAGS, untrusted: "links,none" })).rejects.toThrow(/cannot be combined/)
  })

  it("refuses a folder that already holds files", async () => {
    const cwd = tempDir("busy")
    const source = await loadSource(fixture("0.1.0", V1))
    await runNew(cwd, source, { name: "cal-cli", flags: NOTES_FLAGS }, io())

    await expect(runNew(cwd, source, { name: "cal-cli", flags: NOTES_FLAGS }, io())).rejects.toThrow(/not empty/)
  })

  it("asks the missing answers in a terminal, by number or typed", async () => {
    const cwd = tempDir("ask")
    const source = await loadSource(fixture("0.1.0", V1))
    const { category: _, filters: __, owner: ___, ...flags } = NOTES_FLAGS
    const terminal = io(["Example-Org", "9", "1", "2,6", "by location"], true)

    await runNew(cwd, source, { name: "cal-cli", flags }, terminal)

    const design = read(join(cwd, "cal-cli"), "docs/dev/DESIGN.md")
    expect(terminal.text()).toContain('"9" is not one of the choices')
    expect(design).toContain("**Category:** messenger")
    expect(design).toContain("**How people filter:** by person, other: by location")
    expect(JSON.parse(read(join(cwd, "cal-cli"), "template.json")).names.owner).toBe("Example-Org")
  })

  it("puts the one-time first task into DESIGN.md, not into the template-owned AGENTS.md", async () => {
    const cwd = tempDir("first-task")

    await runNew(cwd, await loadSource(fixture("0.1.0", V1)), { name: "cal-cli", flags: NOTES_FLAGS }, io())

    const design = read(join(cwd, "cal-cli"), "docs/dev/DESIGN.md")
    expect(design).toContain("## First task")
    expect(design).toContain("`skills/cal-cli/SKILL.md`")
    expect(read(join(cwd, "cal-cli"), "AGENTS.md")).not.toMatch(/first task/i)
  })

  it("stops when the package lacks a file template.json lists", async () => {
    const { "docs/meta.json": _, ...files } = V1
    const source = await loadSource(fixture("0.1.0", files))

    await expect(runNew(tempDir("gap"), source, { name: "x", flags: NOTES_FLAGS }, io())).rejects.toThrow(
      /lists "docs\/meta.json", but the package has no such file/,
    )
  })
})

describe("new from this repository", () => {
  const root = join(import.meta.dirname, "../..")
  const names = { name: "cal-cli", command: "cal", package: "@example/cal-cli", owner: "example" }
  const cliDevs = (text: string) => text.match(/cli-dev/g)?.length ?? 0

  it("replaces every clidev placeholder", async () => {
    const cwd = tempDir("real")

    await runNew(cwd, await loadSource(root), { name: "cal-cli", flags: NOTES_FLAGS }, io())

    const made = walk(join(cwd, "cal-cli")).filter((path) => !path.endsWith("template.json"))
    for (const file of made) expect(read(file, ""), file).not.toMatch(/clidev/i)
    expect(read(join(cwd, "cal-cli"), "SECURITY.md")).toContain(
      "https://github.com/example/cal-cli/security/advisories/new",
    )
    expect(read(join(cwd, "cal-cli"), "docs/security.md")).toContain(
      "https://github.com/example/cal-cli/blob/main/SECURITY.md",
    )
    expect(read(join(cwd, "cal-cli"), "README.md")).toContain("https://github.com/WireCatLabs/cli-template)")
    expect(read(join(cwd, "cal-cli"), "AGENTS.md")).toContain("https://github.com/WireCatLabs/cli-template)")
    expect(existsSync(join(cwd, "cal-cli", "config/parity-groups.json"))).toBe(false)
  })

  it("keeps the docs checks, CHANGELOG.md included, and drops only the kit's", async () => {
    const cwd = tempDir("real")

    await runNew(cwd, await loadSource(root), { name: "cal-cli", flags: NOTES_FLAGS }, io())

    const { scripts } = JSON.parse(read(join(cwd, "cal-cli"), "package.json"))
    expect(scripts["docs:spell"]).toContain("CHANGELOG.md")
    expect(scripts["docs:check"]).toMatch(/rumdl check .*CHANGELOG\.md/)
    expect(scripts["docs:check"]).toContain("pnpm docs:lint")
    expect(scripts["docs:check"]).not.toContain("kit")
    expect(scripts["kit:docs"]).toBeUndefined()
  })

  it("writes the content languages into the identity and keeps them in DESIGN.md", async () => {
    const cwd = tempDir("real")

    await runNew(cwd, await loadSource(root), { name: "cal-cli", flags: NOTES_FLAGS }, io())

    const identity = read(join(cwd, "cal-cli"), "src/identity.ts")
    expect(identity).toMatch(/issues: "[^"]+",\n {2}messenger: false,\n {2}contentLanguages: \["en", "ru"\],\n\}/)
    const design = read(join(cwd, "cal-cli"), "docs/dev/DESIGN.md")
    expect(design).toContain("Languages: en, ru.")
    expect(design).not.toContain("speechModels")
  })

  it("keeps the neutral wording for a CLI that is not a messenger and turns a messenger's on", async () => {
    const source = await loadSource(root)
    const notes = tempDir("real")
    const messenger = tempDir("real")

    await runNew(notes, source, { name: "cal-cli", flags: NOTES_FLAGS }, io())
    await runNew(messenger, source, { name: "cal-cli", flags: { ...NOTES_FLAGS, category: "messenger" } }, io())

    expect(read(join(notes, "cal-cli"), "src/identity.ts")).toContain("  messenger: false,\n")
    const identity = read(join(messenger, "cal-cli"), "src/identity.ts")
    expect(identity).toContain("  messenger: true,\n")
    expect(identity).not.toContain("messenger: false")
    expect(read(join(messenger, "cal-cli"), "docs/dev/DESIGN.md")).toContain(
      "Set the messenger's `speechModels` to `parakeet-v3`.",
    )
  })

  it("leaves cli-base's cli-dev alone in every file", async () => {
    const source = await loadSource(root)
    const rendered = await renderTemplate(source, names)
    const rename = renamer(source.manifest.placeholders, names)

    const changed = [...(await listTemplate(source)).keys()].filter(
      (path) => cliDevs(read(root, path)) !== cliDevs(rendered.get(rename(path))?.content.toString() ?? ""),
    )

    expect(changed).toEqual([])
    expect(rendered.get("package.json")?.content.toString()).toContain("cli-dev lint --cli dist/bin/cal.js")
  })
})

describe("content languages", () => {
  it("picks speech models by the languages", () => {
    expect(speechModels(["ru"])).toEqual(["gigaam-v3", "gigaam-v3-ctc", "parakeet-v3"])
    expect(speechModels(["en", "pt-BR"])).toEqual(["parakeet-v3"])
    expect(speechModels(["en", "ja"])).toBeUndefined()
  })

  it("refuses an identity file it cannot find IDENTITY in", () => {
    expect(() => withContentLanguages("export const OTHER = {}\n", ["en"])).toThrow(/no IDENTITY object/)
  })

  it("warns about a language with no stemmer or speech model", () => {
    expect(languageWarnings(["en", "de", "ja"], true)).toEqual([
      "de: cli-core has no search stemmer for it; search matches whole words only",
      "ja: cli-core has no search stemmer for it; search matches whole words only",
      "ja: no speech model in cli-core hears it",
    ])
  })

  it("warns about speech models only for a messenger", () => {
    expect(languageWarnings(["ja"], false)).toEqual([
      "ja: cli-core has no search stemmer for it; search matches whole words only",
    ])
  })
})

it("drops a kit entry from a config together with the comment that explains it", () => {
  const config = [
    "exclude: [",
    '  "src/bin/**",',
    "  // The kit's entry point runs only as a separate process.",
    '  "kit/src/main.ts",',
    "],",
    "",
  ].join("\n")

  expect(stripKit("vitest.config.ts", Buffer.from(config)).toString()).toBe('exclude: [\n  "src/bin/**",\n],\n')
})

it("drops a kit key from a config, such as the kit's coverage floor", () => {
  const config = [
    "thresholds: {",
    '  "src/**": { lines: 95 },',
    "  // The kit keeps its own floor.",
    '  "kit/src/**": { lines: 95 },',
    "},",
    "",
  ].join("\n")

  expect(stripKit("vitest.config.ts", Buffer.from(config)).toString()).toBe(
    'thresholds: {\n  "src/**": { lines: 95 },\n},\n',
  )
})
