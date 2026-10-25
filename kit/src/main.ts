#!/usr/bin/env node
import { parseArgs } from "node:util"
import { INTERVIEW, NAME_QUESTIONS } from "./interview.js"
import { type Io, runNew } from "./new.js"
import { fetchPublished, loadSource, ownRoot } from "./source.js"
import { parseMode, runUpgrade } from "./upgrade.js"

const USAGE = `Usage:
  npx @wirecat/cli-template new <name> [answers]   copy the template into ./<name>
  npx @wirecat/cli-template upgrade [--apply | --replace | --skip] [--dry-run]

new asks for every missing answer in a terminal; without one, a missing answer is an error.
  --command <word>      the command word people type
  --package <name>      the npm package name
  --owner <owner>       the GitHub owner of the repository
${INTERVIEW.map((question) => `  --${question.flag.padEnd(20)}${question.title ?? question.text}`).join("\n")}
Any interview answer also takes "other:<your answer>"; several answers are comma-separated.

upgrade brings template changes into a CLI made from it; it needs a clean git working tree.
  --apply      merge the template's change into every changed file (conflicts get git markers)
  --replace    take the template's new file as it is
  --skip       keep this CLI's files
  --dry-run    list the files and what each would get; write nothing
`

const answerFlags = Object.fromEntries(
  [...NAME_QUESTIONS, ...INTERVIEW].map((question) => [question.flag, { type: "string" as const }]),
)

const main = async (argv: string[], io: Io): Promise<string> => {
  const [command, ...rest] = argv
  if (!command || command === "--help" || command === "-h") return USAGE
  const source = await loadSource(ownRoot())
  if (command === "--version") return source.version
  if (command === "new") {
    const { values, positionals } = parseArgs({
      args: rest,
      options: answerFlags,
      allowPositionals: true,
      strict: true,
    })
    if (positionals.length > 1) throw new Error(`new takes one folder name, got ${positionals.join(" ")}`)
    return runNew(process.cwd(), source, { name: positionals[0], flags: values }, io)
  }
  if (command === "upgrade") {
    const { values, positionals } = parseArgs({
      args: rest,
      options: {
        apply: { type: "boolean" },
        replace: { type: "boolean" },
        skip: { type: "boolean" },
        "dry-run": { type: "boolean" },
      },
      strict: true,
    })
    if (positionals.length) throw new Error(`upgrade takes no arguments, got ${positionals.join(" ")}`)
    return runUpgrade(
      process.cwd(),
      source,
      fetchPublished,
      { mode: parseMode(values), dryRun: values["dry-run"] ?? false },
      io,
    )
  }
  throw new Error(`unknown command "${command}"; expected new or upgrade\n\n${USAGE}`)
}

const io: Io = {
  input: process.stdin,
  output: process.stdout,
  interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
}

main(process.argv.slice(2), io).then(
  (text) => {
    process.stdout.write(text.endsWith("\n") ? text : `${text}\n`)
  },
  (error: unknown) => {
    process.stderr.write(`cli-template: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  },
)
