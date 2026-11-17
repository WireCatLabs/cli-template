import { join } from "node:path"
import { type ApiModel, adaptGraphql, readGraphql } from "@wirecat/cli-base/codegen"

// SAMPLE: the endpoint every operation is sent to.
const URL = "https://comments.example.invalid/graphql"

/** The schema as committed; readGraphql refuses one whose hash no longer matches provenance.json. */
export const specModel = async (root: string): Promise<{ model: ApiModel; notes: string[] }> => {
  const dir = join(root, "spec/clidev")
  const model = adaptGraphql(readGraphql(dir), {
    url: URL,
    sourceUrl: URL,
    // SAMPLE: the schema's own scalars as the JSON they travel as, such as { DateTime: { type: "string" } }; a scalar
    // left out stops generation.
    scalars: {},
    // SAMPLE: field → why the CLI leaves it out, as `mutation.<name>` when both roots have one of that name.
    exclude: {},
  })
  return { model, notes: [] }
}
