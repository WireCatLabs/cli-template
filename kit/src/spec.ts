import { readdir, readFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import type { Names } from "./manifest.js"
import { isRecord } from "./manifest.js"
import { renameContent, renamer } from "./rename.js"
import type { TemplateSource } from "./source.js"
import type { DownloadedSpec } from "./spec-url.js"

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

// upgradeToOpenApi3 converts 2.0 through an optional peer of cli-base; the CLI pins the version cli-base tests with.
// Swagger 1.2 also needs swagger-converter, which the new-cli skill's openapi reference names.
export const SWAGGER_PEERS = ["@scalar/openapi-upgrader"]

export const withSpecPackage = (
  text: string,
  kind: SpecKind,
  cliBase: Record<string, unknown>,
  yaml: string | undefined,
): string => {
  const pkg: unknown = JSON.parse(text)
  if (!isRecord(pkg) || !isRecord(pkg.scripts)) throw new Error("package.json must have scripts")
  const scripts = pkg.scripts
  const step = (key: string, first: string) => {
    if (typeof scripts[key] !== "string") throw new Error(`package.json has no "${key}" script to put the API step in`)
    scripts[key] = `${first} && ${scripts[key]}`
  }
  step("generate", GENERATE)
  step("generate:check", `${GENERATE} --check`)
  // src/ imports src/generated/, which a fresh CLI does not have until it generates once.
  step("build", `${GENERATE} --if-missing`)
  step("typecheck", `${GENERATE} --if-missing`)
  scripts["spec:sync"] = "node --experimental-strip-types scripts/sync-spec.ts"
  if (kind !== "discovery") {
    if (!yaml) throw new Error("the template's package.json pins no yaml, which reads a YAML description")
    pkg.devDependencies = { ...(isRecord(pkg.devDependencies) ? pkg.devDependencies : {}), yaml }
  }
  if (kind === "swagger") {
    const pinned = isRecord(cliBase.devDependencies) ? cliBase.devDependencies : {}
    const peers = Object.fromEntries(SWAGGER_PEERS.map((name) => [name, pinned[name]]))
    const missing = SWAGGER_PEERS.filter((name) => typeof peers[name] !== "string")
    if (missing.length) throw new Error(`cli-base pins no ${missing.join(", ")}, which Swagger needs`)
    pkg.devDependencies = { ...(isRecord(pkg.devDependencies) ? pkg.devDependencies : {}), ...peers }
  }
  return `${JSON.stringify(pkg, null, 2)}\n`
}

export const replaceOnce = (file: string, text: string, from: string | RegExp, to: string): string => {
  const next = text.replace(from, to)
  if (next === text) throw new Error(`${file}: no ${String(from)} to change; the template moved it`)
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

export const withApiPermissions = (text: string, service = "Example Comments"): string =>
  [
    [
      'import { type Configuration, commandPermissions, settingsFor } from "@wirecat/cli-core/cli"\n',
      'import {\n  type Configuration,\n  commandPermissions,\n  serviceApiOperations,\n  serviceApiPermissions,\n  settingsFor,\n} from "@wirecat/cli-core/cli"\nimport * as manifest from "./generated/manifest.js"\n',
    ],
    [
      "export const permissions = commandPermissions()\n",
      [
        "// SAMPLE: your service's name. The keys a delete or a share checks come from `permissions` in",
        "// scripts/generate.ts. The operations the api group cannot offer are left out: one that answers with a",
        "// credential (the CLI signs in through `session`) and a body it cannot send, such as a multipart form.",
        "export const API = {",
        "  manifest: { ...manifest, operations: serviceApiOperations(manifest).offered },",
        `  service: ${JSON.stringify(service)},`,
        "}",
        "",
        "export const permissions = commandPermissions(serviceApiPermissions(API))",
        "",
      ].join("\n"),
    ],
  ].reduce((rest, [from = "", to = ""]) => replaceOnce("src/config.ts", rest, from, to), text)

export const withApiRunScope = (text: string): string =>
  [
    [
      'import { definition } from "./program.js"\n',
      'import { API } from "./config.js"\nimport { definition } from "./program.js"\n',
    ],
    [
      "    skip: {\n",
      [
        "    skip: {",
        "      ...Object.fromEntries(",
        "        API.manifest.operations.map((operation) => [",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: this is the generated test's own template string
        "          `api ${operation.command}`,",
        '          "cli-core\'s serviceApiCommand runs it in its run; src/api.test.ts sends each one",',
        "        ]),",
        "      ),",
        "",
      ].join("\n"),
    ],
  ].reduce((rest, [from = "", to = ""]) => replaceOnce("src/run-scope.test.ts", rest, from, to), text)

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
        "    operations: API.manifest.operations,",
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

const SAMPLE_DOCUMENTS = ["openapi.json", "swagger.json", "provenance.json"]

/** The seeds with the downloaded description in place of the sample's, its corrections, and its own permission group. */
export const withDownloadedSpec = (
  seeds: Map<string, Buffer>,
  names: Names,
  spec: DownloadedSpec,
  now = new Date(),
): Map<string, Buffer> => {
  const dir = `spec/${names.command}`
  const files = new Map([...seeds].filter(([path]) => !SAMPLE_DOCUMENTS.some((file) => path === `${dir}/${file}`)))
  const provenance = {
    sources: [{ name: names.command, url: spec.url, file: spec.file, sha256: spec.sha256 }],
    retrieved_at: now.toISOString(),
  }
  files.set(`${dir}/${spec.file}`, Buffer.from(spec.text))
  files.set(`${dir}/provenance.json`, Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`))
  const edit = (path: string, from: string, to: string) => {
    const text = files.get(path)?.toString("utf8") ?? ""
    files.set(path, Buffer.from(replaceOnce(path, text, from, to)))
  }
  edit("scripts/generate.ts", 'group: "comments"', `group: ${JSON.stringify(names.command)}`)
  if (spec.prefix.length)
    edit(
      "scripts/generate.ts",
      "names: { fromPath: true }",
      `names: { fromPath: true, segments: { ${spec.prefix.map((segment) => `${JSON.stringify(segment)}: ""`).join(", ")} } }`,
    )
  if (spec.patches.length)
    edit(
      "scripts/spec-model.ts",
      "const PATCHES: SpecPatch[] = []",
      `const PATCHES: SpecPatch[] = ${JSON.stringify(spec.patches, null, 2)}`,
    )
  return files
}

// "Notion API" names the API; the commands already add "API" after the service's name.
export const serviceOf = (title: string): string => title.replace(/\s+API$/i, "") || title

// The pages say the sample is the CLI's one service, which stops being true once the api group reaches a real one.
const SAMPLE_ONLY: Readonly<Record<string, [RegExp, (service: string) => string]>> = {
  "docs/index.md": [
    / Its one service is a sample,\nExample Comments, made up to show how a command reaches a service; its address never resolves\./,
    (service) =>
      `\nIts \`api\` group reaches ${service}, one command per operation of its API description. The sample's \`comments\`` +
      "\ngroup shows how a command reaches a service; its made-up address never resolves.",
  ],
  "docs/security.md": [
    / Its one service is\nthe sample, Example Comments, whose address never resolves\. /,
    (service) => `\nIts \`api\` group reaches ${service}; the sample's made-up address never resolves.\n`,
  ],
  SKILL: [
    / Its one service is a made-up sample, Example Comments\./,
    (service) => ` Its api group reaches ${service}.`,
  ],
}

export const withServicePage = (path: string, text: string, service: string): string => {
  const [from, to] = SAMPLE_ONLY[path.endsWith("SKILL.md") ? "SKILL" : path] ?? []
  if (!from || !to) throw new Error(`${path}: no sample sentence known to rewrite`)
  return replaceOnce(path, text, from, to(service))
}

export const withService = (text: string, service: string): string =>
  replaceOnce(
    "src/identity.ts",
    text,
    /^\/\/ SAMPLE: your service's name.*\nexport const SERVICE = .*$/m,
    `export const SERVICE = ${JSON.stringify(service)}`,
  )
