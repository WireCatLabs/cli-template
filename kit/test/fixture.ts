import { execFileSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { PassThrough } from "node:stream"
import { DEFAULT_PLACEHOLDERS } from "../src/manifest.js"
import type { Io } from "../src/new.js"
import { renamer } from "../src/rename.js"

export type Files = Record<string, string>

const made: string[] = []

export const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `kit-${prefix}-`))
  made.push(dir)
  return dir
}

export const removeTempDirs = (): void => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
}

export const writeTree = (root: string, files: Files): void => {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
    if (path.startsWith("bin/")) chmodSync(full, 0o755)
  }
}

export const read = (root: string, path: string): string => readFileSync(join(root, path), "utf8")

const packageJson = (version: string) =>
  JSON.stringify(
    {
      name: "@wirecat/cli-template",
      version,
      description: "A WireCat CLI",
      type: "module",
      repository: { type: "git", url: "git+https://github.com/WireCatLabs/cli-template.git" },
      bin: { "cli-template": "kit/dist/main.js", app: "dist/bin/app.js" },
      files: [
        "dist",
        "kit/dist",
        ".github",
        "gitignore",
        "AGENTS.md",
        "bin",
        "docs",
        "src",
        "config",
        "README.md",
        "template.json",
        "skills",
        "vitest.config.ts",
      ],
      scripts: { build: "tsc --build && pnpm kit:build", "kit:build": "tsc -p kit", prepack: "pnpm build" },
    },
    null,
    2,
  )

export const V1: Files = {
  "template.json": JSON.stringify({
    files: [".github/", "AGENTS.md", "bin/release", "docs/meta.json"],
    seeds: ["src/", "README.md", "docs/", "skills/", "vitest.config.ts", "config/wirecat/"],
  }),
  ".github/workflows/ci.yml":
    "name: ci\njobs:\n  test:\n    steps:\n      - run: node dist/bin/app.js personal doctor\n",
  "AGENTS.md": [
    "# app",
    "",
    "Read the handbook: node_modules/@wirecat/cli-base/docs/standards/README.md",
    "",
    "<!-- cli-template:reference-cli:start -->",
    "<!-- cli-template:reference-cli:end -->",
    "",
    "## Commands",
    "",
    "Run `app personal doctor` first.",
    "",
    "## Rules",
    "",
    "Keep APP_HOME out of logs.",
    "",
  ].join("\n"),
  "bin/release": "#!/bin/sh\necho releasing app\n",
  "docs/meta.json": '{ "title": "app" }\n',
  "src/bin/app.ts": 'import { run } from "../program.js"\n\nrun({ app: APP, command: "app" })\n',
  "src/version.ts": 'export const VERSION = "0.1.0"\n',
  "config/wirecat/biome.base.json": "{}\n",
  "README.md": "# app\n\nThe template's own README.\n",
  "docs/index.md": "# app-cli\n\nInstall @wirecat/app-cli from WireCatLabs/app-cli. An application for happy apps.\n",
  "skills/app-cli/SKILL.md": "---\nname: app-cli\n---\n",
  "vitest.config.ts":
    'export default { include: ["src/**/*.test.ts", "kit/test/**/*.test.ts"], exclude: ["!kit/dist"] }\n',
  "kit/src/main.ts": "// the copy tool, never copied\n",
}

export const CLIDEV_PLACEHOLDERS = {
  command: "clidev",
  name: "clidev-cli",
  package: "@wirecat/clidev-cli",
  repository: "WireCatLabs/clidev-cli",
}

// The same template moved from 0.1.x's `app` placeholders to `clidev`, the way this repository moved.
export const onClidev = (files: Files): Files => {
  const { command, name, package: pkg } = CLIDEV_PLACEHOLDERS
  const rename = renamer(DEFAULT_PLACEHOLDERS, { command, name, package: pkg, owner: "WireCatLabs" })
  const renamed = Object.fromEntries(Object.entries(files).map(([path, text]) => [rename(path), rename(text)]))
  const manifest = JSON.parse(files["template.json"] ?? "{}")
  return { ...renamed, "template.json": JSON.stringify({ ...manifest, placeholders: CLIDEV_PLACEHOLDERS }) }
}

export const fixture = (version: string, files: Files): string => {
  const root = tempDir(`template-${version}`)
  writeTree(root, { ...files, "package.json": packageJson(version) })
  return root
}

export const io = (lines: string[] = [], interactive = false): Io & { text: () => string } => {
  const input = new PassThrough()
  const output = new PassThrough()
  let text = ""
  const queue = [...lines]
  // readline drops lines that arrive before a question is asked, so answer each prompt as it appears.
  output.on("data", (chunk) => {
    text += chunk
    if (/[:?] $/.test(String(chunk)) && queue.length) {
      const line = queue.shift()
      setImmediate(() => input.write(`${line}\n`))
    }
  })
  return { input, output, interactive, text: () => text }
}

const git = (cwd: string, args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=kit", "-c", "user.email=kit@example.com", "-c", "commit.gpgsign=false", ...args],
    {
      cwd,
      encoding: "utf8",
    },
  )

export const commitAll = (cwd: string): void => {
  git(cwd, ["add", "-A"])
  git(cwd, ["commit", "-q", "-m", "state"])
}

export const status = (cwd: string): string => git(cwd, ["status", "--porcelain"])

export const NOTES_FLAGS = {
  command: "cal",
  package: "@example/cal-cli",
  owner: "example",
  category: "notes",
  "content-lang": "en,ru",
  "sign-in": "none",
  api: "official-docs",
  filters: "time,person",
  "never-store": "tokens",
  untrusted: "none",
}
