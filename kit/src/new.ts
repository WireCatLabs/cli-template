import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { chmod, mkdir, readdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { createInterface } from "node:readline/promises"
import type { Readable, Writable } from "node:stream"
import { promisify } from "node:util"
import {
  ask,
  choiceList,
  forCategory,
  INTERVIEW,
  labelOf,
  NAME_QUESTIONS,
  parseAnswer,
  type Question,
} from "./interview.js"
import { type CliManifest, isRecord, MANIFEST, type Names, sha256 } from "./manifest.js"
import { appNameOf, upperCommand } from "./rename.js"
import { renderTemplate, type TemplateSource } from "./source.js"
import {
  SWAGGER_PEERS,
  specKindOf,
  specSeeds,
  withApiCommand,
  withApiPermissions,
  withApiRunScope,
  withApiSkill,
  withApiSkillLink,
  withDownloadedSpec,
  withSpecPackage,
} from "./spec.js"
import { type DownloadedSpec, downloadSpec, type SpecFetch } from "./spec-url.js"

const run = promisify(execFile)

export type Io = { input: Readable; output: Writable; interactive: boolean }

export type NewArgs = { name?: string; flags: Record<string, string | undefined> }

export type Answers = Record<string, string[]>

const REFERENCES: Record<string, string[]> = {
  messenger: ["whatsapp-cli", "tg-cli", "max-cli"],
  mail: ["mail-cli"],
  files: ["ydisk", "drive-cli", "notion-cli"],
  calendar: ["gcal-cli"],
  meetings: ["zoom-cli"],
  notes: ["cli-memo"],
  crm: ["bitrix24-cli"],
}

const REFERENCE_NAMES = [...new Set(Object.values(REFERENCES).flat())]

// The reference CLIs' names are not English words, and AGENTS.md names one of them.
export const withReferenceWords = (text: string): string => {
  const config: unknown = JSON.parse(text)
  if (!isRecord(config)) throw new Error("cspell.json must be a JSON object")
  const words = Array.isArray(config.words) ? config.words : []
  return `${JSON.stringify({ ...config, words: [...new Set([...words, ...REFERENCE_NAMES])] }, null, 2)}\n`
}

export const isWireCat = (names: Names): boolean => names.package.startsWith("@wirecat/")

// The MCP Registry takes dev.wirecat/ names only from wirecat.dev's DNS key, which only WireCatLabs holds; anyone
// else signs in with GitHub, which grants io.github.<owner>/.
export const mcpNameOf = (names: Names): string =>
  isWireCat(names) ? `dev.wirecat/${names.name}` : `io.github.${names.owner}/${names.name}`

export const cliServerJson = (text: string, names: Names): string => {
  if (isWireCat(names)) return text
  const server: unknown = JSON.parse(text)
  if (!isRecord(server)) throw new Error("server.json must be a JSON object")
  const next = {
    ...server,
    name: mcpNameOf(names),
    title: names.command,
    websiteUrl: `https://github.com/${names.owner}/${names.name}#readme`,
  }
  return `${JSON.stringify(next, null, 2)}\n`
}

type MonthlyTime = { hour: number; minute: number }

// 04:01 to 05:59 UTC: after WC-CI-9's window, so it never takes a WireCat repository's minute, and off the hour,
// when GitHub delays scheduled runs most.
export const monthlyTime = (pkg: string): MonthlyTime => {
  const slot = createHash("sha256").update(pkg).digest().readUInt32BE(0) % 118
  return { hour: 4 + Math.floor(slot / 59), minute: 1 + (slot % 59) }
}

// WC-CI-9's table of the WireCat repositories' monthly minutes, as `HH:MM → repository`; cli-dev repo-check reads
// the same table from the same file.
export const takenMinutes = (ciPage: string): Map<string, string> =>
  new Map(
    [...ciPage.matchAll(/^\s*\|\s*(\d\d:\d\d)\s*\|\s*([\w.-]+)\s*\|\s*$/gm)].map(([, time = "", repo = ""]) => [
      time,
      repo,
    ]),
  )

const WIRECAT_WINDOW = { from: 2 * 60 + 17, to: 3 * 60 + 20 }

const hhmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

// A repository already in the table keeps its minute; a new one takes a free minute picked by its name, two minutes
// from any other so the runs do not overlap, and off the hour, when GitHub delays scheduled runs most.
export const wirecatMonthlyTime = (repo: string, taken: Map<string, string>): MonthlyTime => {
  const window = Array.from({ length: WIRECAT_WINDOW.to - WIRECAT_WINDOW.from + 1 }, (_, i) => WIRECAT_WINDOW.from + i)
  const free = window.filter((slot) => slot % 60 !== 0 && [-1, 0, 1].every((step) => !taken.has(hhmm(slot + step))))
  const slot =
    window.find((value) => taken.get(hhmm(value)) === repo) ??
    free[createHash("sha256").update(repo).digest().readUInt32BE(0) % free.length]
  if (slot === undefined) throw new Error("WC-CI-9's window has no free monthly minute left; ask in cli-base")
  return { hour: Math.floor(slot / 60), minute: slot % 60 }
}

const cliBaseFile = (path: string): string =>
  readFileSync(join(dirname(createRequire(import.meta.url).resolve("@wirecat/cli-base")), "..", path), "utf8")

const ciPage = (): string => cliBaseFile("docs/standards/ci.md")

const MONTHLY_FILE = ".github/workflows/monthly.yml"

export const withMonthlyTime = (text: string, time: MonthlyTime): string => {
  const cron = /cron: "\d+ \d+ 1 \* \*"/
  if (!cron.test(text)) throw new Error(`${MONTHLY_FILE}: no monthly cron to rewrite`)
  return text.replace(cron, `cron: "${time.minute} ${time.hour} 1 * *"`)
}

// repo-check fails a CLI in no parity group, and a new CLI is in none of cli-base's PARITY_GROUPS yet; this is the
// template's own group, which every CLI made from it passes.
export const parityGroups = (command: string): unknown[] => [
  {
    name: command,
    members: [command, "tg", "max", "memo", "drive", "zm", "wa"],
    covers: ["commands", "upgrade"],
    differences: [],
  },
]

const STEMMED = ["en", "ru", "es"]
// Parakeet v3's languages, from cli-core's speech model list.
const PARAKEET = "bg cs da de el en es et fi fr hr hu it lt lv mt nl pl pt ro ru sk sl sv uk".split(" ")

const baseLang = (code: string): string => code.split("-")[0] ?? code

export const speechModels = (languages: string[]): string[] | undefined => {
  const bases = languages.map(baseLang)
  if (bases.length > 0 && bases.every((lang) => lang === "ru")) return ["gigaam-v3", "gigaam-v3-ctc", "parakeet-v3"]
  if (bases.length > 0 && bases.every((lang) => PARAKEET.includes(lang))) return ["parakeet-v3"]
  return undefined
}

// Speech models transcribe voice messages, so only a messenger needs them.
export const languageWarnings = (languages: string[], messenger: boolean): string[] =>
  languages.flatMap((lang) => [
    ...(STEMMED.includes(baseLang(lang))
      ? []
      : [`${lang}: cli-core has no search stemmer for it; search matches whole words only`]),
    ...(messenger && !PARAKEET.includes(baseLang(lang)) ? [`${lang}: no speech model in cli-core hears it`] : []),
  ])

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

const NAME_QUESTION: Question = {
  key: "name",
  flag: "name",
  text: "The folder (and repository) name, e.g. gcal-cli",
  check: (value) => (NAME_PATTERN.test(value) ? undefined : "lowercase letters, digits, dots and dashes"),
}

const DESCRIPTION = "A new WireCat CLI, started from cli-template"
const TAGLINE_MAX = 55
const ONE_LINE = /^\S(?:[^\n\r]*\S)?$/

export const taglineOf = (description: string): string => {
  const text = description.trim().replace(/\.$/, "")
  const line = text.charAt(0).toUpperCase() + text.slice(1)
  if (line.length <= TAGLINE_MAX) return line
  const cut = line.slice(0, TAGLINE_MAX + 1)
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:—-]+$/, "")
}

export const TAGLINE_QUESTION: Question = {
  key: "tagline",
  flag: "tagline",
  text: `The line WireCat Desktop shows for the tool, at most ${TAGLINE_MAX} characters`,
  check: (value) =>
    value.length <= TAGLINE_MAX && ONE_LINE.test(value) ? undefined : `one line of at most ${TAGLINE_MAX} characters`,
  fallback: taglineOf(DESCRIPTION),
}

const collect = async (args: NewArgs, io: Io): Promise<{ names: Names; answers: Answers }> => {
  const questions = [NAME_QUESTION, ...NAME_QUESTIONS, TAGLINE_QUESTION, ...INTERVIEW]
  const given: Record<string, string | undefined> = { ...args.flags, name: args.name }
  const answers: Answers = {}
  const missing: Question[] = []
  for (const question of questions) {
    const raw = given[question.flag]
    if (raw === undefined && question.fallback && !io.interactive) {
      answers[question.key] = [question.fallback]
      continue
    }
    if (raw === undefined) {
      missing.push(question)
      continue
    }
    const { value, error } = parseAnswer(question, raw)
    if (error) throw new Error(question === NAME_QUESTION ? `<name>: ${error.replace(/^--name: /, "")}` : error)
    answers[question.key] = value ?? []
  }
  if (missing.length > 0 && !io.interactive) {
    const lines = missing.map((question) =>
      question === NAME_QUESTION
        ? "  <name>: the folder to create"
        : `  --${question.flag}: ${choiceList(forCategory(question, answers.category?.[0]))}`,
    )
    throw new Error(`no terminal to ask in, and these answers are missing:\n${lines.join("\n")}`)
  }
  if (missing.length > 0) {
    const rl = createInterface({ input: io.input, output: io.output, terminal: false })
    try {
      for (const question of missing) {
        answers[question.key] = await ask(rl, io.output, forCategory(question, answers.category?.[0]))
      }
    } finally {
      rl.close()
    }
  }
  const one = (key: string) => answers[key]?.[0] ?? ""
  return {
    names: {
      name: one("name"),
      command: one("command"),
      package: one("package"),
      owner: one("owner"),
    },
    answers,
  }
}

const isEmptyOrMissing = async (dir: string): Promise<boolean> =>
  readdir(dir).then(
    (entries) => entries.length === 0,
    () => true,
  )

const referenceLine = (category: string): string => {
  const refs = REFERENCES[category]
  if (!refs) {
    return "No reference CLI for this category yet: pick the nearest one with the owner from the Reference CLIs page."
  }
  const [first, ...rest] = refs
  const link = (repo: string) => `[${repo}](https://github.com/WireCatLabs/${repo})`
  return `Learn from ${link(first ?? "")}${rest.length ? `, then ${rest.map(link).join(" and ")}` : ""}.`
}

const START = "<!-- cli-template:reference-cli:start -->"
const END = "<!-- cli-template:reference-cli:end -->"

export const withReference = (agents: string, category: string): string => {
  const block = `${START}\n## Reference CLI\n\n${referenceLine(category)}\n${END}`
  const start = agents.indexOf(START)
  const end = agents.indexOf(END)
  if (start >= 0 && end > start) return agents.slice(0, start) + block + agents.slice(end + END.length)
  return `${agents.replace(/\n*$/, "")}\n\n${block}\n`
}

export const designDoc = (names: Names, answers: Answers): string => {
  const rows = INTERVIEW.map(
    (question) =>
      `- **${question.title ?? question.text}:** ${(answers[question.key] ?? []).map((value) => labelOf(question, value)).join(", ")}`,
  )
  const languages = answers.contentLang ?? []
  const messenger = answers.category?.[0] === "messenger"
  const speech = speechModels(languages)
  const warnings = languageWarnings(languages, messenger)
  return [
    `# ${names.command} — design`,
    "",
    `Written by \`npx @wirecat/cli-template new\`. The agent reads it first, asks the further questions the reference CLI`,
    "does not answer, and starts building only after the owner has read it.",
    "",
    "## First task",
    "",
    "Delete this section once every step is done (WC-DOC-3).",
    "",
    "1. If an answer below is missing, ask the owner the [design interview](skills/design-interview/SKILL.md).",
    '2. Learn how a command reaches a service from the sample (`AGENTS.md`, "The sample"), and the domain, the',
    "   store and its commands from the reference CLI below. Build the first command on the sample.",
    "3. Ask the further questions in the interview that the reference CLI does not answer, and write the answers here.",
    "   Build only after the owner has read this page.",
    "4. When the first command reaches the service, rewrite `README.md`, `docs/index.md` and the description in",
    `   \`package.json\` and \`skills/${appNameOf(names)}/SKILL.md\` to say what the tool does and who it is for. Rewrite`,
    "   `appMcpCommand`'s `name` and `untrusted` in `src/program.ts` too: name the kinds of outside text the CLI",
    "   carries (WC-MCP-11). Rewrite the tagline and the sign-in texts of `DESKTOP` in `src/identity.ts`, then run",
    "   `pnpm generate`: WireCat Desktop shows them before it installs the tool.",
    "",
    "## Answers",
    "",
    ...rows,
    "",
    "## Reference CLI",
    "",
    referenceLine(answers.category?.[0] ?? ""),
    "",
    "## Content languages",
    "",
    `Languages: ${languages.join(", ")}.`,
    ...(messenger
      ? [
          speech
            ? `Set the messenger's \`speechModels\` to ${speech.map((model) => `\`${model}\``).join(", ")}.`
            : "No speech model in cli-core covers all of these languages: leave `speechModels` out.",
        ]
      : []),
    ...warnings.map((warning) => `- ${warning}`),
    "",
    "## Further answers",
    "",
    "## Open questions for the owner",
    "",
  ].join("\n")
}

const removeKit = (command: string): string =>
  command
    .split(" && ")
    .filter((part) => !/\bkit[:/]/.test(part))
    .join(" && ")

// contracts/wirecat.json is what WireCat Desktop reads out of the tarball before it installs the CLI (WC-CMD-29).
const CLI_FILES = ["dist", "skills", "contracts/wirecat.json", "/README.md", "CHANGELOG.md", "LICENSE"]

export const cliPackageJson = (text: string, names: Names): string => {
  const pkg: unknown = JSON.parse(text)
  if (!isRecord(pkg)) throw new Error("package.json must be a JSON object")
  const isKit = (value: unknown) => typeof value === "string" && /^(\.\/)?kit(\/|$)/.test(value)
  const repoUrl = `git+https://github.com/${names.owner}/${names.name}.git`
  const next: Record<string, unknown> = {
    ...pkg,
    name: names.package,
    version: "0.0.0",
    description: DESCRIPTION,
  }
  const bin = typeof pkg.bin === "object" && pkg.bin ? pkg.bin : {}
  next.bin = {
    ...Object.fromEntries(Object.entries(bin).filter(([, value]) => !isKit(value))),
    [names.command]: `dist/bin/${names.command}.js`,
    [`wcat-${names.command}`]: `dist/bin/${names.command}.js`,
  }
  // The template's own list ships the skeleton's sources for `new` to copy; a CLI ships what runs (WC-REL-16).
  if (Array.isArray(pkg.files)) next.files = CLI_FILES
  if (isRecord(pkg.scripts)) {
    next.scripts = Object.fromEntries(
      Object.entries(pkg.scripts)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && !entry[0].startsWith("kit:"))
        .map(([key, value]) => [key, removeKit(value)] as const)
        .filter(([, value]) => value.length > 0),
    )
  }
  if (isRecord(next.scripts)) next.scripts = withManifestSteps(next.scripts)
  // The template converts Swagger only to test its seed; new adds the converter back for --spec swagger.
  // The kit reads a YAML description with it; a CLI needs it only to generate, so withSpecPackage adds it there.
  if (isRecord(pkg.dependencies))
    next.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).filter(([name]) => name !== "yaml"))
  if (isRecord(pkg.devDependencies))
    next.devDependencies = Object.fromEntries(
      Object.entries(pkg.devDependencies).filter(([name]) => !SWAGGER_PEERS.includes(name)),
    )
  if (pkg.repository) next.repository = { type: "git", url: repoUrl }
  if (pkg.homepage) next.homepage = `https://github.com/${names.owner}/${names.name}#readme`
  if (pkg.bugs) next.bugs = { url: `https://github.com/${names.owner}/${names.name}/issues` }
  if (pkg.author && !isWireCat(names)) next.author = names.owner
  // The registry checks that the npm package names the server.json it is published with.
  next.mcpName = mcpNameOf(names)
  return `${JSON.stringify(next, null, 2)}\n`
}

// The template's own package.json installs no clidev program for cli-dev manifest to name, so only a CLI runs it.
const MANIFEST_STEP = "cli-dev manifest --program dist/program.js --identity dist/wcat.js"
const MANIFEST_STEPS: Record<string, string> = {
  generate: MANIFEST_STEP,
  "generate:check": `${MANIFEST_STEP} --check`,
  "contracts:check": `${MANIFEST_STEP} --check`,
}

const withManifestSteps = (scripts: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(scripts).map(([key, value]) => {
      const step = MANIFEST_STEPS[key]
      return [key, step && typeof value === "string" ? `${value} && ${step}` : value]
    }),
  )

const VERSION_FILE = "src/version.ts"

export const withCopyrightHolder = (text: string, holder: string, year: number): string => {
  const line = /^Copyright \(c\) \d{4} .+$/m
  if (!line.test(text)) throw new Error("LICENSE: no copyright line to rewrite")
  return text.replace(line, `Copyright (c) ${year} ${holder}`)
}

const signInTexts = (command: string, signIn: string): { gives: string; asks: string } | undefined => {
  if (signIn === "none") return undefined
  const asks: Record<string, string> = {
    oauth: "Signing in to the service in the browser, to allow access.",
    token: "An API token or key from the service.",
    session: "A sign-in code or QR code from the service's app.",
  }
  return {
    gives: `Lets your agent read and change your account through ${command}.`,
    asks: asks[signIn] ?? "The sign-in the service asks for.",
  }
}

export const withDesktopTexts = (text: string, command: string, tagline: string, signIn: string): string => {
  const taglineLine = /^ {2}tagline: .*,$/m
  const block = /^ {2}signIn: \{\n[\s\S]*?\n {2}\},\n/m
  if (!taglineLine.test(text) || !block.test(text))
    throw new Error(`${IDENTITY_FILE}: no tagline and signIn to rewrite`)
  const texts = signInTexts(command, signIn)
  const signInBlock = texts
    ? `  signIn: {\n    gives: ${JSON.stringify(texts.gives)},\n    asks: ${JSON.stringify(texts.asks)},\n  },\n`
    : ""
  return text.replace(taglineLine, `  tagline: ${JSON.stringify(tagline)},`).replace(block, signInBlock)
}
const IDENTITY_FILE = "src/identity.ts"

// The downloaded description's servers, beside the sample's while the sample stays (WC-CMD-32).
export const withHosts = (text: string, hosts: readonly string[]): string => {
  if (!hosts.length) return text
  const line = /^( {2}hosts: )\[(.*)\],$/m
  const match = line.exec(text)
  if (!match) throw new Error(`${IDENTITY_FILE}: no hosts to add the API's servers to`)
  const listed = JSON.parse(`[${match[2] ?? ""}]`) as string[]
  return text.replace(line, `$1${JSON.stringify([...new Set([...listed, ...hosts])]).replaceAll(",", ", ")},`)
}

export const withContentLanguages = (text: string, languages: readonly string[]): string => {
  const match = /export const IDENTITY: AppIdentity = \{\n[\s\S]*?\n\}/.exec(text)
  if (!match) throw new Error(`${IDENTITY_FILE}: no IDENTITY object to add contentLanguages to`)
  const end = match.index + match[0].length - 1
  const line = `  contentLanguages: [${languages.map((code) => JSON.stringify(code)).join(", ")}],\n`
  return text.slice(0, end) + line + text.slice(end)
}

// cli-core treats an unset or true `messenger` as a messenger and speaks of chats; the template says false.
export const withMessenger = (text: string, category: string): string =>
  category === "messenger" ? text.replace(/^ {2}messenger: false,$/m, "  messenger: true,") : text

export const cliReadme = (names: Names): string =>
  [
    `# ${names.command}`,
    "",
    `\`${names.command}\` is a WireCat command-line tool, started from`,
    "[cli-template](https://github.com/WireCatLabs/cli-template). Its design is in",
    "[docs/dev/DESIGN.md](docs/dev/DESIGN.md).",
    "",
    "## Quick start",
    "",
    "```sh",
    "pnpm install",
    "pnpm build",
    `node dist/bin/${names.command}.js doctor`,
    "```",
    "",
    `\`doctor\` needs no profile. Every command that uses an account starts with one, a name you choose: \`${names.command} personal config show\`.`,
    "",
  ].join("\n")

// The template's own security links point at cli-template, where a report about the template belongs; the placeholder
// repository does not exist. A CLI's copy names its own repository.
const TEMPLATE_REPOSITORY = "https://github.com/WireCatLabs/cli-template/"
const ownRepository = (names: Names) => (text: string) =>
  text.replaceAll(TEMPLATE_REPOSITORY, `https://github.com/${names.owner}/${names.name}/`)

export const cliChangelog = (names: Names, source: TemplateSource): string =>
  [
    "# Changelog",
    "",
    `Notable changes to \`${names.package}\`. One section per version, newest first.`,
    "",
    "## Unreleased",
    "",
    "### Added",
    "",
    `- Started from \`${source.name}\` ${source.version}.`,
    "",
  ].join("\n")

const writeOut = async (dir: string, path: string, content: Buffer | string, mode = 0o644): Promise<void> => {
  const full = join(dir, path)
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, content)
  await chmod(full, mode)
}

// Git for Windows sets core.fileMode=false, so a later `git add -A` there records every file as 644; a mode set
// in the index survives that add.
export const markExecutable = async (cwd: string, paths: string[]): Promise<void> => {
  if (paths.length) await run("git", ["add", "--chmod=+x", "--", ...paths], { cwd })
}

export const manualSteps = (names: Names, dir: string): string[] => [
  `1. After the first commit, run node ${join(dir, "bin/setup-github")}: it creates ${names.owner}/${names.name}, main's ruleset and the npm environment, and asks first. Add any secrets CI needs.`,
  `2. Before each release, the first too: replace the sample's reads and its "# Needs:" lines in scripts/live.sh, store the test account's token once with secret-tool store --label="${names.command} live check" service ${appNameOf(names)}-live account <account>, and run ${join(dir, "bin/live")} <account> on the release pull request's branch: it commits the record there and names it under Conformance (WC-REL-17).`,
  `3. Once the first release pull request is merged, publish it from main with ${join(dir, "bin/release")} --first; it then says how to set npm trusted publishing (WC-REL-11). Every later release is bin/release.`,
  ...(isWireCat(names)
    ? [
        "4. Join WireCat's shared lists with the entries below: one pull request to cli-base (the monthly minute in WC-CI-9's table, the command in PARITY_GROUPS' all group), one to cli-core's WIRECAT_TOOLS, and after the first release one to cli-docs' tools.json.",
      ]
    : []),
  "CI's repo-setup job (cli-dev repo-check) fails until step 1 is done.",
]

// Names the service's own tools already use. A CLI with the same environment prefix reads their token as its own; one
// with the same keyring service overwrites their sign-in. Each entry names where it was seen.
const TAKEN_PREFIXES: Record<string, string> = {
  // notion-cli BUG-759 (cli-factory plan, notion lessons).
  NOTION: "Notion's MCP server reads NOTION_TOKEN",
  // The cli-factory plan, 6.3.6.
  HUBSPOT: "HubSpot's own tools read HUBSPOT_ variables",
  // https://cli.github.com/manual/gh_help_environment
  GH: "GitHub's gh reads GH_TOKEN",
  GITHUB: "GitHub's gh reads GITHUB_TOKEN",
}
const TAKEN_SERVICES: Record<string, string> = {
  // notion-cli RISK-2303 (cli-factory plan, notion lessons).
  "notion-cli": "Notion's ntn keeps its sign-in under the keyring service notion-cli",
}

export const nameClashes = (names: Names, files: string[]): string[] => {
  const prefix = upperCommand(names.command)
  const app = appNameOf(names)
  return [
    ...(TAKEN_PREFIXES[prefix]
      ? [
          `${prefix}_: ${TAKEN_PREFIXES[prefix]}, so ${names.command} would take its token. Pick another prefix (notion-cli uses WCNOTION): envPrefix in src/identity.ts and ${prefix}_ in ${files.join(", ")}. upgrade merges the template's own files, scripts/sandboxed.ts and docs/dev/TESTING.md, with ${prefix}_ in them: check them after each upgrade.`,
        ]
      : []),
    ...(TAKEN_SERVICES[app]
      ? [
          `keyring service ${app}: ${TAKEN_SERVICES[app]}, so a sign-in would replace it. Pick another name: appName in src/identity.ts.`,
        ]
      : []),
  ]
}

// Ready to paste; the TODO values are the ones only a person can write.
export const sharedListEntries = (names: Names, tagline: string, time: MonthlyTime): string[] => {
  const tool = [
    "{",
    `  command: ${JSON.stringify(names.command)},`,
    `  appName: ${JSON.stringify(appNameOf(names))},`,
    `  envPrefix: ${JSON.stringify(upperCommand(names.command))},`,
    `  package: ${JSON.stringify(names.package)},`,
    `  does: ${JSON.stringify(tagline)},`,
    "},",
  ]
  const docs = JSON.stringify(
    {
      name: names.command,
      displayName: "TODO: the service's name",
      repo: `${names.owner}/${names.name}`,
      package: names.package,
      lang: "en",
      docsRef: "TODO: the first release's tag, e.g. v0.1.0",
      summary: { en: tagline, ru: "TODO", es: "TODO" },
    },
    null,
    2,
  ).split("\n")
  return [
    "cli-base docs/standards/ci.md, WC-CI-9's table of taken minutes:",
    `  | ${hhmm(time.hour * 60 + time.minute)} | ${names.name} |`,
    "cli-core src/ports/wirecat-tools.ts, WIRECAT_TOOLS:",
    ...tool.map((line) => `  ${line}`),
    "cli-docs tools.json:",
    ...docs.map((line) => `  ${line}`),
  ]
}

const specFromUrl = async (args: NewArgs, fetch: SpecFetch | undefined): Promise<DownloadedSpec | undefined> => {
  const url = args.flags["spec-url"]
  if (url === undefined) return undefined
  const downloaded = await downloadSpec(url, fetch)
  const given = args.flags.spec
  if (given !== undefined && given !== downloaded.kind)
    throw new Error(
      `--spec ${given}: ${downloaded.url} is ${downloaded.kind === "swagger" ? "Swagger 2.0" : "OpenAPI 3"}`,
    )
  return downloaded
}

export const runNew = async (
  cwd: string,
  source: TemplateSource,
  args: NewArgs,
  io: Io,
  fetch?: SpecFetch,
): Promise<string> => {
  const downloaded = await specFromUrl(args, fetch)
  const { names, answers } = await collect(
    downloaded ? { ...args, flags: { ...args.flags, spec: downloaded.kind } } : args,
    io,
  )
  const target = join(cwd, names.name)
  if (!(await isEmptyOrMissing(target))) throw new Error(`${target} already exists and is not empty`)
  const rendered = await renderTemplate(source, names)
  const category = answers.category?.[0] ?? ""
  const time = isWireCat(names) ? wirecatMonthlyTime(names.name, takenMinutes(ciPage())) : monthlyTime(names.package)
  const spec = specKindOf(answers.spec?.[0])
  const rewrites: Record<string, (text: string) => string> = {
    "package.json": (text) =>
      spec
        ? withSpecPackage(
            cliPackageJson(text, names),
            spec,
            spec === "swagger" ? JSON.parse(cliBaseFile("package.json")) : {},
            JSON.parse(text).dependencies?.yaml,
          )
        : cliPackageJson(text, names),
    ...(spec
      ? {
          "src/program.ts": withApiCommand,
          "src/config.ts": (text: string) => withApiPermissions(text, downloaded?.title),
          "scripts/commands.ts": withApiSkill,
          "src/run-scope.test.ts": withApiRunScope,
        }
      : {}),
    "README.md": () => cliReadme(names),
    "SECURITY.md": ownRepository(names),
    "docs/security.md": ownRepository(names),
    "CHANGELOG.md": () => cliChangelog(names, source),
    [VERSION_FILE]: (text) => text.replace(/VERSION = "[^"]*"/, 'VERSION = "0.0.0"'),
    [IDENTITY_FILE]: (text) =>
      withHosts(
        withDesktopTexts(
          withMessenger(withContentLanguages(text, answers.contentLang ?? []), category),
          names.command,
          answers.tagline?.[0] ?? "",
          answers.signIn?.[0] ?? "none",
        ),
        downloaded?.hosts ?? [],
      ),
    "AGENTS.md": (text) => withReference(text, category),
    "cspell.json": withReferenceWords,
    ...(isWireCat(names)
      ? {}
      : { LICENSE: (text: string) => withCopyrightHolder(text, names.owner, new Date().getFullYear()) }),
    "server.json": (text) => cliServerJson(text, names),
    [MONTHLY_FILE]: (text) => withMonthlyTime(text, time),
  }
  const hashes: Record<string, string> = {}
  const prefixed: string[] = []
  const agentSkill = `skills/${appNameOf(names)}/SKILL.md`
  for (const [path, file] of rendered) {
    if (file.kind === "file") hashes[path] = sha256(file.content)
    const rewrite = rewrites[path] ?? (spec && path === agentSkill ? withApiSkillLink : undefined)
    const content = rewrite ? rewrite(file.content.toString("utf8")) : file.content
    if (content.includes(`${upperCommand(names.command)}_`)) prefixed.push(path)
    await writeOut(target, path, content, file.mode)
  }
  if (spec) {
    const seeds = await specSeeds(source, names, spec)
    for (const [path, content] of downloaded ? withDownloadedSpec(seeds, names, downloaded) : seeds) {
      if (rendered.has(path)) throw new Error(`the ${spec} seed ${path} would replace a template file`)
      if (content.includes(`${upperCommand(names.command)}_`)) prefixed.push(path)
      await writeOut(target, path, content)
    }
  }
  if (!rendered.has("AGENTS.md")) await writeOut(target, "AGENTS.md", withReference("", category))
  await writeOut(target, "docs/dev/DESIGN.md", designDoc(names, answers))
  await writeOut(target, "config/parity-groups.json", `${JSON.stringify(parityGroups(names.command), null, 2)}\n`)
  const manifest: CliManifest = {
    template: source.name,
    version: source.version,
    names,
    files: hashes,
    seeds: source.manifest.seeds,
  }
  await writeOut(target, MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  await run("git", ["init", "-q", "-b", "main"], { cwd: target })
  await markExecutable(
    target,
    [...rendered].filter(([, file]) => file.mode & 0o111).map(([path]) => path),
  )
  const warnings = languageWarnings(answers.contentLang ?? [], category === "messenger")
  const clashes = nameClashes(names, prefixed)
  return [
    `Created ${target} from ${source.name}@${source.version}.`,
    ...(downloaded
      ? [
          `Downloaded ${downloaded.title}, ${downloaded.operations} operations, into spec/${names.command}/${downloaded.file}; pnpm generate makes one command of each.`,
          ...downloaded.patches.map((patch) => `  Recorded in scripts/spec-model.ts: ${patch.reason}.`),
        ]
      : []),
    ...(clashes.length ? ["", "Names the service's own tools use:", ...clashes.map((clash) => `  ${clash}`)] : []),
    ...(warnings.length ? ["", "Content languages:", ...warnings.map((warning) => `  ${warning}`)] : []),
    "",
    "Next:",
    `  cd ${names.name}`,
    "  pnpm install",
    "  pnpm lint:fix",
    "  pnpm generate",
    ...(spec
      ? [
          "  pnpm exec cli-contract contracts/plan.json --update",
          "  pnpm exec vitest run src/mcp.test.ts --update",
          "  pnpm lint:fix",
        ]
      : []),
    "  pnpm ci:quick",
    "  git add -A",
    '  git commit -m "chore: start from @wirecat/cli-template"',
    `  then give the agent docs/dev/DESIGN.md; every account command passes a profile, e.g. ${names.command} personal config show`,
    "",
    "Steps that need a person:",
    ...manualSteps(names, target).map((step) => `  ${step}`),
    ...(isWireCat(names)
      ? [
          "",
          "Entries for step 4:",
          ...sharedListEntries(names, answers.tagline?.[0] ?? "", time).map((line) => `  ${line}`),
        ]
      : []),
    "",
  ].join("\n")
}
