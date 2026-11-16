import { resolve } from "node:path"
import { syncDiscovery } from "@wirecat/cli-base/codegen"

// SAMPLE: each Discovery document the CLI covers, by its `name`; the made-up Example Comments address never resolves.
await syncDiscovery(
  { comments: "https://comments.example.invalid/$discovery/rest?version=v1" },
  { dir: resolve(import.meta.dirname, "../spec/clidev") },
)
process.stderr.write("The Discovery documents are refreshed; review their diff, then run pnpm generate\n")
