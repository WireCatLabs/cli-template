import { join } from "node:path"
import { resolvePaths } from "@wirecat/cli-base"
import {
  commandsCommand,
  configCommand,
  createProgram as createSharedProgram,
  outputFor,
  type ProgramDefinition,
  type ProgramOptions,
  type RunOptions,
  run as runShared,
  skillCommand,
  upgradeCommand,
} from "@wirecat/cli-core/cli"
import { appUpdate } from "@wirecat/cli-core/update"
import type { Command } from "commander"
import { APP, PACKAGE, SKILL } from "./app.js"
import { doctorCommand } from "./commands/doctor.js"
import { mcpCommand } from "./commands/mcp.js"
import { configuration } from "./config.js"

const update = appUpdate({
  packageName: PACKAGE,
  command: APP.command,
  version: APP.version,
  entry: import.meta.url,
  statePath: (env) =>
    join(resolvePaths({ appName: APP.appName, prefix: APP.envPrefix, env }).state, "update-check.json"),
  enabled: (env) => configuration.resolveSettings({}, { env, needsProfile: false }).updateCheck,
  offVariables: [`${APP.envPrefix}_NO_UPDATE_CHECK`],
})

export const definition = (): ProgramDefinition => ({
  app: APP,
  configuration: { resolveSettings: configuration.resolveSettings },
  commands: () => [
    commandsCommand(APP),
    doctorCommand(),
    skillCommand(APP, SKILL),
    mcpCommand(),
    upgradeCommand(APP, PACKAGE, (command) => ({
      ...outputFor(command),
      installer: () => update.installer({}),
      latest: () => update.latest({}),
      install: (argv) => update.runUpdate(argv, {}),
    })),
    configCommand(APP, configuration),
  ],
})

export const createProgram = (options?: ProgramOptions): Command => createSharedProgram(definition(), options)

export const run = (argv: string[], options?: RunOptions): Promise<number> => runShared(argv, definition(), options)
