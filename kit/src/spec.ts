import { readdir, readFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import type { Names } from "./manifest.js"
import { isRecord } from "./manifest.js"
import { renameContent, renamer } from "./rename.js"
import type { TemplateSource } from "./source.js"

export const SPEC_KINDS = ["openapi", "swagger", "discovery"] as const
export type SpecKind = (typeof SPEC_KINDS)[number]

export const specKindOf = (answer: string | undefined): SpecKind | undefined =>
  SPEC_KINDS.find((kind) => kind === answer)

const SEEDS = "kit/seeds"

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : Promise.resolve([join(dir, entry.name)]),
    ),
  )
  return nested.flat()
}

/** The api group's files for one kind of description: its spec, sync and model, the generator, command and test. */
export const specSeeds = async (source: TemplateSource, names: Names, kind: SpecKind): Promise<Map<string, Buffer>> => {
  const rename = renamer(source.manifest.placeholders, names)
  const files = new Map<string, Buffer>()
  for (const part of ["shared", kind === "discovery" ? "" : "openapi-scripts", kind].filter(Boolean)) {
    const dir = join(source.root, SEEDS, part)
    for (const full of await walk(dir)) {
      const path = relative(dir, full).split(sep).join("/")
      files.set(rename(path), renameContent(rename, await readFile(full)))
    }
  }
  return files
}

const GENERATE = "node --experimental-strip-types scripts/generate.ts"

// upgradeToOpenApi3 converts through two optional peers of cli-base; the CLI pins the versions cli-base tests with.
const SWAGGER_PEERS = ["@scalar/openapi-upgrader", "swagger-converter"]

export const withSpecPackage = (text: string, kind: SpecKind, cliBase: Record<string, unknown>): string => {
  const pkg: unknown = JSON.parse(text)
  if (!isRecord(pkg) || !isRecord(pkg.scripts)) throw new Error("package.json must have scripts")
  const scripts = pkg.scripts
  const step = (key: string, first: string) => {
    if (typeof scripts[key] !== "string") throw new Error(`package.json has no "${key}" script to put the API step in`)
    scripts[key] = `${first} && ${scripts[key]}`
  }
  step("generate", GENERATE)
  step("generate:check", `${GENERATE} --check`)
  scripts["spec:sync"] = "node --experimental-strip-types scripts/sync-spec.ts"
  if (kind === "swagger") {
    const pinned = isRecord(cliBase.devDependencies) ? cliBase.devDependencies : {}
    const peers = Object.fromEntries(SWAGGER_PEERS.map((name) => [name, pinned[name]]))
    const missing = SWAGGER_PEERS.filter((name) => typeof peers[name] !== "string")
    if (missing.length) throw new Error(`cli-base pins no ${missing.join(", ")}, which Swagger needs`)
    pkg.devDependencies = { ...(isRecord(pkg.devDependencies) ? pkg.devDependencies : {}), ...peers }
  }
  return `${JSON.stringify(pkg, null, 2)}\n`
}

const replaceOnce = (file: string, text: string, from: string | RegExp, to: string): string => {
  const next = text.replace(from, to)
  if (next === text) throw new Error(`${file}: no ${String(from)} to put the api group beside`)
  return next
}

export const withApiCommand = (text: string): string =>
  replaceOnce(
    "src/program.ts",
    replaceOnce(
      "src/program.ts",
      text,
      'import { sessionCommand } from "./commands/session.js"\n',
      'import { apiCommand } from "./commands/api.js"\nimport { sessionCommand } from "./commands/session.js"\n',
    ),
    /^( +)sessionCommand\(\),\n/m,
    "$1sessionCommand(),\n$1apiCommand(),\n",
  )

export const withApiPermissions = (text: string): string =>
  [
    [
      'import { type Configuration, commandPermissions, settingsFor } from "@wirecat/cli-core/cli"\n',
      'import { type Configuration, commandPermissions, serviceApiPermissions, settingsFor } from "@wirecat/cli-core/cli"\nimport { operations } from "./generated/manifest.js"\n',
    ],
    [
      "export const permissions = commandPermissions()\n",
      [
        "// SAMPLE: your service's name, and the key every delete through `api` also checks, so denying it holds there as",
        "// over your own commands.",
        'export const API = { operations, deleteKey: "comments.delete", service: "Example Comments" }',
        "",
        "export const permissions = commandPermissions(serviceApiPermissions(API))",
        "",
      ].join("\n"),
    ],
  ].reduce((rest, [from = "", to = ""]) => replaceOnce("src/config.ts", rest, from, to), text)

export const AGENT_SKILL = /^skills\/[^/]+\/SKILL\.md$/

// apiSkillFiles refuses a skill that does not link its index: an agent reaches the API pages only through that link.
export const withApiSkillLink = (text: string): string =>
  replaceOnce(
    "the agent skill",
    text,
    /^(- `(\S+) doctor --json` says what is set up on this computer\.\n)/m,
    "$1- `$2 skill show api` lists the service's raw API, one command per operation, in groups: [references/api.md](references/api.md).\n",
  )

export const withApiSkill = (text: string): string =>
  [
    [
      'import { resolve } from "node:path"\nimport { writeArtifacts } from "@wirecat/cli-base/codegen"\n',
      [
        'import { readFileSync } from "node:fs"',
        'import { dirname, relative, resolve } from "node:path"',
        'import { fileURLToPath } from "node:url"',
        'import { apiSkillFiles, writeArtifacts } from "@wirecat/cli-base/codegen"',
        'import { skillFiles } from "@wirecat/cli-base/skill"',
        "",
      ].join("\n"),
    ],
    [
      'import { IDENTITY } from "../dist/identity.js"\n',
      'import { API } from "../dist/config.js"\nimport { IDENTITY, SKILL } from "../dist/identity.js"\n',
    ],
    [
      "const stale = writeArtifacts(artifacts, { root, check })\n",
      [
        "const skillFolder = relative(root, dirname(fileURLToPath(SKILL)))",
        "artifacts.push(",
        "  ...apiSkillFiles({",
        "    cli: IDENTITY.command,",
        "    folder: skillFolder,",
        "    files: skillFiles(SKILL),",
        "    service: API.service,",
        "    operations: API.operations,",
        '    skill: readFileSync(SKILL, "utf8"),',
        "    commands: describeProgram(program),",
        '    banner: "Generated from the API manifest and the command tree by pnpm generate. Do not edit.",',
        "  }),",
        ")",
        'const apiPages = relative(root, fileURLToPath(new URL("references/api", SKILL)))',
        "const stale = writeArtifacts(artifacts, { root, check, owns: [apiPages] })",
        "",
      ].join("\n"),
    ],
  ].reduce((rest, [from = "", to = ""]) => replaceOnce("scripts/commands.ts", rest, from, to), text)
