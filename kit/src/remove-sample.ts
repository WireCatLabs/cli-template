import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { readCliManifest } from "./manifest.js"
import { requireCleanTree } from "./upgrade.js"

const SAMPLE = [
  "src/sample/",
  "src/commands/comments.ts",
  "src/comments.test.ts",
  "src/records.test.ts",
  "src/testing/fake-comments.ts",
]
const PROGRAM = "src/program.ts"
const MOUNT = [
  /^import \{ commentsCommand \} from "\.\/commands\/comments\.js"\r?\n/m,
  /^[ \t]*commentsCommand\(\),\r?\n/m,
]

export type Step = { command: string; args: string[] }

// The files the sample leaves behind are regenerated, or a test pins a command that no longer exists:
// contracts/mcp-catalogue.json went stale this way in notion-cli and hid a failing test.
export const REGENERATE: Step[] = [
  { command: "pnpm", args: ["generate"] },
  { command: "pnpm", args: ["exec", "cli-contract", "contracts/plan.json", "--update"] },
  { command: "pnpm", args: ["exec", "vitest", "run", "src/mcp.test.ts", "--update"] },
]

export type Runner = (step: Step, cwd: string) => boolean

// Windows starts pnpm through pnpm.cmd, which only a shell runs; the arguments are fixed, never user data.
const spawnStep: Runner = ({ command, args }, cwd) =>
  spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" }).status === 0

const walk = async (root: string, dir: string): Promise<string[]> => {
  const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? walk(root, `${dir}/${entry.name}`) : Promise.resolve([`${dir}/${entry.name}`]),
    ),
  )
  return nested.flat()
}

const inSample = (path: string): boolean =>
  SAMPLE.some((entry) => (entry.endsWith("/") ? path.startsWith(entry) : path === entry))

const IMPORT = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g

const importsOf = (path: string, text: string): string[] =>
  [...text.matchAll(IMPORT)].map(([, spec = ""]) =>
    join(dirname(path), spec).replaceAll("\\", "/").replace(/\.js$/, ".ts"),
  )

export const withoutMount = (text: string): string => MOUNT.reduce((rest, line) => rest.replace(line, ""), text)

export const runRemoveSample = async (cwd: string, runStep: Runner = spawnStep): Promise<string> => {
  await readCliManifest(cwd).catch(() => {
    throw new Error(`${cwd} is not a CLI made from cli-template: it has no template.json naming the CLI`)
  })
  await requireCleanTree(cwd)
  const all = [...(await walk(cwd, "src")), ...(await walk(cwd, "scripts"))]
  const files = all.filter((path) => path.endsWith(".ts"))
  const sample = files.filter(inSample)
  if (sample.length === 0) return "The sample is already gone; nothing to remove."
  const program = existsSync(join(cwd, PROGRAM)) ? await readFile(join(cwd, PROGRAM), "utf8") : undefined
  const kept = files.filter((path) => !inSample(path))
  const users: string[] = []
  for (const path of kept) {
    const text =
      path === PROGRAM && program !== undefined ? withoutMount(program) : await readFile(join(cwd, path), "utf8")
    const used = importsOf(path, text).filter((target) => sample.includes(target))
    if (used.length) users.push(`  ${path} imports ${used.join(", ")}`)
  }
  if (users.length) {
    throw new Error(
      [
        "these files still use the sample; move them to your own service and fake first, then run remove-sample again:",
        ...users,
      ].join("\n"),
    )
  }
  for (const path of sample) await rm(join(cwd, path))
  if (existsSync(join(cwd, "src/sample"))) await rm(join(cwd, "src/sample"), { recursive: true })
  if (program !== undefined) await writeFile(join(cwd, PROGRAM), withoutMount(program))
  // Each step regenerates its own files, so one that fails does not stop the others.
  const failed = REGENERATE.filter(
    (step) =>
      !(step.args.includes("src/mcp.test.ts") && !existsSync(join(cwd, "src/mcp.test.ts"))) && !runStep(step, cwd),
  ).map((step) => `  ${[step.command, ...step.args].join(" ")}`)
  if (failed.length) {
    throw new Error(["the sample is removed, but these failed; fix them and run them again:", ...failed].join("\n"))
  }
  const marked = (
    await Promise.all(
      all
        .filter((path) => !inSample(path))
        .map(async (path) => ((await readFile(join(cwd, path), "utf8")).includes("SAMPLE:") ? [path] : [])),
    )
  ).flat()
  return [
    `Removed the sample: ${sample.join(", ")}.`,
    "Regenerated docs/commands.md, contracts/ and contracts/mcp-catalogue.json.",
    ...(marked.length ? [`Still marked SAMPLE: (rewrite for your service): ${marked.join(", ")}.`] : []),
    "Next: pnpm test:matrix, pnpm test:coverage, then review git diff and commit.",
    "",
  ].join("\n")
}
