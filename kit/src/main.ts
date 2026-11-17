#!/usr/bin/env node
import { parseArgs } from "node:util"
import { INTERVIEW, NAME_QUESTIONS } from "./interview.js"
import { type Io, runNew, TAGLINE_QUESTION } from "./new.js"
import { runRemoveSample } from "./remove-sample.js"
import { fetchPublished, loadSource, ownRoot } from "./source.js"
import { parseMode, runUpgrade } from "./upgrade.js"

const USAGE = `Usage:
  npx @wirecat/cli-template new <name> [answers]   copy the template into ./<name>
  npx @wirecat/cli-template upgrade [--apply | --replace | --skip] [--dry-run]
  npx @wirecat/cli-template remove-sample

new asks for every missing answer in a terminal; without one, a missing answer is an error.
  --command <word>      the command word people type
  --package <name>      the npm package name
  --owner <owner>       the GitHub owner of the repository
  --tagline <line>      ${TAGLINE_QUESTION.text}; left out, it is made from the description
  --spec-url <url>      download the service's OpenAPI 3 or Swagger 2.0 description, JSON or YAML, for the api group;
                        with --spec graphql, ask that endpoint for its schema; https only, or http from localhost
  --from-config <file>  take the names, the API description's URL, the sign-in and the category from a
                        wirecat.config.ts (defineCli from @wirecat/cli-core/manifest), and copy it into the CLI with
                        pnpm source:check; leave out <name> and the flags it sets
  --preset generic      for a CLI outside WireCat: only <name> and --owner are needed, the command word is <name>
                        without -cli, the package @<owner>/<name>, and the other answers neutral defaults; any flag
                        given wins. bin/release then needs no recorded live check.
${INTERVIEW.map((question) => `  --${question.flag.padEnd(20)}${question.title ?? question.text}`).join("\n")}
Any interview answer also takes "other:<your answer>"; several answers are comma-separated.

upgrade brings template changes into a CLI made from it; it needs a clean git working tree.
  --apply      merge the template's change into every changed file (conflicts get git markers)
  --replace    take the template's new file as it is
  --skip       keep this CLI's files
  --dry-run    list the files and what each would get; write nothing

remove-sample deletes the template's comments sample once your own commands replace it, then regenerates
docs/commands.md, contracts/ and contracts/mcp-catalogue.json. It needs a clean git working tree, and stops without
a change while any other file still imports the sample.
`

const answerFlags = Object.fromEntries(
  [
    ...NAME_QUESTIONS,
    TAGLINE_QUESTION,
    ...INTERVIEW,
    { flag: "spec-url" },
    { flag: "preset" },
    { flag: "from-config" },
  ].map((question) => [question.flag, { type: "string" as const }]),
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
    const args = { name: positionals[0], flags: values }
    const file = values["from-config"]
    if (file === undefined) return runNew(process.cwd(), source, args, io)
    // Loaded only here: it imports cli-core, which the other commands do without.
    const { configArgs, loadCliConfig } = await import("./from-config.js")
    const loaded = await loadCliConfig(file)
    return runNew(process.cwd(), source, configArgs(loaded.config, args), io, undefined, loaded)
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
  if (command === "remove-sample") {
    if (rest.length) throw new Error(`remove-sample takes no arguments, got ${rest.join(" ")}`)
    return runRemoveSample(process.cwd())
  }
  throw new Error(`unknown command "${command}"; expected new, upgrade or remove-sample\n\n${USAGE}`)
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
