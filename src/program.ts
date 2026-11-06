import { join } from "node:path"
import { type KeyringStore, resolvePaths } from "@wirecat/cli-base"
import {
  appDoctorCommand,
  appMcpCommand,
  commandsCommand,
  configCommand,
  createProgram as createSharedProgram,
  environmentOf,
  outputFor,
  type ProgramDefinition,
  type ProgramOptions,
  type RunOptions,
  run as runShared,
  runsCommand,
  skillCommand,
  upgradeCommand,
} from "@wirecat/cli-core/cli"
import { appUpdate } from "@wirecat/cli-core/update"
import type { Command } from "commander"
import { commentsCommand } from "./commands/comments.js"
import { sessionCommand } from "./commands/session.js"
import { configuration } from "./config.js"
import { IDENTITY, PACKAGE, SKILL } from "./identity.js"
import { SERVICE } from "./sample/transport.js"
import { holdsToken } from "./token.js"

const update = appUpdate({
  packageName: PACKAGE,
  command: IDENTITY.command,
  version: IDENTITY.version,
  entry: import.meta.url,
  statePath: (env) =>
    join(resolvePaths({ appName: IDENTITY.appName, prefix: IDENTITY.envPrefix, env }).state, "update-check.json"),
  // biome-ignore lint/plugin/no-own-settings: the update check runs before any command exists to give baseContext
  enabled: (env) => configuration.resolveSettings({}, { env, needsProfile: false }).updateCheck,
  offVariables: [`${IDENTITY.envPrefix}_NO_UPDATE_CHECK`],
})

const mcpCommand = () => {
  // cli-core asks `signedIn` with no keyring; the run's own one, a test's `memoryKeyring()`, is taken here. Each
  // program builds its own `mcp`, so a tool call run beside it never swaps the server's keyring (WC-ARCH-22).
  let keyring: KeyringStore | undefined
  const mcp = appMcpCommand(IDENTITY, configuration, {
    name: SERVICE,
    // SAMPLE: name the kinds of text other people wrote that your answers carry (WC-MCP-11).
    untrusted: ["comment text", "author names"],
    permissionExample: "comments.create=deny",
    skill: SKILL,
    signedIn: (profile, env) => holdsToken(env, profile, keyring),
  })
  return mcp.hook("preAction", (_mcp, action) => {
    keyring = environmentOf(action).keyring
  })
}

export const definition = (): ProgramDefinition => ({
  app: IDENTITY,
  // The whole object: cli-core refuses a command by its key only when it gets the permission table too.
  configuration,
  commands: () => [
    commandsCommand(IDENTITY),
    sessionCommand(),
    commentsCommand(),
    appDoctorCommand(IDENTITY, configuration, { packageName: PACKAGE }),
    skillCommand(IDENTITY, SKILL),
    mcpCommand(),
    upgradeCommand(IDENTITY, PACKAGE, (command) => ({
      ...outputFor(command),
      installer: () => update.installer({}),
      latest: () => update.latest({}),
      install: (argv) => update.runUpdate(argv, {}),
    })),
    configCommand(IDENTITY, configuration),
    runsCommand(IDENTITY),
  ],
})

export const createProgram = (options?: ProgramOptions): Command => createSharedProgram(definition(), options)

export const run = (argv: string[], options?: RunOptions): Promise<number> => runShared(argv, definition(), options)
