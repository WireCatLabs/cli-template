---
name: api-to-cli
description: Turn a service's OpenAPI or Swagger description into a TypeScript CLI that people and AI agents both use, with an MCP server, an agent skill, keyring sign-in, per-command permissions and a test for every operation, started from cli-template and kept current by its upgrade. Use when asked to build a CLI or an MCP server for an API, give an agent access to a service, or turn an OpenAPI spec into tools.
---

# A CLI and MCP server from an API description

You build a command-line tool for one service from its published API description. Every operation becomes a
command, the same commands are served to agents over MCP, and each one is tested against a strict fake built from the
description. The tool is a Node project the person owns and publishes under their own npm scope.

Needs Node 22.16 or later and pnpm.

## Rules that hold all the way

- **Never run the CLI against the person's real account** unless they asked for that run. Tests use the fake; a read
  you try by hand needs their yes first.
- **Never pick a profile for them.** Every account command starts with a profile name they chose: `<cli> personal …`.
- **A token is never an argument or a line in a file you write.** `session start` reads it hidden or from stdin and
  keeps it in the system keyring.
- **Correct the description only with a reason** from the service's documentation or a captured answer, never from
  memory.

## 1. Find the description

Take it from the service's own documentation or its official repository, never a third-party copy. Prefer a URL that
does not change under you, such as a tagged release or a commit. JSON and YAML both work, OpenAPI 3.0, 3.1 or
Swagger 2.0. Note how the service signs in: a token or key, OAuth, or nothing.

## 2. Make the project

```sh
npx @wirecat/cli-template new acme-cli --preset generic --owner your-github-name \
  --spec-url https://example.com/openapi.yaml
```

Replace the name, the owner and the URL with the real ones before running it. `--preset generic` answers the other
questions with neutral defaults: the command word is the name without `-cli`, the package `@<owner>/<name>`, and a
token sign-in. Add `--sign-in none` for an API without one, or `--sign-in oauth`. `npx @wirecat/cli-template --help`
lists every flag.

`new` downloads the description, puts its servers into the hosts the CLI may reach, and prints the next steps. Follow
them in order:

```sh
cd acme-cli
pnpm install
pnpm generate
```

## 3. When generation stops

The generator is strict on purpose: a keyword it does not understand stops it and names the place, because a dropped
constraint becomes a request the server refuses. For each problem it lists:

- add a patch to `PATCHES` in `scripts/spec-model.ts`, with the reason from the documentation, such as a body type
  the service really accepts, or the path item without an operation the CLI cannot send;
- or set the matching option in `scripts/generate.ts`: `overrides` for a POST that deletes, `names` for a command
  name that comes out wrong, `permissions` for the fields that delete, `auth` for a missing or wrong sign-in.

Run `pnpm generate` again until it passes, then the contract updates `new` printed, and `pnpm test`. Read
`docs/dev/API_COVERAGE.md`: every operation is a command or is left out with its reason.

## 4. Try it

```sh
node dist/bin/acme.js api list
node dist/bin/acme.js personal api --help
```

For a service with a token, ask the person to sign in themselves with `node dist/bin/acme.js personal session start`.
Then, with their yes, run one read with `--json`. A write shows what it would send with `--dry-run`.

## 5. Give it to an agent

```sh
node dist/bin/acme.js personal mcp check
node dist/bin/acme.js personal mcp add claude-code
node dist/bin/acme.js skill install
```

`mcp config` prints the setup for any other MCP client. Permissions live in the profile's settings: each command, and
each API operation as `api.<operation>`, is `allow`, `ask`, `readonly` or `deny`, and a delete also checks
`<group>.delete`. Suggest the person denies deletes until they trust the tool.

## 6. Make it the person's own

- `docs/dev/DESIGN.md` holds the answers `new` recorded and a first task. Work through it.
- Rewrite `README.md`, the description in `package.json` and the agent skill under `skills/` to say what the tool
  does for its user.
- Commands of your own go on top of the `comments` sample, which shows each pattern a command needs. Once yours cover
  them, `npx @wirecat/cli-template remove-sample` deletes it.
- `pnpm ci:quick` before each commit. `AGENTS.md` lists the files to keep and the ones to replace.

## 7. Publish

`bin/setup-github` creates the public repository with its checks. `bin/release --first` publishes the first version
from the person's computer and says how to set npm trusted publishing; every later release is `bin/release`. A
`--preset generic` CLI needs no recorded live check before a release, but a read against a test account before each
release is still worth it (`bin/live` runs `scripts/live.sh`).

`npx @wirecat/cli-template upgrade` brings later template changes in, file by file, and asks before touching a file
you changed.
