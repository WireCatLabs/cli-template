import { parseContentManifest } from "@wirecat/cli-core/content"
import { crmManifestProblems, parseCrmManifest } from "@wirecat/cli-core/crm"
import { parseCliConfig } from "@wirecat/cli-core/manifest"
import { parseTrackerManifest } from "@wirecat/cli-core/tracker"
import { definitions } from "../dist/generated/definitions.js"
import * as api from "../dist/generated/manifest.js"
import config from "../wirecat.config.ts"

// wirecat.config.ts against the generated API: its shape, the auth.verify call, then each source operation and every
// path its map reads.
// Run after pnpm generate, which builds dist/.
const problemsOf = (): { problems: string[]; source: boolean } => {
  try {
    const cli = parseCliConfig(config)
    const verify = cli.auth.preset === "none" ? undefined : cli.auth.verify
    const operation = verify && api.operations.find((one) => one.id === verify.operation)
    // session start sends it through serviceApiCall, which sends only reads.
    const verifying = !verify
      ? []
      : !operation
        ? [`auth.verify: the generated API has no operation ${verify.operation}`]
        : operation.effect !== "read"
          ? [`auth.verify: ${verify.operation} is not a read, and session start sends only reads`]
          : []
    if (!cli.source) return { problems: verifying, source: false }
    if (cli.category === "content") {
      parseContentManifest(cli.source, api)
      return { problems: verifying, source: true }
    }
    if (cli.category === "tracker") {
      // Refuses a map path the selection leaves out, which would read as "the tracker cleared it".
      parseTrackerManifest(cli.source, api)
      return { problems: verifying, source: true }
    }
    return {
      problems: [...verifying, ...crmManifestProblems(parseCrmManifest(cli.source, api), api, definitions)],
      source: true,
    }
  } catch (error) {
    return { problems: [error instanceof Error ? error.message : String(error)], source: false }
  }
}

const { problems, source } = problemsOf()
for (const problem of problems) process.stderr.write(`${problem}\n`)
if (problems.length) process.exit(1)
process.stdout.write(`wirecat.config.ts: ${source ? "the source matches the generated API" : "ok"}\n`)
