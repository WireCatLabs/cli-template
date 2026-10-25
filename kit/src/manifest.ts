import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const MANIFEST = "template.json"

export type Placeholders = { command: string; name: string; package: string; repository: string }

export type TemplateManifest = {
  files: string[]
  seeds: string[]
  placeholders: Placeholders
}

export type Names = { name: string; command: string; package: string; owner: string }

export type CliManifest = {
  template: string
  version: string
  names: Names
  files: Record<string, string>
  seeds: string[]
  pending?: { version: string; files: Record<string, string>; conflicts: string[] }
}

export const DEFAULT_PLACEHOLDERS: Placeholders = {
  command: "app",
  name: "app-cli",
  package: "@wirecat/app-cli",
  repository: "WireCatLabs/app-cli",
}

// package.json and the interview's answers belong to the CLI from the first copy.
const ALWAYS_SEEDS = ["package.json", "docs/dev/DESIGN.md"]

// The copy tool and the template's own manifest are never part of a CLI, whatever template.json lists.
const NEVER_COPIED = [MANIFEST, "kit/"]

export const sha256 = (content: Buffer | string): string => createHash("sha256").update(content).digest("hex")

const fail = (file: string, problem: string): never => {
  throw new Error(`${file}: ${problem}`)
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const checkEntries = (file: string, key: string, entries: string[]): void => {
  for (const entry of entries) {
    if (entry.startsWith("/") || entry.split("/").includes(".."))
      fail(file, `"${key}" entry "${entry}" must be relative`)
  }
}

export const parseTemplateManifest = (file: string, raw: unknown): TemplateManifest => {
  if (!isRecord(raw)) return fail(file, "must be a JSON object")
  if (!isStringList(raw.files)) return fail(file, `"files" must be a list of paths`)
  if (!isStringList(raw.seeds)) return fail(file, `"seeds" must be a list of paths`)
  checkEntries(file, "files", raw.files)
  checkEntries(file, "seeds", raw.seeds)
  const placeholders = raw.placeholders ?? {}
  if (!isRecord(placeholders)) return fail(file, `"placeholders" must be an object`)
  for (const [key, value] of Object.entries(placeholders)) {
    if (!(key in DEFAULT_PLACEHOLDERS)) fail(file, `unknown placeholder "${key}"`)
    if (typeof value !== "string" || value.length === 0) fail(file, `placeholder "${key}" must be a string`)
  }
  return {
    files: raw.files,
    seeds: raw.seeds,
    placeholders: { ...DEFAULT_PLACEHOLDERS, ...(placeholders as Partial<Placeholders>) },
  }
}

export const parseCliManifest = (file: string, raw: unknown): CliManifest => {
  if (!isRecord(raw)) return fail(file, "must be a JSON object")
  const { template, version, names, files, seeds, pending } = raw
  if (typeof template !== "string") return fail(file, `"template" must be the template's package name`)
  if (typeof version !== "string") return fail(file, `"version" must be the template version this CLI is on`)
  if (!isRecord(names) || !["name", "command", "package", "owner"].every((key) => typeof names[key] === "string")) {
    return fail(file, `"names" must hold name, command, package and owner`)
  }
  if (!isRecord(files) || !Object.values(files).every((hash) => typeof hash === "string")) {
    return fail(file, `"files" must map each template-owned path to its sha256`)
  }
  if (!isStringList(seeds)) return fail(file, `"seeds" must be a list of paths`)
  if (
    pending !== undefined &&
    (!isRecord(pending) ||
      typeof pending.version !== "string" ||
      !isRecord(pending.files) ||
      !isStringList(pending.conflicts))
  ) {
    return fail(file, `"pending" must hold version, files and conflicts`)
  }
  return {
    template,
    version,
    names: names as Names,
    files: files as Record<string, string>,
    seeds,
    ...(pending ? { pending: pending as CliManifest["pending"] } : {}),
  }
}

export const readJson = async (path: string): Promise<unknown> => {
  const text = await readFile(path, "utf8").catch(() => fail(path, "not found"))
  try {
    return JSON.parse(text)
  } catch {
    return fail(path, "is not valid JSON")
  }
}

export const readCliManifest = async (dir: string): Promise<CliManifest> => {
  const path = join(dir, MANIFEST)
  return parseCliManifest(path, await readJson(path))
}

const matches = (entry: string, path: string): boolean =>
  entry.endsWith("/") ? path.startsWith(entry) : path === entry

// An exact path beats a folder, and a deeper folder beats a shallower one, so a seed folder can hold
// one template-owned file and the other way round.
const specificity = (entry: string): number => (entry.endsWith("/") ? entry.length : Number.MAX_SAFE_INTEGER)

export type Kind = "file" | "seed"

export const classify = (path: string, files: string[], seeds: string[]): Kind | undefined => {
  if (NEVER_COPIED.some((entry) => matches(entry, path))) return undefined
  if (ALWAYS_SEEDS.includes(path)) return "seed"
  const best = (entries: string[]) =>
    entries.reduce((top, entry) => (matches(entry, path) ? Math.max(top, specificity(entry)) : top), -1)
  const file = best(files)
  const seed = best(seeds)
  if (file < 0 && seed < 0) return undefined
  return seed >= file ? "seed" : "file"
}
