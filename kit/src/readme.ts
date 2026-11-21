import { type SourceKind, sourceBullet } from "./config-wiring.js"
import type { Names } from "./manifest.js"
import { WORDPRESS_KEYS, wordpressSignIn } from "./wordpress.js"

type Facts = { tagline: string; service?: string; signIn: string; api: boolean; wordpress?: boolean }
export type ReadmeFacts = Facts & { source?: SourceKind }

// WC-DOC-7's order, tg-cli's: the gain first, then why, then the steps. Every command in it runs as written.
// The links row is WC-DOC-24's, with full GitHub links because npm ships the README without docs/. No community
// link: only the owner knows where the tool's audience talks.
export const cliReadme = (names: Names, facts: ReadmeFacts): string => {
  const cli = names.command
  const service = facts.service ?? cli
  const signsIn = facts.signIn !== "none"
  const npm = `https://www.npmjs.com/package/${names.package}`
  const docs = `https://github.com/${names.owner}/${names.name}/blob/main/docs`
  return [
    `# ${cli}: ${service} CLI for AI agents`,
    "",
    `${facts.tagline.replace(/\.$/, "")}. One tool for you and for Claude Code, Codex or any agent that speaks MCP.`,
    "",
    '<p align="center">',
    `  <a href="${docs}/index.md">Docs</a> ·`,
    `  <a href="${docs}/installation.md">Install</a> ·`,
    `  <a href="${docs}/usage.md">Usage</a>`,
    "</p>",
    "",
    ...(facts.api
      ? [
          `- **Every operation of the ${service} API is a command.** \`${cli} api list\` shows them, each with its own`,
          "  flags, help and `--json`.",
        ]
      : [`- **Commands made for the job.** \`${cli} commands\` lists them, each with its own help and \`--json\`.`]),
    ...(facts.source ? sourceBullet(cli, facts.source) : []),
    "- **Your agent gets the same commands as tools.** An MCP server and an agent skill come with it, no second codebase.",
    "- **You decide what it may change.** Each profile allows, asks or denies each command, and a delete needs a key of",
    "  its own.",
    "",
    "## What you get",
    "",
    `Ask your agent about ${service}. It finds the right command with \`${cli} commands --json\`, runs it, and answers`,
    `from the result. A command it may not run stops with a clear refusal before anything reaches ${service}.`,
    "",
    `## Why ${cli}`,
    "",
    ...(signsIn ? ["- The token stays in the system keyring, and every command names the profile it uses."] : []),
    ...(facts.api
      ? ["- Every operation is tested against a strict fake built from the API description, in `src/api.test.ts`."]
      : []),
    "- `--dry-run` shows what a write would send, and sends nothing.",
    "",
    "## Quick start",
    "",
    "```sh",
    "pnpm install",
    "pnpm build",
    `node dist/bin/${cli}.js doctor`,
    "```",
    "",
    `Once it is on npm: \`npm install -g ${names.package}\`, then \`${cli} doctor\`. Every command that uses an account`,
    `starts with a profile, a name you choose: \`${cli} personal config show\`.`,
    ...(facts.wordpress
      ? wordpressSignIn(cli)
      : signsIn
        ? [
            "",
            `Sign in once with \`${cli} personal session start\`. It asks for the token and keeps it in the keyring.`,
          ]
        : []),
    "",
    "## Use it with your agent",
    "",
    "```sh",
    `${cli} personal mcp add claude-code`,
    `${cli} skill install`,
    "```",
    "",
    `\`${cli} personal mcp check\` shows the tools your agent gets. \`mcp add\` refuses a profile whose tools may write`,
    `until you review its permissions and pass \`--allow-writes\`. \`${cli} personal mcp config\` prints the setup for`,
    "any other MCP client.",
    "",
    ...(facts.api
      ? [
          // NEED-2731 B: `ask` stays the default for the api group's deletes; over MCP nobody answers it, so say so.
          "Over MCP nobody is there to answer `ask`, so the agent runs the API's writes and deletes without asking. Each",
          `one is kept as a run in \`${cli} personal runs list\`. To stop that, make the profile read-only with`,
          `\`${cli} personal config set permissions.api readonly\`, or refuse one operation with`,
          `\`${cli} personal config set permissions.api.<operation> deny\`. \`${cli} api list\` names the operations.`,
          "",
        ]
      : []),
    ...(facts.wordpress ? WORDPRESS_KEYS : []),
    "## What it can do",
    "",
    "[docs/commands.md](docs/commands.md) lists every command, and `--help` after any of them shows its flags.",
    "",
    "## Settings and permissions",
    "",
    `\`${cli} personal config show\` prints the profile's settings. See [docs/configuration.md](docs/configuration.md).`,
    "",
    "## Security",
    "",
    "See [docs/security.md](docs/security.md), and [SECURITY.md](SECURITY.md) to report a problem.",
    "",
    "## When something goes wrong",
    "",
    `Run \`${cli} doctor\` and see [docs/troubleshooting.md](docs/troubleshooting.md). Report a bug on`,
    `[GitHub](https://github.com/${names.owner}/${names.name}/issues).`,
    "",
    "## Development",
    "",
    `Started from [cli-template](https://github.com/WireCatLabs/cli-template). Its design is in`,
    "[docs/dev/DESIGN.md](docs/dev/DESIGN.md), and the working rules are in [AGENTS.md](AGENTS.md). Published as",
    `[${names.package}](${npm}).`,
    "",
  ].join("\n")
}
