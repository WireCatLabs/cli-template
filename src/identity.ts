import type { ManifestIdentity } from "@wirecat/cli-base/wcat/manifest"
import type { AppIdentity } from "@wirecat/cli-core/cli"
import { VERSION } from "./version.js"

// SAMPLE: your service's name, as the sign-in, the MCP server and an offline refusal say it.
export const SERVICE = "Example Comments"

export const PACKAGE = "@wirecat/clidev-cli"

export const IDENTITY: AppIdentity = {
  command: "clidev",
  appName: "clidev-app",
  envPrefix: "CLIDEV",
  description: "a new WireCat CLI, started from cli-template",
  version: VERSION,
  issues: "https://github.com/WireCatLabs/clidev-cli/issues/new",
  messenger: false,
}

// What `wcat` and WireCat Desktop show before the tool is installed: rewrite the tagline and the sign-in texts for
// yours. The bin passes it to wcatStart before anything else loads; src/wcat.ts adds the permission keys.
export const DESKTOP = {
  ...IDENTITY,
  docs: "https://github.com/WireCatLabs/clidev-cli#readme",
  // SAMPLE: every host the CLI contacts (WC-CMD-32); src/sample/transport.ts reaches only these.
  hosts: ["comments.example.invalid"],
  tagline: "A new WireCat CLI, started from cli-template",
  signIn: {
    gives: "Lets your agent read and change your account through clidev.",
    asks: "An API token or key from the service.",
    // Desktop signs in from this alone: it asks for the token in its window and sends it on stdin.
    methods: [{ id: "token", label: "API token", words: ["{profile}", "session", "start", "--json"], stdin: true }],
  },
} satisfies ManifestIdentity

export const SKILL = new URL("../skills/clidev-app/SKILL.md", import.meta.url)
