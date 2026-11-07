import type { ManifestIdentity } from "@wirecat/cli-base/wcat/manifest"
import type { AppIdentity } from "@wirecat/cli-core/cli"
import { VERSION } from "./version.js"

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
export const DESKTOP: ManifestIdentity = {
  ...IDENTITY,
  docs: "https://github.com/WireCatLabs/clidev-cli#readme",
  tagline: "A new WireCat CLI, started from cli-template",
  signIn: {
    gives: "Lets your agent read and change your account through clidev.",
    asks: "An API token or key from the service.",
  },
}

export const SKILL = new URL("../skills/clidev-app/SKILL.md", import.meta.url)
