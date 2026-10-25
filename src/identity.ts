import type { AppIdentity } from "@wirecat/cli-core/cli"
import { VERSION } from "./version.js"

export const PACKAGE = "@wirecat/clidev-cli"

export const IDENTITY: AppIdentity = {
  command: "clidev",
  appName: "clidev-cli",
  envPrefix: "CLIDEV",
  description: "a new WireCat CLI, started from cli-template",
  version: VERSION,
  issues: "https://github.com/WireCatLabs/clidev-cli/issues/new",
  messenger: false,
}

export const SKILL = new URL("../skills/clidev-cli/SKILL.md", import.meta.url)
