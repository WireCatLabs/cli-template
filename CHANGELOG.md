# Changelog

Notable changes to `@wirecat/cli-template`. One section per version, newest first; versions follow
[semantic versioning](https://semver.org), so before `1.0.0` the skeleton may still change.

## Unreleased

### Added

- **The run log can be read: `runs list`, `runs show` and `runs path`** (WC-LIFE-15). A failed command was already
  kept as a run by cli-core's `run`, but nothing in the CLI could show it. `src/program.ts` now registers cli-core's
  `runsCommand`. A CLI started from an older template adds the same line; cli-base's `missing-run-log` lint rule
  reports the CLIs that have not.
- **`new --category messenger` writes `messenger: true` into the CLI's identity.** Every other category keeps the
  template's `messenger: false`. The Reference CLIs page says which to set.

### Changed — may break callers

- **The skeleton runs on cli-core 0.422.0 and says `messenger: false` in `src/identity.ts`.** The shared help,
  `commands`, `config` and the MCP tools no longer speak of chats and messages: `--help-all`'s profile example is
  `clidev personal doctor`, `--brief` and `--full` describe found items and their author, and `config set` and
  `unset` no longer list `sender_colors`. cli-base stays on 0.53, because cli-core 0.422.0 accepts only cli-base 0.53.
  A CLI that upgrades sets the field in its own `src/identity.ts` and refreshes its contract snapshots once.

## 0.1.3 — 25.10.2026

### Added

- **`new` writes the content languages into the CLI's identity.** The `--content-lang` codes go into
  `contentLanguages` in `src/identity.ts`, so the CLI's first run ticks them in advance in the search-language question.
  `docs/dev/DESIGN.md` still records them with the speech-model order.
- **`scripts/audit.sh` reads `config/parity-groups.json` when the repository has one.** That file replaces
  cli-base's parity groups for the audit. The template uses it to compare itself with the published CLIs.
- **The release skill ends with a fresh-agent audit.** Before the version is raised, a new subagent audits the
  repository against the handbook alone, with the prompt in `docs/dev/skills/release/fresh-audit.md`, and its report
  goes into the release pull request.

### Changed — may break callers

- **The skeleton runs on cli-core 0.421.0 and cli-base 0.53.0.** A new CLI gets cli-core's changes since 0.412.0,
  including the `contentLanguages` field on its identity. cli-base stays on 0.53, because cli-core 0.421.0 accepts
  only cli-base 0.53.

### Fixed

- **`new`'s next steps run in Windows PowerShell 5.1.** It printed `cd <name> && pnpm install && pnpm ci:quick`, and
  PowerShell 5.1 has no `&&`. Each step is now on its own line.
- **A CLI's files keep LF line endings on Windows.** A new template-owned `.gitattributes` (`* text=auto eol=lf`)
  stops git from checking files out with CRLF, which Biome's format check rejects.

### Security

- **markdownlint-cli2's markdown-it, katex and smol-toml move past their advisories.** `pnpm-workspace.yaml` raises
  them to markdown-it 15.0.3, katex 0.18.2 and smol-toml 1.9.1 while markdownlint-cli2 stays at the shared version.

## 0.1.2 — 25.10.2026

### Changed — may break callers

- **The template's placeholder is `clidev`, not `app`.** Readers took `app` for a real command. The template's files
  now say `clidev`, `clidev-cli`, `@wirecat/clidev-cli` and `WireCatLabs/clidev-cli`, and `new` replaces them with
  your CLI's names as before. `clidev` is not cli-base's `cli-dev` tool, which `new` leaves alone. A CLI made from
  0.1.0 or 0.1.1 upgrades cleanly: `upgrade` renames each template version with its own placeholders.

### Fixed

- **A CLI made by `new` has its command.** Its `package.json` had `"bin": {}`, so `npm install -g` installed nothing to
  run. `new` now writes `"bin": { "<command>": "dist/bin/<command>.js" }`.

## 0.1.1 — 25.10.2026

### Fixed

- **`npx @wirecat/cli-template new` works.** It stopped with `template.json lists ".gitignore", but the package has
  no such file`, because npm renames `.gitignore` when it installs a package. The package now ships the file under
  another name, and `new` and `upgrade` write it as `.gitignore`.
- **`new` and `upgrade` work on Windows.** `new` now marks `bin/release` and the other scripts as executable in
  git, so a CLI made on Windows can still run them on Linux and macOS. `upgrade` no longer reads every file as
  edited when git checked it out with Windows line endings, and it downloads the earlier template version without
  needing a shell for `npm`.

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
