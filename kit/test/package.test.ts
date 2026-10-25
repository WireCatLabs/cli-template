import { execFileSync, spawnSync } from "node:child_process"
import { cpSync, existsSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { npmCommand } from "../src/source.js"
import { fixture, read, removeTempDirs, tempDir, V1 } from "./fixture.js"

afterAll(removeTempDirs)

const repoRoot = join(import.meta.dirname, "../..")
let bin = ""

// Runs the bin from a tarball installed by npm: npm drops some files when it packs (a nested .gitignore, .npmrc)
// and renames .gitignore to .npmignore when it installs, so a run from the source tree or a tar unpack still finds them.
beforeAll(() => {
  const template = fixture("0.1.0", {
    ...V1,
    ".gitignore": "node_modules\ndist\n",
    gitignore: "node_modules\ndist\n",
    "template.json": JSON.stringify({
      files: [".github/", ".gitignore", "AGENTS.md", "bin/release", "docs/meta.json"],
      seeds: ["src/", "README.md", "docs/", "skills/", "vitest.config.ts", "config/wirecat/"],
    }),
  })
  // npm applies an ignore file inside a listed folder, so one in kit/ would drop kit/dist from the package.
  for (const ignore of [".gitignore", ".npmignore"].filter((file) => existsSync(join(repoRoot, "kit", file)))) {
    cpSync(join(repoRoot, "kit", ignore), join(template, "kit", ignore))
  }
  execFileSync(process.execPath, [
    join(repoRoot, "node_modules/typescript/bin/tsc"),
    "-p",
    join(repoRoot, "kit"),
    "--outDir",
    join(template, "kit/dist"),
  ])
  const packed = tempDir("packed")
  const tarball = execFileSync(...npmCommand(["pack", "--silent", "--ignore-scripts", "--pack-destination", packed]), {
    cwd: template,
    encoding: "utf8",
  })
  const installed = tempDir("installed")
  execFileSync(
    ...npmCommand(["install", "--no-save", "--ignore-scripts", "--prefix", installed, join(packed, tarball.trim())]),
  )
  bin = join(installed, "node_modules/@wirecat/cli-template/kit/dist/main.js")
}, 60_000)

const flags = (values: Record<string, string>) => Object.entries(values).flatMap(([key, value]) => [`--${key}`, value])

const cli = (cwd: string, args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" })

describe("the packed bin", () => {
  it("runs new without a terminal from flags alone", () => {
    const cwd = tempDir("packed-new")

    const result = cli(cwd, [
      "new",
      "demo",
      ...flags({
        command: "demo",
        package: "@example/demo-cli",
        owner: "example",
        category: "notes",
        "content-lang": "en",
        "sign-in": "none",
        api: "official-docs",
        filters: "time",
        "never-store": "tokens",
        untrusted: "none",
      }),
    ])

    expect(result.stderr).toBe("")
    expect(result.status).toBe(0)
    expect(read(cwd, "demo/.gitignore")).toBe("node_modules\ndist\n")
    expect(existsSync(join(cwd, "demo/src/bin/demo.ts"))).toBe(true)
    expect(existsSync(join(cwd, "demo/kit"))).toBe(false)
    expect(JSON.parse(read(cwd, "demo/package.json")).files).not.toContain("gitignore")
  })

  it("exits 1 and lists the missing answers", () => {
    const result = cli(tempDir("packed-missing"), ["new", "demo", "--command", "demo"])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "--category: messenger, mail, notes, files, calendar, meetings, or other:<your answer>",
    )
  })
})
