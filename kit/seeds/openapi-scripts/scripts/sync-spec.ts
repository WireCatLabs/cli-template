import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { parseSpec } from "./spec-model.ts"

interface Source {
  name: string
  url: string
  file: string
}

// The documents come from the sources in provenance.json: list each one the service publishes there, from its
// documentation. Several are joined by mergeOpenApi in scripts/spec-model.ts.
const dir = resolve(import.meta.dirname, "../spec/clidev")
const listed = JSON.parse(readFileSync(join(dir, "provenance.json"), "utf8")) as { sources: Source[] }
const sources = []
for (const { name, url, file } of listed.sources) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: "error" })
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`)
  const text = await response.text()
  const document = parseSpec(text) as { openapi?: unknown; swagger?: unknown }
  if (!String(document.openapi ?? "").startsWith("3.") && document.swagger !== "2.0")
    throw new Error(`${url} is neither an OpenAPI 3 nor a Swagger 2.0 document`)
  writeFileSync(join(dir, file), text)
  sources.push({ name, url, file, sha256: createHash("sha256").update(text).digest("hex") })
}
const provenance = { sources, retrieved_at: new Date().toISOString() }
writeFileSync(join(dir, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`)
process.stderr.write("The API documents are refreshed; review their diff, then run pnpm generate\n")
