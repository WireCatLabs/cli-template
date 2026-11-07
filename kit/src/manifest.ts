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

// Not the current placeholders: 0.1.0 and 0.1.1 left keys out of template.json, and upgrade renders their files
// as the merge base, so a missing key must keep meaning what it meant then.
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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isPlaceholder = (key: string): key is keyof Placeholders => key in DEFAULT_PLACEHOLDERS

const isNames = (value: unknown): value is Names =>
  isRecord(value) && ["name", "command", "package", "owner"].every((key) => typeof value[key] === "string")

const isHashes = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((hash) => typeof hash === "string")

const isPending = (value: unknown): value is NonNullable<CliManifest["pending"]> =>
  isRecord(value) && typeof value.version === "string" && isHashes(value.files) && isStringList(value.conflicts)

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
  const given = raw.placeholders ?? {}
  if (!isRecord(given)) return fail(file, `"placeholders" must be an object`)
  const placeholders = { ...DEFAULT_PLACEHOLDERS }
  for (const [key, value] of Object.entries(given)) {
    if (!isPlaceholder(key)) return fail(file, `unknown placeholder "${key}"`)
    if (typeof value !== "string" || value.length === 0) return fail(file, `placeholder "${key}" must be a string`)
    placeholders[key] = value
  }
  return { files: raw.files, seeds: raw.seeds, placeholders }
}

export const parseCliManifest = (file: string, raw: unknown): CliManifest => {
  if (!isRecord(raw)) return fail(file, "must be a JSON object")
  const { template, version, names, files, seeds, pending } = raw
  if (typeof template !== "string") return fail(file, `"template" must be the template's package name`)
  if (typeof version !== "string") return fail(file, `"version" must be the template version this CLI is on`)
  if (!isNames(names)) return fail(file, `"names" must hold name, command, package and owner`)
  if (!isHashes(files)) return fail(file, `"files" must map each template-owned path to its sha256`)
  if (!isStringList(seeds)) return fail(file, `"seeds" must be a list of paths`)
  if (pending !== undefined && !isPending(pending))
    return fail(file, `"pending" must hold version, files and conflicts`)
  return { template, version, names, files, seeds, ...(pending ? { pending } : {}) }
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
