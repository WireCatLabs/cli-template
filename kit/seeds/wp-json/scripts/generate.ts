import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import {
  type ApiOperation,
  coverageGenerator,
  definitionsGenerator,
  generate,
  manifestGenerator,
  typesGenerator,
  valibotGenerator,
  writeArtifacts,
} from "@wirecat/cli-base/codegen"
import { specModel } from "./spec-model.ts"

// The service's API description → src/generated/ and docs/dev/API_COVERAGE.md. Each correction below is read from
// the service's documentation, never guessed; cli-base docs/standards/kit-surface.md says what each one does.
const root = resolve(import.meta.dirname, "..")
// A fresh CLI has no src/generated/ yet and cannot build without it, so build runs this with --if-missing first.
if (process.argv.includes("--if-missing") && existsSync(join(root, "src/generated/manifest.ts"))) process.exit(0)
const { model, notes, overrides } = await specModel(root)
// The route after /wp/v2/ names the keys: posts.publish, pages.delete.force. A key is written as its command is, so
// wp_pattern_category becomes wp-pattern-category.
const group = (operation: ApiOperation) =>
  operation.binding.kind === "http" ? (operation.binding.path.split("/")[3] ?? "wp").replaceAll("_", "-") : "wp"
const artifacts = generate(
  model,
  [
    typesGenerator({ path: "src/generated/types.ts" }),
    valibotGenerator({ path: "src/generated/schemas.ts", typesImport: "./types.js" }),
    manifestGenerator({ path: "src/generated/manifest.ts" }),
    definitionsGenerator({ path: "src/generated/definitions.ts" }),
    coverageGenerator({
      path: "docs/dev/API_COVERAGE.md",
      title: "API coverage",
      command: (operation) => `clidev <profile> api ${operation.command}`,
    }),
  ],
  {
    banner: ["Source: spec/clidev/, checked against provenance.json", "Run: pnpm generate"],
    // Each list pages from 1 by X-WP-TotalPages, from scripts/spec-model.ts; add an operation id → { effect, reason }
    // where WordPress's method misleads.
    overrides: { ...overrides },
    // Command names from the paths, without the /wp/v2 every route shares.
    names: {
      fromPath: true,
      segments: { wp: "", v2: "" },
      // A route that ends in a namespace or a user id lists, yet its path reads as one item's.
      commands: {
        getWpV2BlockTypesByNamespace: "block-types-list-namespace",
        deleteWpV2UsersByUserIdApplicationPasswords: "users-application-passwords-delete-all",
      },
    },
    permissions: {
      group,
      // WordPress publishes by status, by a scheduled post's date moved into the past (a null date is now), and by a
      // password taken off a published post. A call that sets one of these needs <route>.publish, unless it keeps the
      // item a draft, pending or private.
      valueKeys: [
        { key: "publish", field: "status", values: ["publish", "future"], also: ["date", "date_gmt", "password"] },
      ],
      // force=true deletes for good; without it a delete moves the item to the trash.
      forceFlags: ["force"],
      deletingFlags: [],
    },
  },
)
const coverage = artifacts.find((artifact) => artifact.path === "docs/dev/API_COVERAGE.md")
if (coverage && notes.length)
  // A route is a pattern, `(?P<id>[\d]+)`, which Markdown would read as links and footnotes.
  coverage.content += [
    "",
    "## Routes left out",
    "",
    ...notes.map((n) => `- ${n.replace(/^(\S+): /, "`$1`: ")}`),
    "",
  ].join("\n")
const format = (path: string, content: string) =>
  path.endsWith(".ts")
    ? execFileSync(
        process.execPath,
        [`${root}/node_modules/@biomejs/biome/bin/biome`, "check", "--write", `--stdin-file-path=${path}`],
        { cwd: root, encoding: "utf8", input: content, maxBuffer: 64 * 1024 * 1024 },
      )
    : content
const check = process.argv.includes("--check")
const stale = writeArtifacts(artifacts, { root, check, format })
if (check && stale.length) {
  process.stderr.write(`Generated files are stale: ${stale.join(", ")}; run pnpm generate\n`)
  process.exitCode = 1
}
