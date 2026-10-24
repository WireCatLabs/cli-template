import type { Names, Placeholders } from "./manifest.js"

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")

const word = (text: string): string => `(?<![A-Za-z0-9_])${escapeRegex(text)}(?![A-Za-z0-9])`

export const upperCommand = (command: string): string => command.toUpperCase().replaceAll("-", "_")

// One pass, so a replacement that itself contains the command placeholder (a package named
// "@x/app-tools") is never renamed a second time.
export const renamer = (placeholders: Placeholders, names: Names): ((text: string) => string) => {
  const table = new Map<string, string>([
    [placeholders.package, names.package],
    [placeholders.repository, `${names.owner}/${names.name}`],
    [placeholders.command, names.command],
    [upperCommand(placeholders.command), upperCommand(names.command)],
  ])
  const pattern = new RegExp(
    [escapeRegex(placeholders.package), escapeRegex(placeholders.repository), word(placeholders.command)]
      .concat(word(upperCommand(placeholders.command)))
      .join("|"),
    "g",
  )
  return (text) => text.replace(pattern, (match) => table.get(match) ?? match)
}

const isBinary = (content: Buffer): boolean => content.subarray(0, 8000).includes(0)

export const renameContent = (rename: (text: string) => string, content: Buffer): Buffer =>
  isBinary(content) ? content : Buffer.from(rename(content.toString("utf8")), "utf8")
