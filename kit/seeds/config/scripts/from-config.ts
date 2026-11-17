import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, sep } from "node:path"
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
// The hooks module is imported from src/generated/, inside the bundle: it must live under src/.
const hooksImport = (() => {
  if (!cli.hooks) return undefined
  const file = join(root, cli.hooks)
  const inSrc = relative(join(root, "src"), file)
  if (inSrc.startsWith("..") || isAbsolute(inSrc))
    throw new Error(`wirecat.config: hooks: ${cli.hooks} must be under ./src/, where the bundle reaches it`)
  return relative(join(root, "src/generated"), file)
    .split(sep)
    .join("/")
    .replace(/\.([cm]?)ts$/, ".$1js")
})()
// Formatted as scripts/generate.ts formats its files, so lint and --check agree.
const formatted = (content: string) =>
  execFileSync(
    process.execPath,
    [join(root, "node_modules/@biomejs/biome/bin/biome"), "check", "--write", `--stdin-file-path=${out}`],
    { cwd: root, encoding: "utf8", input: content },
  )
const text = formatted(
  [
    "// Generated from wirecat.config.ts by scripts/from-config.ts; run pnpm generate",
    "",
    `export const VERIFY: { operation: string; id: string; name?: string } | undefined = ${literal(verify)}`,
    "",
    `export const SOURCE: Readonly<Record<string, unknown>> | undefined = ${literal(cli.source)}`,
    "",
    ...(hooksImport
      ? [`export { hooks as HOOKS } from "${hooksImport}"`]
      : [
          'import type { CrmManifestHooks } from "@wirecat/cli-core/crm"',
          "",
          "export const HOOKS: CrmManifestHooks | undefined = undefined",
        ]),
    "",
  ].join("\n"),
)

if (process.argv.includes("--check")) {
  if (!existsSync(out) || readFileSync(out, "utf8") !== text) {
    process.stderr.write("Generated files are stale: src/generated/wirecat-config.ts; run pnpm generate\n")
    process.exit(1)
  }
} else {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, text)
}
