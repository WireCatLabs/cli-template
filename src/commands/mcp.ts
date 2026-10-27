import { CliError } from "@wirecat/cli-base"
import { annotate, describeProgram } from "@wirecat/cli-base/commands"
import {
  changesAuthorityAt,
  environmentOf,
  type GlobalFlags,
  httpTokenFile,
  itemOf,
  MCP_HTTP_DEFAULT_PORT,
  mcpServerCommand,
  outputFor,
  REMOTE_WRITE,
  refuseUnderReadOnly,
  renderAnswer,
  rootOf,
} from "@wirecat/cli-core/cli"
import { portOf, publicUrlOf } from "@wirecat/cli-core/mcp"
import { Command } from "commander"
import { configuration } from "../config.js"
import { IDENTITY } from "../identity.js"

interface McpFlags extends GlobalFlags {
  http?: boolean
  port?: string
  publicUrl?: string
  revoke?: boolean
}

const settingsOf = (command: Command) => {
  const flags = command.optsWithGlobals<McpFlags>()
  const env = environmentOf(command).env ?? process.env
  const { profile } = configuration.resolveSettings(flags, { env })
  return { flags, env, profile, tokenFile: httpTokenFile(IDENTITY, profile, env) }
}

const withPermission = (command: Command) =>
  command.option(
    "--permission <key=level>",
    "make a permission stricter for this server only, like messages.send=deny; it never loosens the profile; repeat for more keys",
    (value: string, previous: string[] = []) => [...previous, value],
  )

export const mcpCommand = (): Command =>
  withPermission(
    annotate(new Command("mcp"), {
      effects: REMOTE_WRITE,
      lifetime: "persistent",
      mcp: false,
      examples: [`${IDENTITY.command} personal mcp`],
    })
      .summary("serve this profile's commands to an AI agent")
      .description(
        `serve this profile's commands to an agent over MCP, on stdin and stdout, writes included; the profile's permissions decide — \`claude mcp add ${IDENTITY.command} -- ${IDENTITY.command} personal mcp\``,
      ),
  )
    .option(
      "--http",
      "serve over HTTP on 127.0.0.1 for ChatGPT and Claude in the browser, behind your tunnel; the profile's permissions decide",
    )
    .option("--port <port>", `the local port for --http (default ${MCP_HTTP_DEFAULT_PORT})`)
    .option("--public-url <url>", "the tunnel's https address the browser apps use, e.g. https://<name>.ts.net")
    .option("--revoke", "forget every login given to a browser app; each must log in again")
    .addCommand(
      mcpServerCommand({
        example: `${IDENTITY.command} personal`,
        target: (self) => {
          const { env, profile, tokenFile } = settingsOf(self)
          return {
            invocation: `${IDENTITY.command} ${profile}`,
            profile,
            envPrefix: IDENTITY.envPrefix,
            env,
            tokenFile,
            argv: [profile, "mcp", "--http"],
            version: IDENTITY.version,
          }
        },
        answer: (self, item, lines) => renderAnswer(self, outputFor(self), itemOf(item), () => lines.join("\n")),
      }),
    )
    .action(async function (this: Command) {
      const { flags, env, profile, tokenFile } = settingsOf(this)
      if (flags.revoke) {
        refuseUnderReadOnly(this, "mcp --revoke")
        const { revokeAll } = await import("@wirecat/cli-core/mcp")
        revokeAll(tokenFile)
        renderAnswer(this, outputFor(this), itemOf({ revoked: true, profile }))
        return
      }
      if (!flags.http && (flags.json || flags.jsonl))
        throw new CliError("validation_error", "MCP over stdio controls its own output; leave out --json and --jsonl")
      const environment = environmentOf(this)
      const run = environment.runCommand
      if (!run) throw new Error("mcp runs inside the program's run(), which provides runCommand")
      const program = rootOf(this)
      const options = {
        profile,
        commands: describeProgram(program),
        levels: () => configuration.resolveSettings(flags, { env }).permissions,
        authority: changesAuthorityAt(program),
        run,
        ...(environment.signal ? { signal: environment.signal } : {}),
      }
      // Loaded here, not at the top: every other command would otherwise pay for the MCP SDK.
      const { serveMcp, serveMcpOverHttp } = await import("../mcp.js")
      if (!flags.http) return serveMcp(options)
      const { renderer } = outputFor(this)
      await serveMcpOverHttp(options, {
        publicUrl: publicUrlOf(flags.publicUrl, {
          missing: "--http",
          reaches: `the browser apps reach ${IDENTITY.command}`,
        }),
        port: portOf(flags.port, MCP_HTTP_DEFAULT_PORT),
        tokenFile,
        background: env[`${IDENTITY.envPrefix}_MCP_HTTP`] !== undefined,
        note: (line) => renderer.note(line),
      })
    })
