import { execFile } from "node:child_process"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { createInterface } from "node:readline/promises"
import { promisify } from "node:util"
import { type CliManifest, classify, MANIFEST, readCliManifest, sha256 } from "./manifest.js"
import type { Io } from "./new.js"
import { type FetchVersion, type RenderedFile, renderTemplate, type TemplateSource } from "./source.js"

const run = promisify(execFile)

export type Mode = "apply" | "replace" | "skip"

export type UpgradeOptions = { mode?: Mode; dryRun: boolean }

type State = "clean" | "edited" | "deleted here" | "new" | "new, a file exists here"

type Change = { path: string; state: State; theirs: RenderedFile; ours?: Buffer }

type Outcome = "applied" | "conflict" | "replaced" | "skipped" | "kept deleted"

const MODES: Mode[] = ["apply", "replace", "skip"]

const readMaybe = (path: string): Promise<Buffer | undefined> => readFile(path).catch(() => undefined)

const requireCleanTree = async (cwd: string): Promise<void> => {
  const { stdout } = await run("git", ["status", "--porcelain"], { cwd }).catch(() => {
    throw new Error(`${cwd} is not a git repository; upgrade needs one so every change can be seen and undone`)
  })
  if (stdout.trim()) {
    throw new Error("the git working tree has changes; commit or stash them first, so upgrade's changes stand alone")
  }
}

const stateOf = (recorded: string | undefined, ours: Buffer | undefined): State => {
  if (recorded === undefined) return ours ? "new, a file exists here" : "new"
  if (!ours) return "deleted here"
  return sha256(ours) === recorded ? "clean" : "edited"
}

export const mergeFile = async (
  ours: Buffer,
  base: Buffer,
  theirs: Buffer,
): Promise<{ content: Buffer; conflicts: number }> => {
  const dir = await mkdtemp(join(tmpdir(), "cli-template-merge-"))
  try {
    const files = ["ours", "base", "theirs"].map((name) => join(dir, name))
    await Promise.all([ours, base, theirs].map((content, index) => writeFile(files[index] ?? "", content)))
    const args = ["merge-file", "-p", "-L", "this CLI", "-L", "template before", "-L", "template now", ...files]
    return await run("git", args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }).then(
      ({ stdout }) => ({ content: stdout, conflicts: 0 }),
      (error: { code?: number; stdout?: Buffer; message: string }) => {
        if (typeof error.code === "number" && error.code > 0 && error.code < 128 && error.stdout) {
          return { content: error.stdout, conflicts: error.code }
        }
        throw new Error(`git merge-file failed: ${error.message}`)
      },
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const writeAs = async (path: string, content: Buffer, mode?: number): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
  if (mode !== undefined) await chmod(path, mode)
}

const diffText = async (before: Buffer, after: Buffer): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "cli-template-diff-"))
  try {
    const [a, b] = [join(dir, "template-before"), join(dir, "template-now")]
    await Promise.all([writeFile(a, before), writeFile(b, after)])
    return await run("git", ["diff", "--no-index", "--no-color", a, b]).then(
      ({ stdout }) => stdout,
      (error: { stdout?: string }) => error.stdout ?? "",
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const hasMarkers = (content: Buffer): boolean => /^(<{7} |={7}$|>{7} )/m.test(content.toString("utf8"))

const writeManifest = (cwd: string, manifest: CliManifest): Promise<void> =>
  writeFile(join(cwd, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)

// A conflict leaves the new version waiting in "pending"; it moves in once the markers are gone, so a
// resolved file is never merged a second time against the old base.
const finishPending = async (cwd: string, manifest: CliManifest): Promise<CliManifest> => {
  const { pending, ...rest } = manifest
  if (!pending) return manifest
  const left = []
  for (const path of pending.conflicts) {
    const content = await readMaybe(join(cwd, path))
    if (content && hasMarkers(content)) left.push(path)
  }
  if (left.length) {
    throw new Error(
      `conflict markers are still in:\n${left.map((path) => `  ${path}`).join("\n")}\nResolve them, then run upgrade again.`,
    )
  }
  const done: CliManifest = { ...rest, version: pending.version, files: pending.files }
  await writeManifest(cwd, done)
  return done
}

export const runUpgrade = async (
  cwd: string,
  target: TemplateSource,
  fetchVersion: FetchVersion,
  options: UpgradeOptions,
  io: Io,
): Promise<string> => {
  const recorded = await readCliManifest(cwd)
  const manifest = options.dryRun ? recorded : await finishPending(cwd, recorded)
  if (manifest !== recorded && manifest.version === target.version) {
    return `Conflicts resolved; ${MANIFEST} is now on ${target.version}. Review with git diff, then commit.`
  }
  if (manifest.version === target.version) return `Already on ${target.name}@${target.version}.`
  if (!options.dryRun && manifest === recorded) await requireCleanTree(cwd)

  const seeds = [...new Set([...manifest.seeds, ...target.manifest.seeds])]
  const renderedNow = await renderTemplate(target, manifest.names)
  const owned = new Map(
    [...renderedNow].filter(([path, file]) => file.kind === "file" && classify(path, [path], seeds) === "file"),
  )

  let before: Promise<Map<string, RenderedFile>> | undefined
  const baseOf = async (path: string): Promise<Buffer> => {
    before ??= fetchVersion(manifest.template, manifest.version).then(async ({ source, dispose }) => {
      try {
        return await renderTemplate(source, manifest.names)
      } finally {
        await dispose()
      }
    })
    return (await before).get(path)?.content ?? Buffer.alloc(0)
  }

  const changes: Change[] = []
  for (const [path, theirs] of owned) {
    const recorded = manifest.files[path]
    if (recorded === sha256(theirs.content)) continue
    const ours = await readMaybe(join(cwd, path))
    if (ours && sha256(ours) === sha256(theirs.content)) continue
    changes.push({ path, state: stateOf(recorded, ours), theirs, ours })
  }
  const dropped = Object.keys(manifest.files).filter(
    (path) => !owned.has(path) && classify(path, [path], seeds) === "file",
  )

  let header = [`Upgrading from ${manifest.template}@${manifest.version} to ${target.version}.`]
  if (dropped.length) {
    header = header.concat(
      "No longer part of the template, left in place for you to keep or delete:",
      dropped.map((path) => `  ${path}`),
    )
  }

  const planned = async (change: Change, mode: Mode): Promise<{ outcome: Outcome; content?: Buffer }> => {
    if (mode === "skip") return { outcome: "skipped" }
    if (mode === "replace") return { outcome: "replaced", content: change.theirs.content }
    if (change.state === "deleted here") return { outcome: "kept deleted" }
    if (change.state === "clean" || change.state === "new" || !change.ours) {
      return { outcome: "applied", content: change.theirs.content }
    }
    const base = change.state === "edited" ? await baseOf(change.path) : Buffer.alloc(0)
    const merged = await mergeFile(change.ours, base, change.theirs.content)
    return { outcome: merged.conflicts ? "conflict" : "applied", content: merged.content }
  }

  if (options.dryRun) {
    const rows = await Promise.all(
      changes.map(async (change) => {
        const what = options.mode
          ? (await planned(change, options.mode)).outcome
          : "asked: apply, replace, skip or diff"
        return `  ${change.path} (${change.state}): ${what}`
      }),
    )
    return [
      ...header,
      changes.length ? "Would change:" : "No template-owned file changed.",
      ...rows,
      "Dry run: nothing written.",
    ].join("\n")
  }

  if (changes.length && !options.mode && !io.interactive) {
    throw new Error(
      `no terminal to ask in; pass --apply, --replace or --skip for every file, or --dry-run to list them:\n${changes
        .map((change) => `  ${change.path} (${change.state})`)
        .join("\n")}`,
    )
  }

  const rl =
    changes.length && !options.mode
      ? createInterface({ input: io.input, output: io.output, terminal: false })
      : undefined
  const choose = async (change: Change): Promise<Mode> => {
    if (options.mode || !rl) return options.mode ?? "skip"
    for (;;) {
      const answer = (
        await rl.question(`${change.path} (${change.state}): [a]pply, [r]eplace, [s]kip, [d]iff? `)
      ).trim()
      const mode = MODES.find((candidate) => candidate === answer || candidate[0] === answer)
      if (mode) return mode
      if (answer === "d" || answer === "diff") {
        const base =
          change.state === "new" || change.state === "new, a file exists here"
            ? Buffer.alloc(0)
            : await baseOf(change.path)
        io.output.write(await diffText(base, change.theirs.content))
      }
    }
  }

  const results: string[] = []
  const conflicts: string[] = []
  try {
    for (const change of changes) {
      const { outcome, content } = await planned(change, await choose(change))
      if (content) await writeAs(join(cwd, change.path), content, change.ours ? undefined : change.theirs.mode)
      if (outcome === "conflict") conflicts.push(change.path)
      results.push(`  ${change.path} (${change.state}): ${outcome}`)
    }
  } finally {
    rl?.close()
  }

  const footer = ["Then re-run community's adopt-standards.py for config/wirecat/, which upgrade never touches."]
  const files = Object.fromEntries([...owned].map(([path, file]) => [path, sha256(file.content)]))
  if (conflicts.length) {
    await writeManifest(cwd, { ...manifest, seeds, pending: { version: target.version, files, conflicts } })
    return [
      ...header,
      ...results,
      "",
      `Conflicts left in ${conflicts.length} file(s); ${MANIFEST} stays on ${manifest.version} until they are resolved:`,
      ...conflicts.map((path) => `  ${path}`),
      `Resolve the markers, then run upgrade again: it checks they are gone and moves ${MANIFEST} to ${target.version}.`,
      ...footer,
    ].join("\n")
  }

  const next: CliManifest = {
    ...manifest,
    template: target.name,
    version: target.version,
    files,
    seeds,
  }
  await writeManifest(cwd, next)
  return [
    ...header,
    ...(results.length ? results : ["No template-owned file changed."]),
    `${MANIFEST} is now on ${target.version}. Review with git diff, then commit.`,
    ...footer,
  ].join("\n")
}

export const parseMode = (flags: { apply?: boolean; replace?: boolean; skip?: boolean }): Mode | undefined => {
  const picked = MODES.filter((mode) => flags[mode])
  if (picked.length > 1)
    throw new Error(`pick one of --apply, --replace or --skip, not ${picked.map((mode) => `--${mode}`).join(" and ")}`)
  return picked[0]
}
