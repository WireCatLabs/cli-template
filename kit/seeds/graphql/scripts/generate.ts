import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import {
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
const { model, notes } = await specModel(root)
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
    // SAMPLE: operation id → { effect, reason } where the HTTP method misleads, as a POST that deletes.
    overrides: {},
    // SAMPLE: true when the service's POST …/search and …/query only read.
    readingPosts: false,
    // SAMPLE: command names from the paths; map an operation whose name comes out wrong in `commands`.
    names: { fromPath: true },
    // SAMPLE: the permission group, and the body fields or query parameters that delete when true.
    permissions: { group: "comments", deletingFlags: [] },
    // SAMPLE: how each read pages, found from the spec; an override's `pagination` wins.
    pagination: true,
    // SAMPLE: a GraphQL schema names no sign-in, so the header the token travels in is set here, from the service's
    // documentation: an API key as it is (`Authorization: <key>`), or `{ type: "http", scheme: "bearer" }`.
    auth: {
      securitySchemes: { key: { type: "apiKey", in: "header", name: "Authorization" } },
      security: [{ key: [] }],
      reason: "a GraphQL schema names no sign-in; the service's documentation sends the key in Authorization",
    },
  },
)
const coverage = artifacts.find((artifact) => artifact.path === "docs/dev/API_COVERAGE.md")
if (coverage && notes.length)
  coverage.content += ["", "## Spec corrections", "", ...notes.map((n) => `- ${n}`), ""].join("\n")
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
