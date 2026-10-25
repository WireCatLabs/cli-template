import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, relative, sep } from "node:path"
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
import { renameContent, renamer, stripKit } from "./rename.js"

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

// npm renames .gitignore to .npmignore when it installs a package, so the package ships it as gitignore.
export const PACKED_AS: Record<string, string> = { ".gitignore": "gitignore" }

const onDisk = async (root: string, path: string): Promise<string> => {
  const packed = PACKED_AS[path]
  const full = join(root, path)
  if (!packed) return full
  return (await stat(full).catch(() => undefined)) ? full : join(root, packed)
}

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
  const path = await onDisk(root, entry)
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

// npm cannot set the executable bit when it installs on Windows, so a shebang stands in for it there. A .ts or .js
// entry point carries one for node, not for the shell.
const isExecutable = (path: string, content: Buffer, mode: number): boolean =>
  (mode & 0o111) !== 0 || (content.subarray(0, 2).toString() === "#!" && !/\.[cm]?[jt]sx?$/.test(path))

export const renderTemplate = async (source: TemplateSource, names: Names): Promise<Map<string, RenderedFile>> => {
  const rename = renamer(source.manifest.placeholders, names)
  const listed = await listTemplate(source)
  const rendered = await Promise.all(
    [...listed].map(async ([path, kind]) => {
      const full = await onDisk(source.root, path)
      const [content, info] = await Promise.all([readFile(full), stat(full)])
      const renamed = renameContent(rename, stripKit(path, content))
      const mode = isExecutable(path, content, info.mode) ? 0o755 : 0o644
      return [rename(path), { kind, content: renamed, mode }] as const
    }),
  )
  return new Map(rendered)
}

// On Windows npm is npm.cmd, which execFile cannot start without a shell; npm-cli.js beside node runs anywhere.
export const npmCommand = (args: string[]): [string, string[]] => {
  const home = dirname(process.execPath)
  const cli = [
    join(home, "node_modules/npm/bin/npm-cli.js"),
    join(home, "../lib/node_modules/npm/bin/npm-cli.js"),
  ].find((path) => existsSync(path))
  return cli ? [process.execPath, [cli, ...args]] : ["npm", args]
}

export const fetchPacked = async (spec: string): Promise<Fetched> => {
  const dir = await mkdtemp(join(tmpdir(), "cli-template-"))
  const { stdout } = await run(...npmCommand(["pack", spec, "--silent", "--pack-destination", dir])).catch(
    (error: Error) => {
      throw new Error(`could not download ${spec} from npm, which upgrade needs as the merge base: ${error.message}`)
    },
  )
  const tarball = stdout.trim().split("\n").pop() ?? ""
  const dispose = () => rm(dir, { recursive: true, force: true })
  try {
    // GNU tar reads "C:" in a path as a remote host, so the archive is named relative to its folder.
    await run("tar", ["-xzf", tarball], { cwd: dir })
    return { source: await loadSource(join(dir, "package")), dispose }
  } catch (error) {
    await dispose()
    throw error
  }
}

export const fetchPublished: FetchVersion = (name, version) => fetchPacked(`${name}@${version}`)
