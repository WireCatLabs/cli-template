import { existsSync } from "node:fs"
import { CliError, configFilePath, resolvePaths } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import { environmentOf, itemOf, LOCAL_READ, outputFor, readOnlyLockOf, renderAnswer } from "@wirecat/cli-core/cli"
import { Command } from "commander"
import { APP } from "../app.js"
import { configuration } from "../config.js"

const failure = (error: unknown) => {
  if (error instanceof CliError) return error.message
  throw error
}

/** It is run when everything else is broken, so an unreadable config is a field in the answer, never a throw. */
export const doctorReport = (env: NodeJS.ProcessEnv) => {
  const paths = resolvePaths({ appName: APP.appName, prefix: APP.envPrefix, env })
  const file = configFilePath(paths.config)
  let config: { path: string; exists: boolean; error?: string }
  let profiles: string[] | null = null
  try {
    profiles = configuration.configuredProfiles({ env, readOnly: true })
    config = { path: file, exists: existsSync(file) }
  } catch (error) {
    config = { path: file, exists: existsSync(file), error: failure(error) }
  }
  return {
    version: APP.version,
    runtime: { node: process.versions.node, platform: process.platform },
    paths: { config: paths.config, state: paths.state, cache: paths.cache },
    config,
    profiles,
    read_only: readOnlyLockOf(APP, env) ?? null,
  }
}

export const doctorCommand = (): Command =>
  annotate(new Command("doctor"), {
    effects: LOCAL_READ,
    examples: [`${APP.command} doctor`, `${APP.command} personal doctor --json`],
  })
    .description("check this installation: version, paths, config, profiles; no keyring or network")
    .action(function (this: Command) {
      const env = environmentOf(this).env ?? process.env
      renderAnswer(this, outputFor(this), itemOf(doctorReport(env)))
    })
