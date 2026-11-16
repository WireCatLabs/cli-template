import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { runNew } from "../src/new.js"
import { REGENERATE, runRemoveSample, type Step } from "../src/remove-sample.js"
import { loadSource } from "../src/source.js"
import { io, NOTES_FLAGS, read, removeTempDirs, tempDir, writeTree } from "./fixture.js"

afterAll(removeTempDirs)

const commit = (dir: string) => {
  execFileSync("git", ["add", "-A"], { cwd: dir })
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "start"], { cwd: dir })
}

const recorder = () => {
  const steps: Step[] = []
  return { steps, run: (step: Step) => steps.push(step) > 0 }
}

const MANIFEST = {
  template: "@wirecat/cli-template",
  version: "0.25.0",
  names: { name: "cal-cli", command: "cal", package: "@wirecat/cal-cli", owner: "WireCatLabs" },
  files: {},
  seeds: [],
}

const PROGRAM = `import { commentsCommand } from "./commands/comments.js"
import { sessionCommand } from "./commands/session.js"

export const commands = () => [
  sessionCommand(),
  commentsCommand(),
]
`

// A CLI whose own service has replaced the sample everywhere but the sample's own files.
const replaced = () => {
  const dir = tempDir("remove-sample")
  writeTree(dir, {
    "template.json": JSON.stringify(MANIFEST),
    "src/program.ts": PROGRAM,
    "src/commands/session.ts":
      'import { calendar } from "../calendar/transport.js"\nexport const sessionCommand = calendar\n',
    "src/calendar/transport.ts": "export const calendar = () => 1\n",
    "src/commands/comments.ts": 'import { SERVICE } from "../sample/transport.js"\n',
    "src/comments.test.ts": 'import { fakeComments } from "./testing/fake-comments.js"\n',
    "src/sample/transport.ts": "// SAMPLE: the transport\nexport const SERVICE = 1\n",
    "src/testing/fake-comments.ts": "export const fakeComments = 1\n",
    "src/mcp.test.ts": "",
    "scripts/live.sh": "# SAMPLE: replace the comments reads\n",
  })
  execFileSync("git", ["init", "-q"], { cwd: dir })
  commit(dir)
  return dir
}

describe("remove-sample", () => {
  it("deletes the sample, unmounts its command and regenerates contracts/", async () => {
    const dir = replaced()
    const { steps, run } = recorder()

    const out = await runRemoveSample(dir, run)

    for (const path of [
      "src/sample",
      "src/commands/comments.ts",
      "src/comments.test.ts",
      "src/testing/fake-comments.ts",
    ]) {
      expect(existsSync(join(dir, path)), path).toBe(false)
    }
    expect(read(dir, "src/program.ts")).toBe(
      'import { sessionCommand } from "./commands/session.js"\n\nexport const commands = () => [\n  sessionCommand(),\n]\n',
    )
    expect(steps).toEqual(REGENERATE)
    expect(steps.map((step) => step.args.join(" "))).toContain("exec vitest run src/mcp.test.ts --update")
    expect(out).toContain("Still marked SAMPLE: (rewrite for your service): scripts/live.sh.")
  })

  it("changes nothing while another file still imports the sample, and names it", async () => {
    const cwd = tempDir("remove-sample-new")
    await runNew(
      cwd,
      await loadSource(join(import.meta.dirname, "../..")),
      { name: "cal-cli", flags: NOTES_FLAGS },
      io(),
    )
    const dir = join(cwd, "cal-cli")
    commit(dir)
    const { steps, run } = recorder()

    await expect(runRemoveSample(dir, run)).rejects.toThrow(/src\/context\.ts imports src\/sample\/comments\.ts/)
    expect(execFileSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" })).toBe("")
    expect(steps).toEqual([])
  })

  it("needs a clean working tree, so every change it makes can be seen and undone", async () => {
    const dir = replaced()
    writeTree(dir, { "src/program.ts": `${PROGRAM}// edited\n` })

    await expect(runRemoveSample(dir, recorder().run)).rejects.toThrow("the git working tree has changes")
    expect(existsSync(join(dir, "src/sample/transport.ts"))).toBe(true)
  })

  it("runs every regeneration step and names the ones that failed", async () => {
    const dir = replaced()

    const ran: Step[] = []

    await expect(runRemoveSample(dir, (step) => ran.push(step) < 0)).rejects.toThrow(
      "these failed; fix them and run them again:\n  pnpm generate\n",
    )
    expect(ran).toEqual(REGENERATE)
  })
})
