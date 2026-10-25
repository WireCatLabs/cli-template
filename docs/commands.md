<!-- Generated from the command tree by pnpm generate. Do not edit. -->

# Commands

Every command, option and exit code, generated from the program itself. For the same list as JSON, run
`clidev commands --json`.

**The first word is the profile**, a name you choose: `clidev personal doctor`. `CLIDEV_PROFILE`
does the same for a whole shell session. No profile is assumed: a command that uses an account stops without one and
lists the profiles on this computer.

## Options for every command

| Option | What it does |
|---|---|
| `-V, --version` | output the version number. |
| `-v, --verbose` | more detail in what is shown: -v ids, -vv everything we know. Default: `0`. |
| `--json` | machine-readable output: one JSON value on stdout; --json=id,text keeps only those fields. |
| `--jsonl` | machine-readable output: one JSON object per line, for streaming and jq. |
| `--quiet` | diagnostics off; a failure is still said. |
| `--trace` | the connection's own log lines on stderr — never message content. |
| `--debug` | on a failure, its whole record — cause and stack — in place of the short line. |
| `--timeout <duration>` | give up on the whole command after this — 30s, 2m, 500ms. |
| `--offline` | answer from what was recorded and never connect; fails if nothing was. |
| `--no-input` | never prompt or open interactive login; piped input remains available. |
| `--max-input-bytes <bytes>` | maximum buffered input bytes (default: 16777216). |
| `--max-output-bytes <bytes>` | maximum machine output bytes (default: 4194304; 0 disables). |
| `--brief` | found messages as reference, title, time, sender and excerpt only. |
| `--full` | found messages with their whole text and every provider field. |
| `--dry-run` | preview parsed arguments and permissions before running the action. |
| `--yes` | go ahead without the question an ask level puts before a write. |
| `--record` | keep this run — ids and timings, never message content. |
| `--no-record` | do not keep it, whatever the configuration says. |

## `clidev commands`

every command by section; --json prints its contract, one path per call

### `clidev commands info`

one command contract, or all schemas, error reasons and explicit overrides

```sh
clidev commands info [path]
```

| Argument | | What it is |
|---|---|---|
| `path` | optional | one command path; without one, export schemas, error reasons and explicit overrides. |

**Returns:** one command contract, or all schemas, error reasons and explicit overrides

**Example:** `clidev commands info messages list`

## `clidev doctor`

check this installation: version, paths, config, profiles; no keyring or network

```sh
clidev doctor
```

**Returns:** check this installation: version, paths, config, profiles; no keyring or network

**Example:** `clidev personal doctor`, `clidev personal doctor --json`

## `clidev skill`

the instructions an agent is given for this tool

### `clidev skill show`

print SKILL.md — `clidev skill install` puts it where Claude Code, Codex and Gemini CLI look for it

```sh
clidev skill show [name]
```

| Argument | | What it is |
|---|---|---|
| `name` | optional | one of the skills shipped for a task: follow-ups, link-conversations. |

**Returns:** print the tool's instructions for AI agents

**Example:** `clidev skill show`, `clidev skill show follow-ups`

### `clidev skill install`

write SKILL.md to \~/.claude/skills/clidev-cli/ (Claude Code) and \~/.agents/skills/clidev-cli/ (Codex, Gemini CLI)

**Changes something on this computer only.**

```sh
clidev skill install [options]
```

| Option | What it does |
|---|---|
| `--for <agents>` | which agents to install for. One of: `claude`, `agents`, `all`. Default: `all`. |

**Returns:** install the tool's instructions for AI agents

**Example:** `clidev skill install --for agents`

## `clidev mcp`

serve this profile's commands to an agent over MCP, on stdin and stdout, writes included; the profile's permissions decide — `claude mcp add clidev -- clidev personal mcp`

**Changes something in the service.**

```sh
clidev mcp
```

**Returns:** serve this profile's commands to an AI agent

**Example:** `clidev personal mcp`

## `clidev upgrade`

upgrade clidev with the package manager that installed it; --check only looks

**Changes something on this computer only.**

```sh
clidev upgrade [options]
```

| Option | What it does |
|---|---|
| `--check` | say whether a newer version exists, and install nothing. |

**Returns:** upgrade clidev with the package manager that installed it; --check only looks

**Example:** `clidev upgrade --check`, `clidev upgrade`

## `clidev config`

the settings in force, and where each one came from

### `clidev config show`

the profile, the profiles that exist, and each setting with where it came from

```sh
clidev config show [options]
```

| Option | What it does |
|---|---|
| `--bot` | the settings a bot command on this profile gets, rather than the personal account's. |

**Returns:** the profile, the profiles that exist, and each setting with where it came from

**Example:** `clidev personal config show`

### `clidev config set`

save a setting to the configuration file

**Changes something on this computer only.**

```sh
clidev config set <setting> <value> [options]
```

| Argument | | What it is |
|---|---|---|
| `setting` | required | one of: limit, timeout_ms, color, sender_colors, record, keep_runs_for_days, permissions, sends_per_hour, requests_per_minute, transcribe_with, speech_model, search_catch_up, picture_search, embedding_provider, embedding_model, embedding_base_url, embedding_dims, analysis_provider, analysis_model, analysis_base_url, models, read_other_bots, update_check, skill_hint, search_stemmers.cyrillic, search_stemmers.latin, phone_countries, task_categories.<name>, task_agent_close, task_agent_close_min, task_first_pass_per_chat, account_groups.<name>. |
| `value` | required | a number, true or false, or for allow a list like send,reaction; for a group tg:work,max:Alice,email:me@x. |

| Option | What it does |
|---|---|
| `--defaults` | change what every profile gets, rather than this profile. |
| `--personal` | only for personal accounts — the personal section of the file. |
| `--bot` | only for bots — the bot section of the file. |

**Returns:** save a setting to the configuration file

**Example:** `clidev personal config set limit 20`

### `clidev config unset`

remove a setting from the configuration file

**Changes something on this computer only.**

```sh
clidev config unset <setting> [options]
```

| Argument | | What it is |
|---|---|---|
| `setting` | required | one of: limit, timeout_ms, color, sender_colors, record, keep_runs_for_days, permissions, sends_per_hour, requests_per_minute, transcribe_with, speech_model, search_catch_up, picture_search, embedding_provider, embedding_model, embedding_base_url, embedding_dims, analysis_provider, analysis_model, analysis_base_url, models, read_other_bots, update_check, skill_hint, default_profile, search_stemmers.cyrillic, search_stemmers.latin, phone_countries, task_categories.<name>, task_agent_close, task_agent_close_min, task_first_pass_per_chat, account_groups.<name>. |

| Option | What it does |
|---|---|
| `--defaults` | change what every profile gets, rather than this profile. |
| `--personal` | only for personal accounts — the personal section of the file. |
| `--bot` | only for bots — the bot section of the file. |

**Returns:** remove a setting from the configuration file

**Example:** `clidev personal config unset limit`

## Exit codes

Branch on the code, not on the text: the text can change, the code does not.

| Code | When |
|---|---|
| `0` | it worked |
| `2` | `validation_error` |
| `3` | `configuration_error` |
| `4` | `authentication_error` |
| `5` | `permission_error` |
| `6` | `not_found` |
| `7` | `confirmation_required` |
| `8` | `rate_limited` |
| `9` | `timeout` |
| `10` | `network_error` |
| `11` | `provider_error` |
| `12` | `provider_unavailable` |
| `13` | `invalid_response` |
| `14` | `outcome_unknown` |
| `130` | `cancelled` |
| `1` | anything else |
