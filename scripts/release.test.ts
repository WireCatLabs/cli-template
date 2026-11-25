import { execFileSync, spawnSync } from "node:child_process"
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, it as vitestIt } from "vitest"

const root = join(import.meta.dirname, "..")
const devBin = join(root, "node_modules/@wirecat/cli-base/dist/dev/bin.js")
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

// bin/release takes the release lock with flock, which macOS and Windows do not ship.
const it = vitestIt.skipIf(spawnSync("sh", ["-c", "command -v flock"]).status !== 0)

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" })

const stub = (dir: string, name: string, body: string) => {
  writeFileSync(join(dir, name), `#!/bin/sh\n${body}\n`)
  chmodSync(join(dir, name), 0o755)
}

// npm has 0.1.2, so bin/release raises the version through a pull request. gh refuses to open it, which stops the run
// right after the release branch is pushed, before anything could publish.
const raised = (fragment: string, dated = "", releaseCheck = "") => {
  const work = mkdtempSync(join(tmpdir(), "release-level-"))
  dirs.push(work)
  const origin = join(work, "origin.git")
  const repo = join(work, "repo")
  const stubs = join(work, "bin")
  mkdirSync(stubs)
  git(work, "init", "-q", "--bare", "-b", "main", origin)
  git(work, "clone", "-q", origin, repo)
  mkdirSync(join(repo, "bin"))
  mkdirSync(join(repo, "config/wirecat"), { recursive: true })
  cpSync(join(root, "bin/release"), join(repo, "bin/release"))
  for (const file of ["release-lock.sh", "release-lock-info.mjs"])
    cpSync(join(root, "config/wirecat", file), join(repo, "config/wirecat", file))
  mkdirSync(join(repo, "kit"))
  writeFileSync(join(repo, "kit/.keep"), "")
  mkdirSync(join(repo, "src"))
  mkdirSync(join(repo, "changes"))
  writeFileSync(
    join(repo, "package.json"),
    `${JSON.stringify(
      {
        name: "@example/acme-cli",
        version: dated ? "0.1.3" : "0.1.2",
        ...(releaseCheck && { scripts: { "release:check": releaseCheck } }),
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(join(repo, "src/version.ts"), `export const VERSION = "${dated ? "0.1.3" : "0.1.2"}"\n`)
  writeFileSync(
    join(repo, "CHANGELOG.md"),
    `# Changelog\n\n${dated}## 0.1.2 — 19.11.2026\n\n### Fixed\n\n- **One.** A fix.\n`,
  )
  writeFileSync(join(repo, "changes/.keep"), "")
  if (fragment) writeFileSync(join(repo, "changes/feat-pages.md"), fragment)
  git(repo, "add", "-A")
  git(repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "init")
  git(repo, "tag", "v0.1.2")
  git(repo, "push", "-q", "origin", "main", "v0.1.2")

  stub(
    stubs,
    "pnpm",
    `echo "$*" >> "${join(work, "pnpm.log")}"\n[ "$1" = install ] && exit 0\n[ "$1 $2" = "exec cli-dev" ] && shift 2 && exec node "${devBin}" "$@"\n[ -n "${releaseCheck}" ] && exit 0\nexit 1`,
  )
  stub(
    stubs,
    "npm",
    'case "$*" in\n  *" versions "*) echo \'["0.1.2"]\' ;;\n  "view @example/acme-cli version "*|"view @example/acme-cli@0.1.2 version "*) echo 0.1.2 ;;\n  *) exit 1 ;;\nesac',
  )
  stub(stubs, "gh", "exit 1")
  const run = spawnSync("sh", ["bin/release"], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${stubs}:${process.env.PATH}`,
      XDG_RUNTIME_DIR: work,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.com",
    },
  })
  const branches = git(origin, "branch", "--format=%(refname:short)").split("\n").filter(Boolean)
  const pnpmCalls = () => readFileSync(join(work, "pnpm.log"), "utf8").split("\n").filter(Boolean)
  return { run, branches, pnpmCalls, show: (branch: string, file: string) => git(origin, "show", `${branch}:${file}`) }
}

it("raises a taken version to the level its changes/ fragments need: an Added is a minor", () => {
  const { run, branches, show } = raised("### Added\n\n- **Pages.** Pages are written.\n")
  expect(run.stdout).toContain("0.1.2 is already on npm — publishing 0.2.0 instead")
  expect(branches).toContain("release/0.2.0")
  expect(JSON.parse(show("release/0.2.0", "package.json")).version).toBe("0.2.0")
  expect(show("release/0.2.0", "src/version.ts")).toContain('VERSION = "0.2.0"')
  expect(show("release/0.2.0", "CHANGELOG.md")).toMatch(/## 0\.2\.0 — [\d.]+\n\n### Added\n\n- \*\*Pages\.\*\*/)
})

it("keeps a patch for fragments that only fix", () => {
  const { run, branches } = raised("### Fixed\n\n- **Two.** Another fix.\n")
  expect(run.stdout).toContain("publishing 0.1.3 instead")
  expect(branches).toContain("release/0.1.3")
})

it("raises a version dated by hand when the fragments merged since need more", () => {
  const { run, branches, show } = raised(
    "### Added\n\n- **Pages.** Pages are written.\n",
    "## 0.1.3 — 20.11.2026\n\n### Fixed\n\n- **Two.** Another fix.\n\n",
  )
  expect(run.stdout).toContain("the changes/ fragments need 0.2.0 — publishing it instead of 0.1.3")
  expect(branches).toContain("release/0.2.0")
  expect(JSON.parse(show("release/0.2.0", "package.json")).version).toBe("0.2.0")
  expect(show("release/0.2.0", "CHANGELOG.md")).toMatch(/## 0\.2\.0 — 20\.11\.2026\n\n### Added[\s\S]*### Fixed/)
})

it("leaves the tests to release.yml and runs the other checks before it starts the release run", () => {
  const { run, pnpmCalls } = raised(
    "",
    "## 0.1.3 — 20.11.2026\n\n### Fixed\n\n- **Two.** Another fix.\n\n",
    "pnpm lint && pnpm test:coverage && pnpm test:matrix:check && pnpm docs:check",
  )
  expect(run.stdout).toContain("== checks for 0.1.3 ==")
  expect(pnpmCalls()).toEqual(expect.arrayContaining(["lint", "docs:check"]))
  expect(pnpmCalls()).not.toContain("test:coverage")
  expect(pnpmCalls()).not.toContain("test:matrix:check")
  expect(pnpmCalls()).not.toContain("release:check")
})
