import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { removeTempDirs, tempDir } from "./fixture.js"

afterAll(removeTempDirs)

const config = join(import.meta.dirname, "../../.gitleaks.toml")

// Built at run time: a committed fake would fail CI's full-history gitleaks scan.
const random = (length: number) => randomBytes(length).toString("base64url").slice(0, length)
const TOKENS = {
  "google-oauth-access-token": `ya29.a0${random(150)}`,
  "google-oauth-refresh-token": `1//0g${random(98)}`,
}
const LOOKALIKES = ["const x = 1// a comment that runs on", 'const u = "https://example.com/1//abc"']

const ruleRegex = (id: string): RegExp => {
  const match = new RegExp(`id = "${id}"[\\s\\S]*?regex = '''(.*?)'''`).exec(readFileSync(config, "utf8"))
  if (!match?.[1]) throw new Error(`${id}: no regex in .gitleaks.toml`)
  return new RegExp(match[1])
}

const gitleaks = spawnSync("gitleaks", ["version"]).status === 0

describe(".gitleaks.toml", () => {
  it.each(Object.entries(TOKENS))("has a %s rule that matches a token with no keyword around it", (id, token) => {
    expect(ruleRegex(id).test(`const value = "${token}"`)).toBe(true)
  })

  it.each(LOOKALIKES)("does not match ordinary code: %s", (line) => {
    for (const id of Object.keys(TOKENS)) expect(ruleRegex(id).test(line)).toBe(false)
  })

  it.skipIf(!gitleaks)("makes gitleaks catch each token on its own", () => {
    for (const [id, token] of Object.entries(TOKENS)) {
      const dir = tempDir("gitleaks")
      writeFileSync(join(dir, "leak.ts"), `const value = "${token}"\n`)
      const report = join(dir, "report.json")
      const run = spawnSync("gitleaks", ["dir", "--no-banner", "-c", config, "-r", report, join(dir, "leak.ts")])
      expect(run.status, id).toBe(1)
      expect(JSON.parse(readFileSync(report, "utf8")).map((leak: { RuleID: string }) => leak.RuleID)).toEqual([id])
    }
  })
})
