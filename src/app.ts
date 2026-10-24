import type { AppIdentity } from "@wirecat/cli-core/cli"
import { VERSION } from "./version.js"

export const PACKAGE = "@wirecat/cli-template"

export const APP: AppIdentity = {
  command: "app",
  appName: "app-cli",
  envPrefix: "APP",
  description: "a new WireCat CLI, started from cli-template",
  version: VERSION,
  issues: "https://github.com/WireCatLabs/cli-template/issues/new",
}

export const SKILL = new URL("../skills/app-cli/SKILL.md", import.meta.url)
