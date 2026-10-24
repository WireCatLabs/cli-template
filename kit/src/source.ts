import { execFile } from "node:child_process"
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import {
  classify,
  type Kind,
  MANIFEST,
  type Names,
  parseTemplateManifest,
  readJson,
  type TemplateManifest,
} from "./manifest.js"
import { renameContent, renamer } from "./rename.js"

const run = promisify(execFile)

export type TemplateSource = { root: string; name: string; version: string; manifest: TemplateManifest }

export type RenderedFile = { kind: Kind; content: Buffer; mode: number }

export type Fetched = { source: TemplateSource; dispose: () => Promise<void> }

export type FetchVersion = (name: string, version: string) => Promise<Fetched>

export const ownRoot = (): string => fileURLToPath(new URL("../../", import.meta.url))

export const loadSource = async (root: string): Promise<TemplateSource> => {
  const pkg = (await readJson(join(root, "package.json"))) as { name?: unknown; version?: unknown }
  if (typeof pkg.name !== "string" || typeof pkg.version !== "string") {
    throw new Error(`${join(root, "package.json")}: needs a name and a version`)
  }
  const manifestPath = join(root, MANIFEST)
  const manifest = parseTemplateManifest(manifestPath, await readJson(manifestPath))
  return { root, name: pkg.name, version: pkg.version, manifest }
}

const SKIP_DIRS = new Set([".git", "node_modules"])

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : walk(path)
      return entry.isFile() ? [path] : []
    }),
  )
  return nested.flat()
}

const listEntry = async (root: string, entry: string): Promise<string[]> => {
  const path = join(root, entry)
  const info = await stat(path).catch(() => undefined)
  if (!info)
    throw new Error(
      `${MANIFEST} lists "${entry}", but the package has no such ${entry.endsWith("/") ? "folder" : "file"}`,
    )
  if (!entry.endsWith("/")) return [entry]
  return (await walk(path)).map((file) => relative(root, file).split(sep).join("/"))
}

export const listTemplate = async (source: TemplateSource): Promise<Map<string, Kind>> => {
  const { files, seeds } = source.manifest
  const paths = (
    await Promise.all(["package.json", ...files, ...seeds].map((entry) => listEntry(source.root, entry)))
  ).flat()
  return new Map(
    [...new Set(paths)].sort().flatMap((path) => {
      const kind = classify(path, files, seeds)
      return kind ? [[path, kind] as const] : []
    }),
  )
}

export const renderTemplate = async (source: TemplateSource, names: Names): Promise<Map<string, RenderedFile>> => {
  const rename = renamer(source.manifest.placeholders, names)
  const listed = await listTemplate(source)
  const rendered = await Promise.all(
    [...listed].map(async ([path, kind]) => {
      const full = join(source.root, path)
      const [content, info] = await Promise.all([readFile(full), stat(full)])
      return [rename(path), { kind, content: renameContent(rename, content), mode: info.mode & 0o777 }] as const
    }),
  )
  return new Map(rendered)
}

export const fetchPublished: FetchVersion = async (name, version) => {
  const dir = await mkdtemp(join(tmpdir(), "cli-template-"))
  const { stdout } = await run("npm", ["pack", `${name}@${version}`, "--silent", "--pack-destination", dir]).catch(
    (error: Error) => {
      throw new Error(
        `could not download ${name}@${version} from npm, which upgrade needs as the merge base: ${error.message}`,
      )
    },
  )
  const tarball = stdout.trim().split("\n").pop() ?? ""
  const dispose = () => rm(dir, { recursive: true, force: true })
  try {
    await run("tar", ["-xzf", join(dir, tarball), "-C", dir])
    return { source: await loadSource(join(dir, "package")), dispose }
  } catch (error) {
    await dispose()
    throw error
  }
}
