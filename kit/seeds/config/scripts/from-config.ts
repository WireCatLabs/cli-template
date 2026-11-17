import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseCliConfig } from "@wirecat/cli-core/manifest"
import config from "../wirecat.config.ts"

// wirecat.config.ts → src/generated/wirecat-config.ts, what the CLI reads of it at run time: the call that checks a
// token and the CRM source. src/ cannot import the config itself: it sits outside src/ and the bin is bundled.
const root = join(import.meta.dirname, "..")
const out = join(root, "src/generated/wirecat-config.ts")
if (process.argv.includes("--if-missing") && existsSync(out)) process.exit(0)

const cli = parseCliConfig(config)
const verify = cli.auth.preset === "none" ? undefined : cli.auth.verify
const literal = (value: unknown) => (value === undefined ? "undefined" : JSON.stringify(value, null, 2))
const text = [
  "// Generated from wirecat.config.ts by scripts/from-config.ts; run pnpm generate",
  "",
  `export const VERIFY: { operation: string; id: string; name?: string } | undefined = ${literal(verify)}`,
  "",
  `export const SOURCE: Readonly<Record<string, unknown>> | undefined = ${literal(cli.source)}`,
  "",
].join("\n")

if (process.argv.includes("--check")) {
  if (!existsSync(out) || readFileSync(out, "utf8") !== text) {
    process.stderr.write("Generated files are stale: src/generated/wirecat-config.ts; run pnpm generate\n")
    process.exit(1)
  }
} else writeFileSync(out, text)
