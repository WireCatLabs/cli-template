import { resolve } from "node:path"
import { syncWpJson } from "@wirecat/cli-base/codegen"

// SAMPLE: a plain WordPress, no plugins, and the version it runs, which the index does not say. The CLI serves every
// site, so take the index from your own install (a WordPress in Docker), never from a site with plugins.
await syncWpJson({
  root: "https://comments.example.invalid/wp-json/",
  version: "6.9.4",
  dir: resolve(import.meta.dirname, "../spec/clidev"),
})
process.stderr.write("The WordPress index is refreshed; review its diff, then run pnpm generate\n")
