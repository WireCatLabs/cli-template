import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  type ApiModel,
  adaptOpenApi,
  mergeOpenApi,
  patchSpec,
  type SpecPatch,
  upgradeToOpenApi3,
} from "@wirecat/cli-base/codegen"

interface Provenance {
  sources: { name: string; url: string; file: string; sha256: string }[]
}

// SAMPLE: corrections to the service's document, each with the reason from its documentation or a captured answer.
const PATCHES: SpecPatch[] = []

/**
 * The documents as committed, checked against provenance.json, a Swagger one upgraded to OpenAPI 3, joined when there
 * are several, then corrected.
 */
export const specModel = async (root: string): Promise<{ model: ApiModel; notes: string[] }> => {
  const dir = join(root, "spec/clidev")
  const provenance = JSON.parse(readFileSync(join(dir, "provenance.json"), "utf8")) as Provenance
  const sources = await Promise.all(
    provenance.sources.map(async (source) => {
      const text = readFileSync(join(dir, source.file), "utf8")
      if (createHash("sha256").update(text).digest("hex") !== source.sha256)
        throw new Error(`spec/clidev/${source.file} does not match provenance.json; run pnpm spec:sync`)
      const document = JSON.parse(text) as { openapi?: unknown }
      return {
        name: source.name,
        url: source.url,
        document: document.openapi ? document : await upgradeToOpenApi3(document),
      }
    }),
  )
  const [only] = sources
  const merged =
    sources.length === 1 && only
      ? { document: only.document, notes: [] as string[] }
      : (() => {
          const { document, report } = mergeOpenApi(sources, { title: "clidev", version: "1" })
          return { document, notes: [...report.merged, ...report.renamed].map((line) => `merged: ${line}`) }
        })()
  const { document, applied } = patchSpec(merged.document, { patches: PATCHES })
  const model = adaptOpenApi(document, {
    sourceUrl: provenance.sources.map((source) => source.url).join(" "),
    sourceRevision: provenance.sources.map((source) => source.sha256).join(" "),
  })
  return { model, notes: [...merged.notes, ...applied.map(({ pointer, reason }) => `patched ${pointer}: ${reason}`)] }
}
