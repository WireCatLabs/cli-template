import { existsSync } from "node:fs"
import { CliError, configFilePath, resolvePaths } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import {
  environmentOf,
  itemOf,
  LOCAL_READ,
  outputFor,
  profileFree,
  readOnlyLockOf,
  renderAnswer,
} from "@wirecat/cli-core/cli"
import { Command } from "commander"
import { configuration } from "../config.js"
import { IDENTITY } from "../identity.js"

const failure = (error: unknown) => {
  if (error instanceof CliError) return error.message
  throw error
}

/** It is run when everything else is broken, so a problem in the config file is a field in the answer, never a throw. */
export const doctorReport = (env: NodeJS.ProcessEnv) => {
  const paths = resolvePaths({ appName: IDENTITY.appName, prefix: IDENTITY.envPrefix, env })
  const common = {
    version: IDENTITY.version,
    runtime: { node: process.versions.node, platform: process.platform },
    paths: { config: paths.config, state: paths.state, cache: paths.cache },
  }
  const readOnly = readOnlyLockOf(IDENTITY, env) ?? null
  try {
    const settings = configuration.resolveSettings({}, { env, readOnly: true, needsProfile: false, withIssues: true })
    return {
      ...common,
      config: { path: settings.configPath, found: settings.configFound, issues: settings.configIssues ?? [] },
      profiles: settings.configuredProfiles,
      read_only: readOnly,
    }
  } catch (error) {
    const file = configFilePath(paths.config)
    return {
      ...common,
      config: { path: file, found: existsSync(file), issues: [] },
      settings: { error: failure(error) },
      profiles: null,
      read_only: readOnly,
    }
  }
}

export const doctorCommand = (): Command =>
  profileFree(
    annotate(new Command("doctor"), {
      effects: LOCAL_READ,
      examples: [`${IDENTITY.command} doctor`, `${IDENTITY.command} doctor --json`],
    }),
  )
    .description("check this installation: version, paths, config, profiles; no keyring or network")
    .action(function (this: Command) {
      const env = environmentOf(this).env ?? process.env
      renderAnswer(this, outputFor(this), itemOf(doctorReport(env)))
    })
