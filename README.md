# clidev

`clidev` is a placeholder. `npx @wirecat/cli-template new` replaces it with your CLI's command word, and
`clidev-cli` with your CLI's name. It is not `cli-dev`, the developer tool in cli-base.

`clidev` is a command-line tool started from [cli-template](https://github.com/WireCatLabs/cli-template), the kit for
new WireCat CLIs. It is a working skeleton: the shared root commands, the settings, the agent skill and the MCP
server run, and every check of the WireCat standards passes. It does not connect to a service yet. Replace this page
with the tool's own introduction once it does.

To start a new CLI from the template:

```sh
npx @wirecat/cli-template new cal-cli --command cal --package @wirecat/cal-cli --owner WireCatLabs
```

## Quick start

```sh
pnpm install
pnpm build
node dist/bin/clidev.js doctor
```

`doctor` needs no profile. Every command that uses an account starts with one, a name you choose for that account,
such as `personal` in `clidev personal config show`; none is ever assumed. `CLIDEV_PROFILE=personal` does the same for a whole shell session.

## What you can do

| Command | What it does |
| --- | --- |
| `clidev doctor` | Checks this installation: version, paths, settings and profiles, without the network |
| `clidev commands --json` | Prints every command as JSON, for agents and scripts |
| `clidev personal config show` | Shows each setting and where it came from |
| `clidev skill install` | Installs the agent skill for Claude Code, Codex, Gemini CLI and OpenClaw; `--for hermes` for Hermes Agent |
| `clidev personal mcp` | Serves the profile's commands to an AI agent over MCP; `--http` for agents in the browser |
| `clidev runs list` | Lists recorded runs, newest first: every command that failed is kept |
| `clidev upgrade --check` | Says whether a newer version is on npm |

## For AI agents

`clidev skill show` prints the rules an agent follows with this tool. `clidev personal mcp` serves every command to an
agent, writes included: the profile's permissions decide what runs. See [MCP and permissions](docs/usage.md#agents).

## Why this template

A new WireCat CLI must meet the same standards as the others from its first commit: the shared commands, the
settings, the agent skill, MCP, the checks and the release. Built by hand, that is days of copying and some of it
is missed. `new` gives a CLI that already passes every check, so the work starts on the service itself. `upgrade`
keeps the shared files in step later, so a CLI made today does not drift from one made next year.

## Main features

- **`new`** copies the skeleton, renames `clidev` to your command word, and writes the design answers into
  `docs/dev/DESIGN.md`. It asks for each missing answer and never guesses one.
- **`upgrade`** merges each template change into your CLI file by file, and asks before it touches a file you changed.
- **The skeleton runs.** The shared root commands, settings with permissions, the agent skill and the MCP server
  work before a line of your own code.
- **Every check is wired in:** lint, types, tests with a coverage floor, command contracts, the docs checks and the
  release script.

The copy tool is described in [kit/README.md](kit/README.md).

## Profiles

A profile is a name you choose for one account, such as `personal` or `work`. It is the first word of every command
that uses an account. No profile is ever assumed: a command without one stops and lists the profiles on this
computer. The skeleton has no sign-in yet; the CLI built from it adds one.

## Settings and permissions

`clidev personal config show` lists each setting and where it came from. A profile's `permissions` say what a command
may do: `allow`, `ask`, `readonly` or `deny`. `CLIDEV_READ_ONLY=1` refuses every write. See
[Settings](docs/configuration.md).

## Limits

The skeleton connects to no service, keeps no messages and has no commands of its own beyond the shared ones above.

## Security

`clidev` keeps its settings and state on this computer and sends nothing to any service yet. See
[Security](docs/security.md), and report a vulnerability privately as [SECURITY.md](SECURITY.md) says.

## When it does not work

Run `clidev doctor` first: it checks the installation without the network.
[When something goes wrong](docs/troubleshooting.md) lists the usual symptoms.

## Documentation

- [Install](docs/installation.md)
- [Use it](docs/usage.md)
- [Settings](docs/configuration.md)
- [Commands](docs/commands.md)
- [When something goes wrong](docs/troubleshooting.md)
- [Security](docs/security.md)

## Development

The working rules for people and agents are in [AGENTS.md](AGENTS.md). `pnpm release:check` runs the checks
before a release; its command audit installs the published WireCat CLIs from npm to compare with them.
`pnpm package:check` installs the packed package and checks what it ships, and
`pnpm security:no-leak` checks that nothing private reaches the output. The changes are in [CHANGELOG.md](CHANGELOG.md).
