import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

// Two copies of cli-base in one install (another version, or the same one resolved against other peers) give the
// CLI and cli-core different error classes and registries: the packed CLI crashes or misreads errors while every
// local test passes. Each copy is its own key under the lockfile's `snapshots:`.
const lock = readFileSync(join(resolve(import.meta.dirname, ".."), "pnpm-lock.yaml"), "utf8")
const start = lock.search(/^snapshots:\r?$/m)
if (start < 0) throw new Error("pnpm-lock.yaml has no snapshots: section to count cli-base copies in")
const snapshots = lock.slice(start)
const copies = [...snapshots.matchAll(/^ {2}'?(@wirecat\/cli-base@[^':\s]+)'?:/gm)].map(([, key]) => key)
if (copies.length > 1) {
  process.stderr.write(
    `pnpm-lock.yaml installs ${copies.length} copies of @wirecat/cli-base:\n${copies.map((key) => `  ${key}`).join("\n")}\n` +
      "Pin the cli-base version cli-core asks for (pnpm why @wirecat/cli-base shows who brings each), then pnpm install.\n",
  )
  process.exitCode = 1
}
