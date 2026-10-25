# Use it

This page explains how a command is built, and how an agent uses the tool. Read it before your first command.

## The profile comes first

A profile is a name you choose for one account. It is the first word of every command that uses an account:

```sh
clidev personal config show
```

`CLIDEV_PROFILE=personal` does the same for one shell session. No profile is ever assumed, not even the only one: a
command without one stops with exit code 2 and lists the profiles on this computer.

## Output for scripts

Every command except `mcp` takes `--json`, and prints one JSON value on stdout. Errors are JSON on stderr, with a code to branch
on. The [command reference](commands.md) lists the codes.

## Agents

`clidev skill install` puts the tool's skill where Claude Code, Codex and Gemini CLI look for it. `clidev personal mcp`
serves the profile's commands over MCP, on stdin and stdout:

```sh
claude mcp add clidev -- clidev personal mcp
```

The server offers every command, the ones that write included. The profile's permissions decide what runs; see
[settings](configuration.md#permissions).
