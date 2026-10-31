# Changelog

Notable changes to `@wirecat/cli-template`. One section per version, newest first; versions follow
[semantic versioning](https://semver.org), so before `1.0.0` the skeleton may still change.

<!-- cspell:words clawhub gcal katex openclaw smol whatsapp -->

## 0.10.0 — 31.10.2026

### Changed — may break callers

- **The skeleton runs on cli-core 0.469.0 and cli-base 0.65.0**; a CLI that pins cli-base moves both pins together.
  A non-messenger CLI no longer offers messenger settings or the `follow-ups` and `link-conversations` skills
  (cli-core 0.468); runs record successes too, under cli-core 0.467's rules. cli-base 0.64 adds `cli-dev bundle`, the
  shared build that ships the bin as an esbuild bundle, and calendar words in the command vocabulary. cli-base 0.65 adds
  the verbs `serve` and `revoke`, and `cli-dev lint` fails on a baseline entry that names them: the skeleton's
  `lint/baseline/unknown-verb.json` (`mcp serve`, `mcp revoke`) is gone, and a CLI made from the template removes the
  same entries. `<cli> upgrade` now restarts the HTTP MCP server that `mcp server start` started, on the new version,
  and names the MCP sessions over stdio that still run the old one (cli-core #2117).

### Added

- **A CLI made from the template publishes its skill on ClawHub as `wirecat-<command>` after each release.** `release.yml`
  gets a dry run through ClawHub's pinned workflow and, after the tag, a publish that only warns while ClawHub still holds
  the version pending its scan ([openclaw/clawhub#4046](https://github.com/openclaw/clawhub/issues/4046)); the template's
  own release skips both. The skill names its binary and npm package for OpenClaw (`metadata.openclaw`). It needs the
  `CLAWHUB_TOKEN` secret, which the WireCatLabs organization shares.
- **`new --category calendar` names gcal-cli as the reference CLI** in `AGENTS.md` and `DESIGN.md`, and the
  Reference CLIs page lists it, instead of "No reference CLI for this category yet". gcal-cli is the WireCat Google
  Calendar CLI. A CLI made before this keeps what it wrote; edit its `AGENTS.md` by hand if you want the link.
- **`scripts/audit.sh` audits beside gcal-cli too**: it installs `@wirecat/gcal-cli` with the other published CLIs
  and passes its `gcal` bin to `cli-dev audit`.
- **An agent publishes a release itself.** The release skill and `bin/release` let an agent merge the release pull
  request and run `bin/release`, which publishes from GitHub Actions. `bin/release --local` stays the owner's, for
  the first release.

### Fixed

- **`bin/release` raises the next free version to the level the changelog needs.** When npm already had the version, it
  took the next patch, so a release with `Added` (`0.1.1` taken, `0.1.2` proposed) failed `version:check` and stopped;
  it now proposes `0.2.0`. A generated CLI gets it with the next template update.
- **A CLI made from the template starts from an esbuild bundle.** `pnpm build` runs `tsc`, then cli-base's
  `cli-dev bundle` ([WC-LAY-10](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/layout.md)), and the
  bin becomes a loader for `dist/bundle/`: the skeleton's `config show --help` starts in 151 ms instead of 366.
  `scripts/smoke-bundle.ts` runs the bundle under Node (`pnpm smoke:node`, in CI) and Bun (`pnpm smoke:bun`).

## 0.9.0 — 27.10.2026

### Changed — may break callers

- **The MCP server is `clidev <profile> mcp serve`; `mcp` alone only shows its commands** (WC-CMD-3). `--http`,
  `--port` and `--public-url` move to `mcp serve`, and `mcp --revoke` is its own command, `mcp revoke`, still refused
  under `CLIDEV_READ_ONLY`. There is no alias: a client set up with `claude mcp add clidev -- clidev personal mcp`
  gets the help and exits 2; set it up again with `… mcp serve`. `mcp server start` runs `mcp serve --http`.
- **The skeleton runs on cli-core 0.463.0 and cli-base 0.63.0**, the cli-base line cli-core 0.463 accepts; a CLI that
  pins cli-base moves both pins together. `skill show`, `skill status` and `skill install --json` answer in the
  one-thing envelope, `{ item, meta }`, so a script reads their fields under `item`.
- **`mcp server start` no longer offers `--permission`.** cli-core added it to every CLI and passed it to a server
  that refused it; now it is refused before anything starts. The profile's `permissions` still make the server
  stricter.

A CLI made from an older template keeps its own `src/commands/mcp.ts`, since `src/` is a seed: copy the template's
file, and change `claude mcp add` lines in its docs to end in `mcp serve`.

### Security

- **`.gitleaks.toml` catches Google OAuth tokens.** gitleaks' own rules know Google API keys only, so an access token
  (`ya29.…`) or a refresh token (`1//…`) with no keyword beside it went through. Two rules now catch them. A CLI takes
  them with `upgrade`; scan its history once with `gitleaks git` after that, since CI scans all of it.

### Fixed

- **A command other than `mcp serve` no longer loads the MCP library.** `src/commands/mcp.ts` imported `portOf` and
  `publicUrlOf` from `@wirecat/cli-core/mcp` at the top, so `--version` and `doctor` loaded the MCP server SDK too
  (WC-LIFE-6). `mcp serve --http` now imports them when it runs.
- `docs/security.md` says what `mcp serve --http` listens on, what it keeps of each browser login, and that
  `mcp revoke` ends them.
- **`pnpm audit:commands` prints the CLI's own scorecard lines**, not the last CLI's total, which was zoom-cli's. It
  fails when the scorecard has no line for the CLI. Whether a new finding fails the run did not change.
- **`AGENTS.md` keeps only what holds for the CLI's whole life.** The one-time first task (interview, reference CLI,
  rewrite the README and the MCP instructions) moved into the `DESIGN.md` that `new` writes, which the CLI owns and
  deletes the section from when it is done. `upgrade` drops the old text from `AGENTS.md`.
- **`new` writes a `files` list that ships only what the CLI runs from**: `dist`, `skills`, `README.md`,
  `CHANGELOG.md` and `LICENSE`. It copied the template's own list, so a new CLI published its `src/` with tests and
  fakes, `scripts/`, `.github/`, `bin/release`, `config/`, `lint/` and `template.json` (WC-REL-16). `package.json` is
  a seed, so a CLI made before this trims its list by hand; `pnpm smoke` then checks the package still runs.
- `docs/dev/TESTING.md` and `ci.yml` give both reasons `contracts:upgrade` is skipped: it needs local state of the
  CLI's own and a published version to upgrade from (WC-TEST-14).
- `docs/dev/reference-clis.md` shows the provider call cli-core has, `store.accounts.registerProvider(entry)`.
  `@wirecat/cli-core/store` exports no `registerProvider` function.

## 0.8.0 — 27.10.2026

### Fixed

- The fresh-audit prompt lets the auditor read the cli-base workflow files the CLI's workflows pin (WC-CI-8), as
  the handbook's New CLI page now says.

### Removed

- **`mcp --permission` is gone.** cli-core 0.449.0 checks a `--permission` key against the messenger's names
  (`messages`, `drafts`, `chats` and the like), so in a CLI made from this template it refused every value, its own
  command paths included. It returns when cli-core can check a CLI's own permission names. Until then the profile's
  `permissions` are the way to make the MCP server stricter. `mcp server start` still shows a `--permission` option,
  which cli-core adds; the server it starts refuses it.

## 0.7.0 — 27.10.2026

### Changed — may break callers

- **The skeleton runs on cli-core 0.449.0 and cli-base 0.62.0**, the only cli-base line cli-core 0.449 accepts; a CLI
  that pins cli-base moves both pins together. The commands and their help do not change, apart from the `mcp`
  additions below.

### Added

- **`clidev <profile> mcp --http` serves the profile to ChatGPT and Claude in the browser**, on `127.0.0.1` behind the
  owner's tunnel, with a one-time login code; `--revoke` ends every login, and is refused under `CLIDEV_READ_ONLY`.
  **`mcp server start|stop|status`** runs it in the background (from cli-core 0.445.0): `status` shows the port, the
  connector address, the current login code and the apps logged in, and the background server writes no login code to
  its log. A second `mcp --http` for the same profile is refused. `mcp --permission key=level` makes a permission
  stricter for one server, over stdio too. A CLI made from an older template takes this with `upgrade`, or mounts
  `mcpServerCommand` on its own `mcp` and passes `lockFile: httpLockFile(tokenFile)` to `serveOverHttp`.

### Fixed

- **`new` writes the speech model advice into `docs/dev/DESIGN.md` only for `--category messenger`.** A calendar or
  notes CLI got "If this CLI defines a messenger, set its speechModels…" and a warning that no speech model hears a
  language, though only a messenger transcribes voice messages.
- **The cron step `new` prints points to the list of taken monthly minutes** in cli-base's CI page (WC-CI-9), so
  nobody has to read `monthly.yml` in every repository to find a free one. The examples now use `gcal-cli` and
  `gcal`: `cal` is the system calendar program on macOS and many Linux systems.
- **Every command spends less time getting ready (cli-base 0.62.0, cli-core 0.449.0).** The check of shared commands now
  describes each command once, not again for every group above it. It was about 60% of each command's setup; in tg a
  warm `run(["--version"])` went from 49 to 29 ms. It catches the same changes as before.
- **`bin/release` no longer reports a release that passed as failed.** `gh run watch` also stops with an error when
  one of its own requests to GitHub fails, while the run goes on; 0.6.1 was published, tagged and green, and the
  script said it failed. It now waits for the run to finish, reads its result, and checks npm before it says anything.
  It names `bin/release --local` only when npm refused the publish because it does not trust the workflow yet.

## 0.6.1 — 26.10.2026

### Fixed

- **`doctor` answers when the settings fail to load for an unexpected reason**, with the message under
  `settings.error`; before, any error other than a CLI error stopped the command.
- **The MCP server's instructions name text from other people**, with the names and titles around it, as data that is
  never followed. `AGENTS.md` now says to rewrite them for the kinds of text the CLI carries.
- **`CLAUDE.md` names its one local rule**: before `1.0.0`, `Added` raises the minor version, as `pnpm version:check`
  already enforced.
- **`docs/dev/TESTING.md` and the CI comment say when to add `pnpm contracts:upgrade`**: once the CLI keeps local state
  of its own, not only with a store.
- **The kit's page is split**: `kit/README.md` says how to run `new` and `upgrade`, and `kit/DEVELOPING.md` holds what
  the template repository must provide. Its `template.json` examples say they are cut short and link the real file.

## 0.6.0 — 26.10.2026

### Changed — may break callers

- **The skeleton runs on cli-core 0.444.0; cli-base stays at 0.59.0**, the only line cli-core 0.444 accepts. A run
  record now hides more of what was typed: a full 40-character commit hash, and the value of a flag or argument named
  like a secret (`--pin <chat>`). A test of a CLI that expects such a word back in `runs show` needs updating. The
  commands and their help do not change.

### Security

- **A run record and a kept error message hide hex keys and a password written after its name with a space** (from
  cli-core 0.444.0). A random-looking run of 20 or more lower-case hex characters is `[redacted]`; a short commit
  hash, a UUID and upper-case hex stay. More secret names are known (`passwd`, `pwd`, `private_key`, `pass`, `pin`,
  `otp`, `2fa`, `clave`, `пароль`, `код` and others), and the value after one is hidden after a space as well as after
  `=` or `:` (`password hunter2`), unless it is letters only. `docs/security.md` says what is found and what is not.

### Added

- **`pnpm kit:e2e` checks that a password typed after its name is `[redacted]`** in the failed run's record.

## 0.5.0 — 26.10.2026

### Changed — may break callers

- **The skeleton runs on cli-core 0.442.0; cli-base stays at 0.59.0**, the only line cli-core 0.442 accepts. A CLI
  with its own program that calls `recordRuns` now keeps the command line in its run records without passing the
  typed words through `run()`, secrets hidden; the skeleton's commands record through cli-core and need nothing.

### Security

- **A run record and a kept error message find a secret by what it looks like** (from cli-core 0.442.0): a token in
  a known format, a `Bearer` or `Basic` credential, the value after a secret name such as `password=`, and a
  random-looking string of 20 or more characters. `docs/security.md` says what is found and what is not.
- **A config that will not load no longer lets a run record keep the typed words** (from cli-core 0.442.0). The words
  are masked, as `record_input false` would.

### Added

- **`pnpm kit:e2e` checks that a token typed as a word is `[redacted]`** in the failed run's record.

## 0.4.0 — 26.10.2026

### Changed — may break callers

- **The skeleton runs on cli-core 0.440.0; cli-base stays at 0.59.0**, the only line cli-core 0.440 accepts. The
  `--record` help now says what a run keeps: "keep this run, with the command as typed and secrets hidden;
  record_input false leaves the typed words out", no longer "ids and timings, never content". `docs/commands.md`
  changes with it, and a CLI that keeps help snapshots refreshes them once. A command a CLI records itself with
  `recorded` or `startRecording` can keep its command line by passing `context: runContextOf(…)`; the skeleton's
  commands record through cli-core and need nothing.

### Security

- **A phone number no longer reaches a run record** (from cli-core 0.440.0). One written with its "+" and country
  code, or 11 to 15 digits in a row, is `[redacted]` inside the word typed, so a long id of that length is hidden as
  well. `docs/security.md` says so.

### Fixed

- **`pnpm docs:spell` also checks `AGENTS.md`, `CLAUDE.md` and `skills/`.** `package.json` is copied once, so a CLI
  adds them to its own `docs:spell` by hand.

## 0.3.0 — 26.10.2026

### Changed — may break callers

- **The skeleton runs on cli-core 0.439.0; cli-base stays at 0.59.0.** A run record now keeps the command line as
  typed, so `runs show` tells what was run; a secret is still `[redacted]`. The new setting `record_input`
  (`config set record_input false`) brings back the masking of every typed word. `config set` and `config unset` list
  `record_input`, so a CLI's help snapshot changes once. A test or page of a CLI that says a run never holds what was
  typed needs updating. An argument or option that carries a secret is marked with `secretInput()` from
  `@wirecat/cli-core/cli`; the skeleton has none to mark.

### Security

- **A first word refused as a profile no longer reaches the run record** as the run's `profile`, and an error that
  quotes `--token=…` or `password=…` no longer keeps the value (from cli-core 0.438.0 and 0.439.0).

### Fixed

- **`docs/dev/reference-clis.md` links the evidence for what it says about other repositories**, no longer calls
  whatsapp-cli the handbook's worked example, points a mail CLI at cli-memo's mail import, and no longer says `config`
  hides messenger settings when `messenger` is `false`.
- **`pnpm release:check` also runs `security:no-leak` and `package:check`**, which only `bin/release --local` ran.
  `package.json` is copied once, so a CLI adds both to its own `release:check` by hand.
- **`SECURITY.md` asks never to send a session** beside a token, a password and private content.

## 0.2.0 — 26.10.2026

### Added

- **`skill install --for hermes` gives Hermes Agent the skill, and `skill status` reports the copy Hermes reads.**
  A bare `skill install` still writes only Claude Code's folder and `~/.agents/skills`, which OpenClaw reads too.
- **`search_reranker` is a new setting in `config set`.** Only a CLI that adds cli-core's message search uses it.

### Changed — may break callers

- **The skeleton runs on cli-core 0.437.0 and cli-base 0.59.0.** cli-core 0.437 accepts only cli-base 0.59.x, so a
  CLI that pins cli-base moves both. `--help-all` now gives `clidev personal mcp` as the profile example, not
  `clidev personal doctor`, since `doctor` takes no profile; a CLI that keeps help snapshots refreshes them once.
  `skill status --json` gains a `hermes` entry beside `targets`. A run started by OpenClaw has `agent: openclaw`,
  and one started from an OpenClaw chat adds `agent.from_chat: true`: a reader of `run.json` that refuses unknown
  keys must accept it.
- **`bin/release` runs `changelog restore` from the installed cli-base**, through `pnpm exec cli-dev` like the fold,
  not from `npx -p @wirecat/cli-base@0.55.1` outside the lockfile. A CLI that takes this file with `upgrade` needs
  cli-base 0.55.1 or later, which has `changelog restore`.
- **`pnpm version:check` refuses a release whose number is raised less than its changelog needs.** Before `1.0.0`, a
  section with `Changed — may break callers`, `Removed` or `Added` raises the minor; only fixes, security and docs
  raise the patch. The release skill says the same. `scripts/` and `package.json` are copied once, so a CLI started
  from an older template copies `scripts/version-level.ts` and the `version:check` script to get the check.
- **A new CLI starts with coverage floors just under what the skeleton's tests reach**: lines 95, statements 92,
  functions 85, branches 75, and still 50% lines per file. The template's kit has its own floor, which `new` leaves
  out of the CLI's `vitest.config.ts`.

### Fixed

- **`new` drops a `kit/` key from a config,** not only a `kit/` entry in a list, so the CLI's `vitest.config.ts` has
  no coverage floor for a folder it does not have.
- **`docs/installation.md` gives the Node.js versions `engines` allows:** 22.16 or a later 22.x, or 24 or later. It
  read as if Node 23 worked.

## 0.1.8 — 26.10.2026

### Changed — may break callers

- **The shared standards in `config/wirecat/` come from community at `c846abf`.** The release lock is now
  `wirecat-release-<package>.lock`, still one per npm package. The shared spelling list no longer has the owner's
  account name. Biome is 2.6.3 and no longer checks Markdown; markdownlint does. pnpm is 11.28.8, cspell 10.4.0,
  lefthook 2.2.2 and markdownlint-cli2 0.24.0. `config/wirecat/` is copied once, so a CLI started from an older
  template runs community's `scripts/adopt-standards.py` on its folder, then `pnpm install`. Do not do
  this while that CLI's `bin/release` runs: the release holds the old lock and a second one would take the new.
- **The skeleton runs on cli-core 0.434.0 and cli-base 0.57.1.** `upgrade`'s help shows only `clidev upgrade
  --check` as an example; a CLI that keeps help or `commands --json` snapshots refreshes them once. For a CLI that
  adds the shared store: it moves to version 34 with a vector index from `@wirecat/cli-core-sqlite` 1.1.0, now
  required on every platform, and a store opened by this version refuses older builds of the same CLI. The
  Anthropic adapter (SDK 1.x) refuses `temperature`, `top_p` and `top_k`, and sends the key as
  `Authorization: Bearer`.
- **`bin/release --local` stops when the keyring has no token for `NPM_KEYRING_ACCOUNT`.** It used to print a line
  and go on with your npm login, which may be another account. Now it prints the same one line, naming the account,
  and exits 1; this includes a computer without `secret-tool`. Unset, the keyring is still skipped. As in cli-base
  0.58.0. A CLI made from the template gets this with `upgrade`.

### Fixed

- **One copy of `@modelcontextprotocol/server` without an override.** cli-core now ranges it `^2.4.0`, so the
  `pnpm-workspace.yaml` override for cli-core's copy is gone. markdownlint-cli2 0.24.0 pins patched `markdown-it`
  and `smol-toml` itself; only the `katex` override stays. A CLI started from an older template may drop the same
  lines from its own `pnpm-workspace.yaml`.
- **The MCP server's instructions say that what the service returns goes to the owner only,** besides being data and
  never instructions (WC-MCP-11). `src/` is copied once, so a CLI started from an older template adds the same words
  to the instructions in its own `src/mcp.ts`.

## 0.1.7 — 25.10.2026

### Changed — may break callers

- **The skeleton runs on cli-core 0.428.0 and cli-base 0.57.0.** `config set` saves `config.json` readable by its
  owner only (`0600`); it used to rewrite it as `0644`. Anything that reads the file as another user can no longer
  read it after the next save. `skill status` and `skill show --for claude|agents` are new shared commands. A run
  record gains `cli_command`, `argv`, `agent` and, for a failed run, `error`.
- **`bin/release --local` reads the keyring only for the account in `NPM_KEYRING_ACCOUNT`.** It used to look up one
  fixed account name; now nothing is looked up while the variable is unset, and the token comes from `NPM_TOKEN` or
  your npm login. To keep using the keyring, `export NPM_KEYRING_ACCOUNT=<account>` with the account the token is
  stored under (service `npm`). A failed lookup says so on stderr and never prints the token.
- **The prose check in `ci.yml` reads `CHANGELOG.md` too.** A tone error in the changelog now fails the `prose` job
  after `upgrade`. A new CLI's `docs:check` and `docs:spell` also cover `CHANGELOG.md`.

### Fixed

- **A CLI's `SECURITY.md` and `docs/security.md` still link its own repository,** and the template's copies link
  cli-template instead of a repository that does not exist. `new` rewrites the two links.
- **The skeleton compiles against cli-core on `@modelcontextprotocol/server` 2.4.** It moves to server 2.4.0; until a
  cli-core release ranges the server `^2.4.0`, an override in `pnpm-workspace.yaml` gives cli-core the same copy,
  since two copies fail to compile `src/mcp.ts`.

### Security

- **`doctor` reports a `config.json` or config folder that other users can read, with the `chmod` that fixes it.**
  `doctor --json` gains `files: { checked, ok, problems }`, each problem `{ path, mode, want }`: the file wants `0600`,
  its folder `0700`. stderr prints `to make it private: chmod 600 '<path>'` for each; nothing is changed on disk.
  `files` is in the answer also when the settings are refused. Windows is not checked (`checked: false`). `src/` is
  copied once, so a CLI started from an older template copies `src/commands/doctor.ts`.

## 0.1.6 — 25.10.2026

### Changed — may break callers

- **The skeleton runs on cli-core 0.426.0.** A `--dry-run` preview says `effects.service_contacted: false` and no
  longer has `effects.messenger_contacted`. MCP no longer offers a command group that only prints its help, such as
  `config`; `config show`, `set` and `unset` stay. The example in the MCP read and write tools is `runs list`, a
  command that runs as written. The first screen says zm and drive are searchable with your other WireCat data.
- **`doctor` takes no profile.** Its usage line and examples are `clidev doctor` and `clidev doctor --json`; a profile
  typed before it still works. A CLI started from an older template copies `src/commands/doctor.ts` and
  `src/mcp.ts`.

### Added

- **`bin/release --local` reads the npm token from the keyring** (`secret-tool`, service `npm`, account `leemour`), as
  the other WireCat CLIs do, when `NPM_TOKEN` is not exported. Without either it uses your `npm login`. The token is
  never printed. A CLI made from the template gets this with `upgrade`.

### Fixed

- **A merge to `main` no longer cancels the validation of the merge before it.** Each merged commit is now checked in
  turn. A CLI made from the template gets this with `upgrade`.

## 0.1.5 — 25.10.2026

### Changed — may break callers

- **The skeleton runs on cli-core 0.424.0.** When no profile exists on the computer, the error shows the command
  that was typed with a profile added, such as `clidev personal mcp`. It used to suggest a `setup` command, which the
  skeleton does not have. A run made without a profile is now recorded with no profile instead of as `default`, so
  `runs list` and `runs show` leave `profile` out for such a run.
- **`doctor --json` reports the config file's problems as `config: { path, found, issues }`, the shape the shared
  messenger doctor has (cli-core 0.423.0).** `config.exists` and `config.error` are gone. Each issue has a `kind`
  (`invalid_json`, `unknown_setting`, `invalid_value`, …), the `file`, the `key`, `line` and `column` for invalid JSON,
  a sentence that says what the value has to be, and `fix`, the `config unset` command that removes it. A profile lock
  or an environment variable the settings refuse is reported in `settings.error`. A CLI started from an older template
  copies `src/commands/doctor.ts`.
- **The skeleton runs on cli-core 0.423.0.** `config set` and `unset` no longer list `default_profile`,
  `analysis_provider`, `analysis_model` or `analysis_base_url`; analysis is set with `models.analysis.*`. A file that
  still has one of them is refused with the `config unset` that removes it.
- **`pnpm docs:check` checks the user pages for internal ids, correction marks and struck-out text.** It now loads
  `scripts/docs-rules.ts`, which names `README.md`, `SECURITY.md` and `docs/*.md` as user pages. A page that carries
  a journal id fails the check until the id is removed.
- **The spell check covers `SECURITY.md` and imports only the shared word list.** `cspell.json` no longer imports the
  British English and Russian dictionaries again, and skips the generated `docs/commands.md` as tg and max do.
- **The coverage floor holds for each file too: every file in `src/` keeps at least half of its lines covered.**
  Each excluded file now says why it is excluded.
- **Only `src/mcp.ts` may import the MCP SDK.** `biome.json` refuses `@modelcontextprotocol/*` anywhere else in
  `src/`, so commands and services do not learn the protocol.
- **`bin/release` takes the next free version when npm already has the one in `package.json`, or a higher one.** It
  used to stop and ask for a new pull request. Now it raises the number (after `x.y.0` the next minor, else the next
  patch), lands that through its own pull request once the checks pass, and publishes it, as tg, max and memo do. A
  pre-release version is still chosen by hand. A CLI made from the template gets this with `upgrade`.

### Fixed

- **`<profile> mcp` stops when the stop comes before its server is up.** A stop that arrived while the server was
  still loading was lost, and the command served until it was killed. A command result that is not an object, such
  as a list, now reaches the agent as `{ "result": … }`, because MCP accepts only an object as a tool's structured
  result. A CLI made from an older template takes both from `src/mcp.ts`.
- **The missing-profile contract tests the missing profile.** It ran `mcp --json`, which is refused for `--json`
  before the profile is read. It now runs `mcp`. A CLI made from an older template changes the case's `args` in
  `contracts/plan.json` the same way.
- **The package no longer ships `kit/README.md` and the kit's `tsconfig` files.** npm reads a name in `files` with no
  leading slash as a match in every folder; the three root files are now anchored with `/`. `pnpm package:check`
  fails when `npm pack` would ship a path that `files` does not name.
- **The monthly run starts at 03:02 UTC, inside the window the handbook gives.** The last step `new` prints asks for
  a free minute in that window; it spoke of a day and of a placeholder CI rejects, and no check rejects one.
- **The 0.1.4 notes cite a handbook rule and a lint rule that no published cli-base has.** The run-log rule and
  cli-base's `missing-run-log` lint rule are only on cli-base's main branch. They are in no release up to 0.55.1, so
  nothing reports a CLI without `runs` until a cli-base release ships them. The 0.1.4 section stays as it was released.
- **The README introduces the skeleton in full:** profiles, settings and permissions, limits, security, and what to do
  when it does not work.
- **The Reference CLIs page says how a new CLI's records join search.** A CLI with a provider of its own registers it
  with cli-core's `registerProvider`; until it does, search lists its accounts as skipped. The page said that cli-core
  had no provider registry, and that search would read such records as messages.

## 0.1.4 — 25.10.2026

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
