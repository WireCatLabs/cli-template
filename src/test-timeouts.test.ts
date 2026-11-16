import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { expect, it } from "vitest"

// A --timeout a test expects the run to live through needs room for a slow Windows runner: cli-core ends a sync 5 s
// before the deadline, and notion-cli's `--timeout 6s` left one second, which failed a release. A cut that must
// fire takes at most 1 s against a fake that waits.
const CUT_MS = 1_000
const ROOM_MS = 10_000
const UNIT_MS: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }
const TIMEOUT = /--timeout(?:["'`],\s*["'`]|=|\s+)(\d+)(ms|s|m|h)\b/g

const tight = (text: string): string[] =>
  [...text.matchAll(TIMEOUT)]
    .filter(([, value = "", unit = ""]) => {
      const ms = Number(value) * (UNIT_MS[unit] ?? 1)
      return ms > CUT_MS && ms < ROOM_MS
    })
    .map(([match]) => match)

const src = import.meta.dirname
const tests = readdirSync(src, { recursive: true, encoding: "utf8" })
  .filter((path) => path.endsWith(".test.ts") && !path.endsWith("test-timeouts.test.ts"))
  .map((path) => join(src, path))

it("finds a --timeout too short to finish and too long to be a deliberate cut", () => {
  const flag = "--timeout"
  expect(tight(`run(["sync", "${flag}", "6s"])`)).toHaveLength(1)
  expect(tight(`run("sync ${flag}=2500ms")`)).toHaveLength(1)
  expect(tight(`run(["${flag}", "50ms", "${flag}", "10s", "${flag}", "10m"])`)).toEqual([])
})

it("gives every --timeout in the tests at most 1 s or at least 10 s", () => {
  const found = tests.flatMap((path) =>
    tight(readFileSync(path, "utf8")).map((match) => `${relative(src, path)}: ${match}`),
  )
  expect(found).toEqual([])
})
