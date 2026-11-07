import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { chmod, mkdir, readdir, writeFile } from "node:fs/promises"
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
import { appNameOf } from "./rename.js"
import { renderTemplate, type TemplateSource } from "./source.js"

const run = promisify(execFile)

export type Io = { input: Readable; output: Writable; interactive: boolean }

export type NewArgs = { name?: string; flags: Record<string, string | undefined> }

export type Answers = Record<string, string[]>

const REFERENCES: Record<string, string[]> = {
  messenger: ["whatsapp-cli", "tg-cli", "max-cli"],
  mail: ["mail-cli"],
  files: ["drive-cli"],
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

const isWireCat = (names: Names): boolean => names.package.startsWith("@wirecat/")

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

// 04:01 to 05:59 UTC: after WC-CI-9's window, so it never takes a WireCat repository's minute, and off the hour,
// when GitHub delays scheduled runs most.
export const monthlyTime = (pkg: string): { hour: number; minute: number } => {
  const slot = createHash("sha256").update(pkg).digest().readUInt32BE(0) % 118
  return { hour: 4 + Math.floor(slot / 59), minute: 1 + (slot % 59) }
}

const MONTHLY_FILE = ".github/workflows/monthly.yml"

export const withMonthlyTime = (text: string, pkg: string): string => {
  const cron = /cron: "\d+ \d+ 1 \* \*"/
  if (!cron.test(text)) throw new Error(`${MONTHLY_FILE}: no monthly cron to rewrite`)
  const { hour, minute } = monthlyTime(pkg)
  return text.replace(cron, `cron: "${minute} ${hour} 1 * *"`)
}

// cli-base's PARITY_GROUPS lists WireCat's CLIs only, and repo-check fails a CLI in no group; this is the template's
// own group, which every CLI made from it passes.
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

const liveStep = (step: number): string =>
  `${step}. Before each bin/release: replace the sample's reads in scripts/live.sh with your own, run it with a real token on stdin, then pnpm exec cli-dev live record --script scripts/live.sh and commit docs/dev/live-checks.txt (WC-REL-17).`

export const manualSteps = (names: Names): string[] => {
  const shared = [
    `1. Create the repository ${names.owner}/${names.name} and its main ruleset (cli-base docs/standards/new-cli.md).`,
    `2. Set npm trusted publishing for ${names.package}, naming release.yml (WC-REL-11), limit the GitHub npm environment's deployment branches to main, and add any secrets.`,
  ]
  if (!isWireCat(names)) {
    return [
      ...shared,
      liveStep(3),
      "CI's repo-setup job (cli-dev repo-check) fails until steps 1 and 2 are done; step 2's environment is checked once it exists.",
    ]
  }
  return [
    ...shared,
    "3. Give .github/workflows/monthly.yml a free cron minute from the list in cli-base docs/standards/ci.md (WC-CI-9).",
    "4. A pull request to cli-base's PARITY_GROUPS, a line in cli-core's WIRECAT_TOOLS and in cli-docs' tools.json.",
    liveStep(5),
    "CI's repo-setup job (cli-dev repo-check) fails until steps 1 to 4 are done; step 2's environment is checked once it exists.",
  ]
}

export const runNew = async (cwd: string, source: TemplateSource, args: NewArgs, io: Io): Promise<string> => {
  const { names, answers } = await collect(args, io)
  const target = join(cwd, names.name)
  if (!(await isEmptyOrMissing(target))) throw new Error(`${target} already exists and is not empty`)
  const rendered = await renderTemplate(source, names)
  const category = answers.category?.[0] ?? ""
  const rewrites: Record<string, (text: string) => string> = {
    "package.json": (text) => cliPackageJson(text, names),
    "README.md": () => cliReadme(names),
    "SECURITY.md": ownRepository(names),
    "docs/security.md": ownRepository(names),
    "CHANGELOG.md": () => cliChangelog(names, source),
    [VERSION_FILE]: (text) => text.replace(/VERSION = "[^"]*"/, 'VERSION = "0.0.0"'),
    [IDENTITY_FILE]: (text) =>
      withDesktopTexts(
        withMessenger(withContentLanguages(text, answers.contentLang ?? []), category),
        names.command,
        answers.tagline?.[0] ?? "",
        answers.signIn?.[0] ?? "none",
      ),
    "AGENTS.md": (text) => withReference(text, category),
    "cspell.json": withReferenceWords,
    "server.json": (text) => cliServerJson(text, names),
    ...(isWireCat(names) ? {} : { [MONTHLY_FILE]: (text: string) => withMonthlyTime(text, names.package) }),
  }
  const hashes: Record<string, string> = {}
  for (const [path, file] of rendered) {
    if (file.kind === "file") hashes[path] = sha256(file.content)
    const rewrite = rewrites[path]
    const content = rewrite ? rewrite(file.content.toString("utf8")) : file.content
    await writeOut(target, path, content, file.mode)
  }
  if (!rendered.has("AGENTS.md")) await writeOut(target, "AGENTS.md", withReference("", category))
  await writeOut(target, "docs/dev/DESIGN.md", designDoc(names, answers))
  if (!isWireCat(names)) {
    await writeOut(target, "config/parity-groups.json", `${JSON.stringify(parityGroups(names.command), null, 2)}\n`)
  }
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
  return [
    `Created ${target} from ${source.name}@${source.version}.`,
    ...(warnings.length ? ["", "Content languages:", ...warnings.map((warning) => `  ${warning}`)] : []),
    "",
    "Next:",
    `  cd ${names.name}`,
    "  pnpm install",
    "  pnpm lint:fix",
    "  pnpm generate",
    "  pnpm ci:quick",
    "  git add -A",
    '  git commit -m "chore: start from @wirecat/cli-template"',
    `  then give the agent docs/dev/DESIGN.md; every account command passes a profile, e.g. ${names.command} personal config show`,
    "",
    "Steps that need a person:",
    ...manualSteps(names).map((step) => `  ${step}`),
    "",
  ].join("\n")
}
