---
name: new-cli
description: Build a new WireCat CLI for a service, from research to the first release, to the WireCat standards and in line with the CLIs of its category. Starts from cli-template, puts shared code in cli-core first, and has a fresh agent review every slice. Use when asked to make, start or add a CLI for a service, «сделай CLI для …», «новый CLI», «подключить сервис».
---

<!-- cspell:words whatsapp gcal bitrix worktrees -->

# New WireCat CLI

You lead the work on a new CLI for one service. The rules are not here: they live in the
[WireCat CLI standards](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/README.md) and win over this
skill. This skill is the order of work and the checks between the steps. The checklist the result must pass is
[New CLI](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/new-cli.md); read it whole before step 1.

The goal is a CLI that a user cannot tell apart from the other WireCat CLIs: the same commands, the same answers, the
same errors, the same store. A difference needs a reason the service forces, written down.

## Inputs

The prompt that starts you gives: the service, the category, and the owner's answers to the
[design questions](https://github.com/WireCatLabs/cli-template/blob/main/docs/dev/skills/design-interview/SKILL.md)
it already has. An answer it lacks is asked (step 2), never guessed. The account the CLI runs against is the owner's
choice: never pick a profile, and never run the CLI on a real account without the owner's yes for that run.

## 1. Learn the neighbours and the service

1. **The reference CLI of the category**, from [Reference CLIs](https://github.com/WireCatLabs/cli-template/blob/main/docs/dev/reference-clis.md):
   meetings → zoom-cli, messenger → whatsapp-cli then tg-cli, mail → mail-cli, calendar → gcal-cli, files → drive-cli,
   CRM → bitrix24-cli, notes → cli-memo. Read its `README.md`, `docs/dev/DESIGN.md`, `commands --json`, the store
   writes and the sync. Write down the command tree you will mirror.
2. **What cli-core and cli-base export**: their `package.json` exports and type declarations, and the
   [Kit surface](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/kit-surface.md). Every helper you are
   about to write is looked for here first.
3. **The service.** Official API docs (context7 or the vendor's pages): sign-in, scopes, rate limits, paging, error
   codes, retention, terms of use. With no official API: open the web app, capture the real answers it gets (in your
   own session, with the owner's yes), and note what breaks if the vendor changes it.
4. Write `research.md` in the private plans folder (`cli-private/plans/<YYYY-MM-DD>-<cli>/`, never the public repo):
   each fact with its link or captured answer, and what is still unknown.

Check: every provider name, method and error code you plan to use has a source
([WC-TEST-19](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/testing.md)).

## 2. Design

Run the design interview with the owner's answers from the prompt; ask only the missing ones, one at a time, as
multiple choice with your recommendation first. Then write `plan.md` beside `research.md`:

- the command tree, mapped command by command to the reference CLI's; every extra or missing command has a reason;
- what goes to the store and through which cli-core writer (meetings, messages, documents, events, records);
- **the cli-core gap list**: everything the CLI needs that another provider could also use (a session kind, a
  cookie reader, a store writer, a search lane, a pacer). Each item goes to cli-core or cli-base first
  ([WC-ARCH-5](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/architecture.md)), never into the CLI;
- the slices, smallest useful one first: sign-in and `doctor` → list and show, live → sync into the store → search
  and MCP → the rest. Each slice is one pull request;
- the risks, and the decisions the owner must make (`NEED-n`, with options and your recommendation).

Show the owner the plan and the gap list before step 3 when the prompt does not say to go on alone.

## 3. Shared code first

For each item on the gap list: a pull request in cli-core or cli-base, with tests, merged, and released when the CLI
needs it on npm (batch with what is already merged; announce as cli-core's `COORDINATION.md` says). The CLI pins the
exact version. A gap found later in the build goes the same way: stop, fix it in the shared package, then go on.

## 4. Start from the template

```sh
npx @wirecat/cli-template new <name>-cli --command <word> --package @wirecat/<name>-cli --owner WireCatLabs \
  --category <category> --content-lang <langs> --sign-in <kind> --api <kind> --filters <list> \
  --never-store <list> --untrusted <list>
cd <name>-cli && pnpm install && pnpm ci:quick
```

Then the four steps that need a person (the repository, its ruleset, npm, the secrets): put them in one script in
`bin/` and hand the owner one command. Keep the template's sample until your commands cover every pattern it shows.

## 5. Build each slice

- Learn how a command reaches the service from the template's sample, and the domain from the reference CLI.
- Every request goes through cli-core's run and `hostFetch` with the manifest's hosts; every list pages the same way
  the reference CLI does; `--json` answers have the same envelope and field names as the reference CLI's for the same
  thing (a meeting is a meeting in zoom-cli and here).
- A secret (token, cookie, session) lives in the keyring through cli-core's token store; it is never an argument,
  never printed, never logged, never in the store.
- Tests against a strict fake that refuses what the real service refuses, built from the captured answers; no real
  waits; no test reaches the network or the owner's store.
- Text that comes from other people is marked untrusted in every answer an agent reads.

**An unofficial API or a browser session** adds: read-only until the owner asks for writes; requests paced below
what a person in the browser does; one place that maps the service's answers, so a change breaks one file and one
contract test; the session's expiry detected and answered with `session.expired`, never a retry loop; the terms of
use and the risk stated on the CLI's README.

## 6. Review every slice

Before a slice merges, a **fresh agent** reviews it. Give it the handbook, the repository, `plan.md`, the public
exports of cli-core and cli-base, and the reference CLI's source, not your summary of the change. It answers, each
with a `file:line`:

1. the six review questions in [New CLI → Done when](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/new-cli.md#done-when);
2. **parity**: each command, option, `--json` field and error `reason` compared with the reference CLI's for the same
   thing; a difference without a reason in `plan.md` is a finding;
3. **reuse**: each function longer than a few lines in the CLI that cli-core, cli-base or another CLI already has;
4. **security**: secrets, untrusted text, hosts, what reaches the store.

Fix the findings or write why not in the pull request. `cli-dev audit` with the parity groups runs in CI; read its
output, do not only wait for green.

## 7. Done

All of [Done when](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/new-cli.md#done-when) passes on
`main`. Then: the CLI's entry in WireCat Desktop's catalog (a pull request in wirecat-desktop, as other CLIs were
added), its page on wirecat.dev (the `wirecat-docs` skill), its provider in cli-core's registry if cli-core does not
seed it, and a live check on the owner's account run by the owner or with the owner's yes, recorded in the repository.

## How to work

- One worktree per repository off `origin/main`; never `git stash` (worktrees share it); push once per slice when the
  local checks pass; re-run only failed CI jobs.
- At most two building agents per repository, plus the reviewer. Heavy commands one at a time:
  `flock ~/.cache/wirecat-heavy.lock sh -c 'free -g && <command>'`.
- Never delete: list it in `CLEANUP.md`. Never kill a process by name.
- Plans, research and the journal stay private; the public repository gets synthetic data only.

## Report

At the end of each slice and at the end: the pull requests and their state, the slice's checks and their output,
the review findings and what was done with each, the decisions you made, and the `NEED-n` questions left for the owner.

## The prompt that starts this skill

Copy it, fill in the brackets, and give it to an agent:

```text
Use the new-cli skill to build a WireCat CLI for <service>.
Category: <meetings | messenger | mail | calendar | files | CRM | notes | other>.
What it must do first: <the first useful slice, in one sentence>.
Design answers I already have: content languages <…>; sign-in <…>; what the service offers <…>;
filters <…>; never store <…>; untrusted text <…>.
Accounts to test on: <a test account, or "ask me before any live run">.
Go on alone after the plan: <yes | no, show me the plan first>.
```
