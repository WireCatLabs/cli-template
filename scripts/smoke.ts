import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { packContents } from "@wirecat/cli-base/release"

const root = resolve(import.meta.dirname, "..")
const { name, version, files } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  name: string
  version: string
  files: string[]
}
// npm reads `files` like .gitignore: a name with no leading slash also matches the same name in any folder.
const shipped = files
  .map((entry) => entry.replace(/^\//, ""))
  .map((entry) => (statSync(join(root, entry), { throwIfNoEntry: false })?.isDirectory() ? `${entry}/` : entry))
assert.deepEqual(packContents(root, ["package.json", ...shipped], "package.json and the paths in its files list")(), [])
const temp = mkdtempSync(join(tmpdir(), "clidev-package-"))
try {
  const userConfig = join(temp, "npm-user-config")
  writeFileSync(userConfig, "")
  const npmEnv = { ...process.env, NPM_CONFIG_USERCONFIG: userConfig }
  const packed = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temp], {
      cwd: root,
      encoding: "utf8",
      env: npmEnv,
    }),
  )
  assert.equal(packed.length, 1)
  const installed = join(temp, "installed")
  mkdirSync(installed)
  execFileSync(
    "npm",
    ["install", "--prefix", installed, "--ignore-scripts", "--no-audit", "--no-fund", join(temp, packed[0].filename)],
    { encoding: "utf8", env: npmEnv, stdio: "pipe" },
  )
  const env = {
    ...process.env,
    NODE_OPTIONS: "",
    HOME: temp,
    CLIDEV_CONFIG_DIR: join(temp, "config"),
    CLIDEV_STATE_DIR: join(temp, "state"),
    CLIDEV_CACHE_DIR: join(temp, "cache"),
    WIRECAT_STATE_DIR: join(temp, "wirecat"),
    MESSAGING_STORE: join(temp, "never-owner.db"),
    CLIDEV_NO_UPDATE_CHECK: "1",
  }
  const bin = join(installed, "node_modules", name, "dist/bin/clidev.js")
  const run = (args: string[]) =>
    execFileSync(process.execPath, [bin, ...args], { cwd: temp, env, encoding: "utf8", timeout: 20000 })
  assert.equal(run(["--version"]).trim(), version)
  assert.match(run(["--help"]), /Usage: clidev/)
  const tree = JSON.parse(run(["commands", "--json"])) as { commands: { name: string }[] }
  for (const root of ["commands", "doctor", "skill", "mcp", "upgrade", "config"])
    assert.ok(
      tree.commands.some((command) => command.name === root),
      `${root} is missing from the installed package`,
    )
  assert.equal(JSON.parse(run(["doctor", "--json"])).item.version, version)
  assert.match(run(["skill", "show"]), /name: clidev-cli/)
  console.log(`installed ${name}@${version}: help, version, commands, doctor and skill answer offline`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
