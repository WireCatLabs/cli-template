<p align="center">
  <img src="https://raw.githubusercontent.com/WireCatLabs/cli-template/main/kit/images/banner.png" alt="cli-template: turn an API into a CLI for AI agents" width="100%">
</p>

# cli-template: turn an API into a CLI for AI agents

<p align="center">
  Turn an API description into a CLI your agent can use in Claude Code, Codex or any app that speaks MCP. One
  command gives you the CLI with an MCP server, and a test for every operation of the API. When the template
  improves, its upgrade command merges the change into the CLI you already edited.
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/WireCatLabs/cli-template/main/kit/images/new.gif" alt="new --spec-url turns PokeAPI's description into 102 commands, answers a real call and starts an MCP server" width="700">
</p>

<p align="center">
  <a href="https://wirecat.dev/en/docs/build-create-cli">Docs</a> ·
  <a href="https://github.com/WireCatLabs/cli-template/blob/main/kit/README.md">Reference</a> ·
  <a href="https://discord.gg/DebENqbRrJ">Discord</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@wirecat/cli-template"><img src="https://img.shields.io/npm/v/@wirecat/cli-template" alt="npm"></a>
  <a href="https://github.com/WireCatLabs/cli-template/actions/workflows/main.yml"><img src="https://github.com/WireCatLabs/cli-template/actions/workflows/main.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/WireCatLabs/cli-template/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License: Apache 2.0"></a>
</p>

From PokeAPI's published description to 102 commands, a real answer and a working MCP server took 16 seconds with an
empty pnpm store and 12 with a warm one, not counting npx's own download. Nine of WireCat's own CLIs, among them
[mail-cli](https://github.com/WireCatLabs/mail-cli) and [notion-cli](https://github.com/WireCatLabs/notion-cli), are
made from it and kept current with its upgrade.

## Quick start

```sh
npx @wirecat/cli-template new poke-cli --preset generic --owner example --sign-in none \
  --spec-url https://raw.githubusercontent.com/PokeAPI/pokeapi/d19c710/openapi.yml
cd poke-cli && pnpm install && pnpm generate
node dist/bin/poke.js personal api pokemon-get --id pikachu --json=name,height,weight
node dist/bin/poke.js personal mcp add claude-code
```

Put your own GitHub name in `--owner` and the address of your service's description in `--spec-url`, JSON or YAML.
`--preset generic` answers the questions only WireCat's own tools need, and any flag you give wins. Without it, `new`
asks for every missing answer and never guesses one.

```mermaid
flowchart LR
  spec["API description<br/>OpenAPI 3 or Swagger 2.0, JSON or YAML,<br/>or Google Discovery"] -->|new, generate| cli["Your CLI<br/>one command per operation"]
  cli --> mcp["MCP server"]
  cli --> skill["Agent skill"]
  mcp --> apps["Claude Code, Codex<br/>or any app that speaks MCP"]
  skill --> apps
```

## What you get

```text
poke-cli/
├── spec/poke/openapi.yaml   the API description, and where it came from
├── src/generated/           types, schemas and a manifest of every operation
├── src/commands/            the api group, the sign-in and your own commands
├── src/api.test.ts          every operation sent to a strict fake of the API
├── skills/                  the agent skill, with pages for the API
├── .github/workflows/       CI, the release and a monthly check
└── bin/release              publishes each version to npm through GitHub
```

- **Your agent gets the API the day you start.** `poke personal mcp serve` serves every command to an agent over MCP,
  and `poke skill install` teaches Claude Code, Codex or Gemini CLI how to use the tool.
- **The token stays in the OS keyring**, under a profile you name, such as `personal` or `work`. No profile is ever
  assumed: a command without one stops and lists the profiles.

## Why cli-template

- **It keeps up after you edit.** `upgrade` merges each template change into your CLI file by file, and asks before
  it touches a file you changed. A one-time generator leaves you to copy its later fixes by hand.
- **One set of commands, three ways in.** The same commands are the CLI, the MCP tools and the skill, so what you
  test is what the agent runs.
- **You decide what an agent may do.** Each profile sets `allow`, `readonly` or `deny` per command and per API
  operation. An operation that deletes needs its own permission key, and the api group refuses to build without one.
- **Tests come with the API.** `src/api.test.ts` sends every operation to a fake built from the description, which
  refuses a request the description does not allow. It also checks that a denied delete stops before anything is sent.
- **Google APIs too.** Besides OpenAPI 3 and Swagger 2.0 it reads Google's Discovery documents.

## How it compares

Checked on the tools' own pages in November 2026. "Not documented" means the page does not say.

| | What it makes | For agents | After you edit it | Tests in the project | License |
| --- | --- | --- | --- | --- | --- |
| **cli-template** | A TypeScript CLI project | MCP server (stdio and HTTP) and a skill, from the same commands | `upgrade` merges template changes | One per operation, against a strict fake | Apache-2.0 |
| [Speakeasy](https://www.speakeasy.com/docs/cli-generation/create-cli.md) | A Go CLI, and an [MCP server](https://www.speakeasy.com/docs/standalone-mcp/build-server) as a separate product | Agent mode for Claude Code, Cursor and others | Not documented | Contract tests, offered as a separate product | Vendor service, the CLI generator labelled alpha in its docs |
| [openapi-mcp-generator](https://github.com/harsha-iiiv/openapi-mcp-generator) | A TypeScript MCP server | MCP only | `--force` writes over your edits | Not documented | MIT |
| [FastMCP `from_openapi`](https://gofastmcp.com/integrations/openapi) | An MCP server built at run time, in Python | MCP only | No code is generated | Not documented | Apache-2.0 |
| [api2cli](https://github.com/alexknowshtml/api2cli) | A Commander.js CLI and a skill, written by a Claude Code skill | A Claude Code skill | A one-time result | None shown | MIT |

What cli-template does not do. It is Node and TypeScript only (Node 22.16 or 24 and later, with pnpm), and it
builds no single binary. The api group calls one base URL, and its generator stops on a keyword it does not
understand, so some descriptions need a patch with its reason before they generate. The CLI signs in with a token: OAuth is yours to wire up, from cli-core's `oauth` module. The skeleton keeps
no data of its own and has no search.

## From your API description

`new --spec-url <url>` downloads the description (https only, at most 20 MB), puts its servers into the hosts the
CLI may reach, and records the address and a hash in `spec/<command>/provenance.json`. `pnpm generate` then writes
one command per operation, its permissions, its tests and the skill's API pages.

When the generator stops on part of the description, it names the place. Add a patch with its reason in
`scripts/spec-model.ts`, or set what to treat as a delete in `scripts/generate.ts`, as the
[OpenAPI guide](kit/skills/new-cli/references/openapi.md) shows. When the service changes its API, `pnpm spec:sync`
downloads it again and `pnpm generate` follows.

## Keep it current

Run `npx @wirecat/cli-template upgrade` in your CLI, with a clean git working tree. For each file the template
changed it offers to merge the change, take the template's file, skip it or show the diff. `--dry-run` lists what
each file would get and writes nothing. The files that are yours from the start, such as your commands in
`src/commands/`, `README.md` and `package.json`, are never touched. The details are in the
[kit reference](kit/README.md#upgrade).

## Have an agent build it

```sh
npx skills add WireCatLabs/cli-template
```

This installs the [api-to-cli skill](SKILL.md) for Claude Code, Codex and other agents. Ask your agent for a CLI for
a service, and it finds the description, runs `new`, fixes what the generator stops on, and wires the MCP server. It
never runs the CLI against your account without asking. WireCat's own CLIs use the longer
[new-cli skill](kit/skills/new-cli/SKILL.md), which also keeps the research and reviews in WireCat's repositories.

## Publishing outside WireCat

A CLI made outside WireCat publishes under its own npm scope, such as `@example/poke-cli`. `new --preset generic`
sets it up for that, with its own MCP Registry name and its own monthly CI run, and no recorded live check before a
release. `bin/setup-github` creates the
repository, and `bin/release --first` publishes the first version from your computer. The steps, with npm trusted
publishing, are in [Publishing outside WireCat](kit/README.md#publishing-outside-wirecat).

## This repository is also the skeleton

`new` copies this repository into your CLI. Its command word is the placeholder `clidev`, which `new` replaces with
yours. It is not `cli-dev`, the developer tool in cli-base. `new` writes a fresh README for each new CLI, so this
page never reaches one.

To work on the template itself:

```sh
pnpm install
pnpm build
node dist/bin/clidev.js doctor
```

The skeleton's own pages describe `clidev` as a user sees it: [install](docs/installation.md),
[use it](docs/usage.md), [settings](docs/configuration.md), [commands](docs/commands.md),
[when something goes wrong](docs/troubleshooting.md) and [security](docs/security.md). The working rules for people
and agents are in [AGENTS.md](AGENTS.md), how `new` and `upgrade` read this repository is in
[kit/DEVELOPING.md](kit/DEVELOPING.md), and `pnpm release:check` runs every check before a release.

Report a vulnerability privately as [SECURITY.md](SECURITY.md) says. The changes are in [CHANGELOG.md](CHANGELOG.md).
