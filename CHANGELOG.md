# Changelog

Notable changes to `@wirecat/cli-template`. One section per version, newest first; versions follow
[semantic versioning](https://semver.org), so before `1.0.0` the skeleton may still change.

## Unreleased

### Fixed

- **`npx @wirecat/cli-template new` works.** It stopped with `template.json lists ".gitignore", but the package has
  no such file`, because npm renames `.gitignore` when it installs a package. The package now ships the file under
  another name, and `new` and `upgrade` write it as `.gitignore`.

## 0.1.0 — 25.10.2026

### Added

- **A working skeleton for a new WireCat CLI.** The shared root commands `commands`, `doctor`, `skill`, `mcp` and
  `upgrade`, and `config`, on cli-base and cli-core. Every example names its profile; the MCP server offers every
  command, writes included, and the profile's permissions decide what runs.
- **The checks of the WireCat standards, from the first commit.** CI runs lint, the type check, tests with coverage,
  the command lint and audit, the contracts, the test matrix, the docs checks and the changelog guard.
- **`npx @wirecat/cli-template new` and `upgrade`.** `new` copies the template into a new folder, renames it, asks
  the seven design questions (or takes them as flags) and prints the four steps that need a person. `upgrade` brings
  later template changes into a CLI made from it, file by file: apply, replace, skip or diff.
- **A design interview for the agent that builds the new CLI**, and a page that names the CLI to learn from for each
  kind of tool.
