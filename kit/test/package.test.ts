import { execFileSync, spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { fetchPacked, npmCommand } from "../src/source.js"
import { fixture, read, removeTempDirs, tempDir, V1 } from "./fixture.js"

afterAll(removeTempDirs)

const repoRoot = join(import.meta.dirname, "../..")
let bin = ""
let tarball = ""

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
  const name = execFileSync(
    ...npmCommand(["pack", "--offline", "--silent", "--ignore-scripts", "--pack-destination", packed]),
    {
      cwd: template,
      encoding: "utf8",
    },
  )
  tarball = join(packed, name.trim())
  const installed = tempDir("installed")
  execFileSync(
    ...npmCommand([
      "install",
      "--offline",
      "--no-audit",
      "--no-fund",
      "--no-save",
      "--ignore-scripts",
      "--prefix",
      installed,
      tarball,
    ]),
  )
  bin = join(installed, "node_modules/@wirecat/cli-template/kit/dist/main.js")
  // The fixture lists no dependencies; the published package has cli-core, which npm puts beside it.
  mkdirSync(join(installed, "node_modules/@wirecat"), { recursive: true })
  symlinkSync(
    realpathSync(join(repoRoot, "node_modules/@wirecat/cli-core")),
    join(installed, "node_modules/@wirecat/cli-core"),
  )
}, 60_000)

const flags = (values: Record<string, string>) => Object.entries(values).flatMap(([key, value]) => [`--${key}`, value])

const cli = (cwd: string, args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" })

describe("the packed bin", () => {
  it("runs new without a terminal from flags alone, --tagline included", () => {
    const cwd = tempDir("packed-new")

    const result = cli(cwd, [
      "new",
      "demo",
      ...flags({
        tagline: "Demo records, offline",
        command: "demo",
        package: "@example/demo-cli",
        owner: "example",
        category: "notes",
        "content-lang": "en",
        "sign-in": "none",
        api: "official-docs",
        spec: "none",
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

  it("lists --tagline in its usage", () => {
    expect(cli(tempDir("packed-help"), ["--help"]).stdout).toContain("--tagline <line>")
  })

  it("exits 1 and lists the missing answers", () => {
    const result = cli(tempDir("packed-missing"), ["new", "demo", "--command", "demo"])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "--category: messenger, mail, notes, files, meetings, calendar, crm, tracker, content, or other:<your answer>",
    )
  })

  // The installed kit, as npx runs it: the config's own folder has no node_modules, so cli-core is the kit's.
  it.each([
    ['prefix: "wc-acme"', "wirecat.config: identity.prefix"],
    ['prefix: "WCACME", extra: (await import("./helper.ts")).x', "keep the config in one file; it imports ./helper.ts"],
  ])("checks a typed --from-config file with the kit's own cli-core (%s)", (prefix, error) => {
    const cwd = tempDir("packed-config")
    const config = `import { defineCli } from "@wirecat/cli-core/manifest"

const kind: "openapi" = "openapi"

export default defineCli({
  identity: { command: "acme", package: "@wirecat/acme-cli", ${prefix}, service: "Acme", owner: "WireCatLabs" },
  spec: { kind, from: "https://docs.acme.example/openapi.json" },
  auth: { preset: "token" },
  category: "other",
})
`
    writeFileSync(join(cwd, "wirecat.config.ts"), config)

    const result = cli(cwd, ["new", "--from-config", "wirecat.config.ts"])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(error)
  })
})

describe("upgrade's download of an earlier version", () => {
  it("unpacks what npm pack fetched and reads .gitignore back", async () => {
    const { source, dispose } = await fetchPacked(tarball)
    try {
      expect(source.version).toBe("0.1.0")
      expect(source.manifest.files).toContain(".gitignore")
      expect(read(source.root, "AGENTS.md")).toContain("APP_HOME")
    } finally {
      await dispose()
    }
  }, 30_000)
})
