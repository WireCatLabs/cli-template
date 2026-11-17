import type { Names, Placeholders } from "./manifest.js"

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")

const word = (text: string): string => `(?<![A-Za-z0-9_])${escapeRegex(text)}(?![A-Za-z0-9])`

export const upperCommand = (command: string): string => command.toUpperCase().replaceAll("-", "_")

export const prefixOf = (names: Names): string => names.prefix ?? upperCommand(names.command)

// WireCat Desktop takes a tool outside @wirecat only when its data folder, and so its skill, is <scope>-<name>: no
// package can then take another publisher's folder. WireCat's own CLIs keep the repository name.
export const appNameOf = (names: Names): string => {
  const scoped = /^@([^/]+)\/(.+)$/.exec(names.package)
  return scoped && scoped[1] !== "wirecat" ? `${scoped[1]}-${scoped[2]}` : names.name
}

// The command word followed by ": " is a key and stays: 0.1.x used `app`, which is also cli-core's key in
// `app: IDENTITY`. One pass, so a replacement that itself contains the command placeholder (a package named
// "@x/clidev-tools") is never renamed a second time.
export const renamer = (placeholders: Placeholders, names: Names): ((text: string) => string) => {
  // `app` first, so a version whose `app` and `name` are one word renders it as `name`, as it did.
  const table = new Map<string, string>([
    [placeholders.app, appNameOf(names)],
    [placeholders.package, names.package],
    [placeholders.repository, `${names.owner}/${names.name}`],
    [placeholders.name, names.name],
    [placeholders.command, names.command],
    [upperCommand(placeholders.command), prefixOf(names)],
  ])
  const pattern = new RegExp(
    [
      escapeRegex(placeholders.package),
      escapeRegex(placeholders.repository),
      word(placeholders.app),
      word(placeholders.name),
    ]
      .concat(`${word(placeholders.command)}(?!:\\s)`)
      .concat(word(upperCommand(placeholders.command)))
      .join("|"),
    "g",
  )
  return (text) => text.replace(pattern, (match) => table.get(match) ?? match)
}

const isBinary = (content: Buffer): boolean => content.subarray(0, 8000).includes(0)

export const withLf = (content: Buffer): Buffer =>
  isBinary(content) || !content.includes(13) ? content : Buffer.from(content.toString("utf8").replaceAll("\r\n", "\n"))

export const renameContent = (rename: (text: string) => string, content: Buffer): Buffer =>
  isBinary(content) ? content : Buffer.from(rename(content.toString("utf8")), "utf8")

const KIT_CONFIG = /(^|\/)(vitest\.config\.ts|biome\.json|cspell\.json|tsconfig[^/]*\.json|\.markdownlint-cli2\.jsonc)$/

// The template's configs name kit/ so its own checks cover the copy tool; a CLI has no kit/, and the
// entries would point at nothing (or fail, for an include that must match).
export const stripKit = (path: string, content: Buffer): Buffer => {
  if (!KIT_CONFIG.test(path)) return content
  const text = content.toString("utf8")
  const stripped = text
    .replace(/^[ \t]*\/\/[^\n]*\n(?=[ \t]*"!?(\.\/)?kit\/)/gm, "")
    .replace(/^[ \t]*"(\.\/)?kit\/[^"]*":[^\n]*\n/gm, "")
    .replace(/\[\s*"!?(\.\/)?kit\/[^"]*"\s*\]/g, "[]")
    .replace(/,\s*"!?(\.\/)?kit\/[^"]*"/g, "")
    .replace(/"!?(\.\/)?kit\/[^"]*",\s*/g, "")
  return stripped === text ? content : Buffer.from(stripped, "utf8")
}

export const isWireCat = (names: Names): boolean => names.package.startsWith("@wirecat/")

// Names the service's own tools already use. A CLI with the same environment prefix reads their token as its own; one
// with the same keyring service overwrites their sign-in. Each entry names where it was seen.
const TAKEN_PREFIXES: Record<string, string> = {
  // notion-cli BUG-759 (cli-factory plan, notion lessons).
  NOTION: "Notion's MCP server reads NOTION_TOKEN",
  // The cli-factory plan, 6.3.6.
  HUBSPOT: "HubSpot's own tools read HUBSPOT_ variables",
  // https://cli.github.com/manual/gh_help_environment
  GH: "GitHub's gh reads GH_TOKEN",
  GITHUB: "GitHub's gh reads GITHUB_TOKEN",
}
const TAKEN_SERVICES: Record<string, string> = {
  // notion-cli RISK-2303 (cli-factory plan, notion lessons).
  "notion-cli": "Notion's ntn keeps its sign-in under the keyring service notion-cli",
}

// A prefix the service's own tools read is replaced before any file is written, so nobody has to rename it by hand.
export const withFreePrefix = (names: Names): Names => {
  const prefix = prefixOf(names)
  if (names.prefix !== undefined || !TAKEN_PREFIXES[prefix]) return names
  return { ...names, prefix: isWireCat(names) ? `WC${prefix}` : `${prefix}_CLI` }
}

export const nameClashes = (names: Names, files: string[]): string[] => {
  const prefix = prefixOf(names)
  const taken = upperCommand(names.command)
  const app = appNameOf(names)
  return [
    ...(taken !== prefix && TAKEN_PREFIXES[taken]
      ? [
          `${taken}_: ${TAKEN_PREFIXES[taken]}, so this CLI reads ${prefix}_ variables instead (envPrefix in src/identity.ts).`,
        ]
      : []),
    ...(TAKEN_PREFIXES[prefix]
      ? [
          `${prefix}_: ${TAKEN_PREFIXES[prefix]}, so ${names.command} would take its token. Pick another prefix (notion-cli uses WCNOTION): envPrefix in src/identity.ts and ${prefix}_ in ${files.join(", ")}. upgrade merges the template's own files, scripts/sandboxed.ts and docs/dev/TESTING.md, with ${prefix}_ in them: check them after each upgrade.`,
        ]
      : []),
    ...(TAKEN_SERVICES[app]
      ? [
          `keyring service ${app}: ${TAKEN_SERVICES[app]}, so a sign-in would replace it. Pick another name: appName in src/identity.ts.`,
        ]
      : []),
  ]
}
