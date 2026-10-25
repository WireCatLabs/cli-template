import { execFile } from "node:child_process"
import { chmod, mkdir, readdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { createInterface } from "node:readline/promises"
import type { Readable, Writable } from "node:stream"
import { promisify } from "node:util"
import { ask, choiceList, INTERVIEW, labelOf, NAME_QUESTIONS, parseAnswer, type Question } from "./interview.js"
import { type CliManifest, MANIFEST, type Names, sha256 } from "./manifest.js"
import { PACKED_AS, renderTemplate, type TemplateSource } from "./source.js"

const run = promisify(execFile)

export type Io = { input: Readable; output: Writable; interactive: boolean }

export type NewArgs = { name?: string; flags: Record<string, string | undefined> }

export type Answers = Record<string, string[]>

const REFERENCES: Record<string, string[]> = {
  messenger: ["whatsapp-cli", "tg-cli", "max-cli"],
  files: ["drive-cli"],
  meetings: ["zoom-cli"],
  notes: ["cli-memo"],
}

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

export const languageWarnings = (languages: string[]): string[] =>
  languages.flatMap((lang) => [
    ...(STEMMED.includes(baseLang(lang))
      ? []
      : [`${lang}: cli-core has no search stemmer for it; search matches whole words only`]),
    ...(PARAKEET.includes(baseLang(lang)) ? [] : [`${lang}: no speech model in cli-core hears it`]),
  ])

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

const NAME_QUESTION: Question = {
  key: "name",
  flag: "name",
  text: "The folder (and repository) name, e.g. cal-cli",
  check: (value) => (NAME_PATTERN.test(value) ? undefined : "lowercase letters, digits, dots and dashes"),
}

const collect = async (args: NewArgs, io: Io): Promise<{ names: Names; answers: Answers }> => {
  const questions = [NAME_QUESTION, ...NAME_QUESTIONS, ...INTERVIEW]
  const given: Record<string, string | undefined> = { ...args.flags, name: args.name }
  const answers: Answers = {}
  const missing: Question[] = []
  for (const question of questions) {
    const raw = given[question.flag]
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
      question === NAME_QUESTION ? "  <name>: the folder to create" : `  --${question.flag}: ${choiceList(question)}`,
    )
    throw new Error(`no terminal to ask in, and these answers are missing:\n${lines.join("\n")}`)
  }
  if (missing.length > 0) {
    const rl = createInterface({ input: io.input, output: io.output, terminal: false })
    try {
      for (const question of missing) answers[question.key] = await ask(rl, io.output, question)
    } finally {
      rl.close()
    }
  }
  const one = (key: string) => answers[key]?.[0] ?? ""
  return {
    names: { name: one("name"), command: one("command"), package: one("package"), owner: one("owner") },
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
  const speech = speechModels(languages)
  const warnings = languageWarnings(languages)
  return [
    `# ${names.command} — design`,
    "",
    `Written by \`npx @wirecat/cli-template new\`. The agent reads it first, asks the further questions the reference CLI`,
    "does not answer, and starts building only after the owner has read it.",
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
    speech
      ? `If this CLI defines a messenger, set its \`speechModels\` to ${speech.map((model) => `\`${model}\``).join(", ")}.`
      : "No speech model in cli-core covers all of these languages: leave `speechModels` out.",
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

export const cliPackageJson = (text: string, names: Names): string => {
  const pkg = JSON.parse(text) as Record<string, unknown>
  const isKit = (value: unknown) => typeof value === "string" && /^(\.\/)?kit(\/|$)/.test(value)
  const repoUrl = `git+https://github.com/${names.owner}/${names.name}.git`
  const next: Record<string, unknown> = { ...pkg, name: names.package, version: "0.0.0" }
  const bin = typeof pkg.bin === "object" && pkg.bin ? pkg.bin : {}
  next.bin = {
    ...Object.fromEntries(Object.entries(bin).filter(([, value]) => !isKit(value))),
    [names.command]: `dist/bin/${names.command}.js`,
  }
  if (Array.isArray(pkg.files))
    next.files = pkg.files.filter((entry) => !isKit(entry) && !Object.values(PACKED_AS).includes(entry))
  if (typeof pkg.scripts === "object" && pkg.scripts) {
    next.scripts = Object.fromEntries(
      Object.entries(pkg.scripts as Record<string, string>)
        .filter(([key]) => !key.startsWith("kit:"))
        .map(([key, value]) => [key, removeKit(value)] as const)
        .filter(([, value]) => value.length > 0),
    )
  }
  if (pkg.repository) next.repository = { type: "git", url: repoUrl }
  if (pkg.homepage) next.homepage = `https://github.com/${names.owner}/${names.name}#readme`
  if (pkg.bugs) next.bugs = { url: `https://github.com/${names.owner}/${names.name}/issues` }
  return `${JSON.stringify(next, null, 2)}\n`
}

const VERSION_FILE = "src/version.ts"
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

export const manualSteps = (names: Names): string[] => [
  `1. Create the repository ${names.owner}/${names.name} and its main ruleset (cli-base docs/standards/new-cli.md).`,
  `2. Set npm trusted publishing for ${names.package}, naming release.yml (WC-REL-11), and add any secrets.`,
  "3. Give .github/workflows/monthly.yml a cron minute between 02:17 and 03:20 UTC that no other repository uses.",
  "4. WireCat CLIs only: a pull request to cli-base's PARITY_GROUPS, a line in cli-core's WIRECAT_TOOLS and in cli-docs' tools.json.",
]

export const runNew = async (cwd: string, source: TemplateSource, args: NewArgs, io: Io): Promise<string> => {
  const { names, answers } = await collect(args, io)
  const target = join(cwd, names.name)
  if (!(await isEmptyOrMissing(target))) throw new Error(`${target} already exists and is not empty`)
  const rendered = await renderTemplate(source, names)
  const category = answers.category?.[0] ?? ""
  const rewrites: Record<string, (text: string) => string> = {
    "package.json": (text) => cliPackageJson(text, names),
    "README.md": () => cliReadme(names),
    "CHANGELOG.md": () => cliChangelog(names, source),
    [VERSION_FILE]: (text) => text.replace(/VERSION = "[^"]*"/, 'VERSION = "0.0.0"'),
    [IDENTITY_FILE]: (text) => withMessenger(withContentLanguages(text, answers.contentLang ?? []), category),
    "AGENTS.md": (text) => withReference(text, category),
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
  const warnings = languageWarnings(answers.contentLang ?? [])
  return [
    `Created ${target} from ${source.name}@${source.version}.`,
    ...(warnings.length ? ["", "Content languages:", ...warnings.map((warning) => `  ${warning}`)] : []),
    "",
    "Next:",
    `  cd ${names.name}`,
    "  pnpm install",
    "  pnpm ci:quick",
    "  git add -A",
    '  git commit -m "chore: start from @wirecat/cli-template"',
    `  then give the agent docs/dev/DESIGN.md; every account command passes a profile, e.g. ${names.command} personal config show`,
    "",
    "Four steps need a person:",
    ...manualSteps(names).map((step) => `  ${step}`),
    "",
  ].join("\n")
}
