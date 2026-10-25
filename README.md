# app

`app` is a command-line tool started from [cli-template](https://github.com/WireCatLabs/cli-template), the kit for
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
node dist/bin/app.js personal doctor
```

`personal` is the profile: a name you choose for one account. Every command that uses an account starts with it, and
none is ever assumed. `APP_PROFILE=personal` does the same for a whole shell session.

## What you can do

| Command | What it does |
| --- | --- |
| `app personal doctor` | Checks this installation: version, paths, settings and profiles, without the network |
| `app commands --json` | Prints every command as JSON, for agents and scripts |
| `app personal config show` | Shows each setting and where it came from |
| `app skill install` | Installs the agent skill for Claude Code, Codex and Gemini CLI |
| `app personal mcp` | Serves the profile's commands to an AI agent over MCP |
| `app upgrade --check` | Says whether a newer version is on npm |

## For AI agents

`app skill show` prints the rules an agent follows with this tool. `app personal mcp` serves every command to an
agent, writes included: the profile's permissions decide what runs. See [MCP and permissions](docs/usage.md#agents).

## Documentation

- [Install](docs/installation.md)
- [Use it](docs/usage.md)
- [Settings](docs/configuration.md)
- [Commands](docs/commands.md)
- [When something goes wrong](docs/troubleshooting.md)
- [Security](docs/security.md)

## Development

The working rules for people and agents are in [AGENTS.md](AGENTS.md). `pnpm release:check` runs every check the
standards ask for. The changes are in [CHANGELOG.md](CHANGELOG.md).
