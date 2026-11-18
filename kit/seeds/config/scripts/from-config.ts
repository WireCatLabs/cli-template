import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, sep } from "node:path"
import { parseCliConfig } from "@wirecat/cli-core/manifest"
import config from "../wirecat.config.ts"

// wirecat.config.ts → src/generated/wirecat-config.ts, what the CLI reads of it at run time: the call that checks a
// token and the source. src/ cannot import the config itself: it sits outside src/ and the bin is bundled.
const root = join(import.meta.dirname, "..")
const out = join(root, "src/generated/wirecat-config.ts")
if (process.argv.includes("--if-missing") && existsSync(out)) process.exit(0)

const cli = parseCliConfig(config)
// The source is written out as JSON, which drops a function without a word: a rule that is code belongs in the hooks.
const functionsIn = (value: unknown, path: string): string[] =>
  typeof value === "function"
    ? [path]
    : value !== null && typeof value === "object"
      ? Object.entries(value).flatMap(([key, inner]) => functionsIn(inner, `${path}.${key}`))
      : []
const functions = functionsIn(cli.source, "source")
if (functions.length)
  throw new Error(
    `wirecat.config: ${functions.join(", ")}: a function cannot be written into the CLI; ` +
      "move it into the hooks module the config names in hooks (./src/hooks.ts)",
  )
const verify = cli.auth.preset === "none" ? undefined : cli.auth.verify
// A value the config leaves out is a bare `undefined`, so a command that still reads it fails typecheck, not a run.
const live = (): string[] => {
  const source = cli.source as { entities?: Record<string, { search?: unknown }>; users?: unknown } | undefined
  return [
    ...(["person", "organization"] as const).filter((kind) => source?.entities?.[kind]?.search !== undefined),
    ...(source?.users ? ["user"] : []),
  ]
}

const constant = (name: string, type: string, value: unknown) =>
  value === undefined
    ? `export const ${name} = undefined`
    : `export const ${name}: ${type} = ${JSON.stringify(value, null, 2)}`
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
    constant("VERIFY", "{ operation: string; id: string; name?: string; active?: string }", verify),
    "",
    constant(
      "SOURCE",
      "Readonly<Record<string, unknown>> & { readonly provider: string; readonly kinds: readonly string[] }",
      cli.source,
    ),
    "",
    // Spread into the source's options: `{}` without a hooks module.
    ...(hooksImport
      ? [`import { hooks } from "${hooksImport}"`, "", "export const HOOK_OPTIONS = { hooks }"]
      : cli.category === "tracker"
        ? [
            'import type { TrackerManifestHooks } from "@wirecat/cli-core/tracker"',
            "",
            "export const HOOK_OPTIONS: { hooks?: TrackerManifestHooks } = {}",
          ]
        : [
            'import type { CrmManifestHooks } from "@wirecat/cli-core/crm"',
            "",
            "export const HOOK_OPTIONS: { hooks?: CrmManifestHooks } = {}",
          ]),
    "",
    // What a CRM reads live: people and companies whose entity names a search, and its users when the source names a
    // call for them.
    ...(cli.category === "crm"
      ? [`export const LIVE: readonly ("person" | "organization" | "user")[] = ${JSON.stringify(live())}`, ""]
      : []),
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
