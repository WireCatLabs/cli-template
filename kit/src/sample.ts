/** The template's sample: the files `remove-sample` deletes, and `new` leaves out when a config replaces it. */
const SAMPLE = [
  "src/sample/",
  "src/commands/comments.ts",
  "src/comments.test.ts",
  "src/records.test.ts",
  "src/testing/fake-comments.ts",
]
const MOUNT = [
  /^import \{ commentsCommand \} from "\.\/commands\/comments\.js"\r?\n/m,
  /^[ \t]*commentsCommand\(\),\r?\n/m,
]

export const inSample = (path: string): boolean =>
  SAMPLE.some((entry) => (entry.endsWith("/") ? path.startsWith(entry) : path === entry))

export const withoutMount = (text: string): string => MOUNT.reduce((rest, line) => rest.replace(line, ""), text)
