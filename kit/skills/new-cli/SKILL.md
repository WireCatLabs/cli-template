---
name: new-cli
description: Build a new WireCat CLI for a service, from research to the first release, to the WireCat standards and in line with the CLIs of its category. Starts from cli-template, generates the api group from the service's API description, puts shared code in cli-core first, and has a fresh agent review every slice. Use when asked to make, start or add a CLI for a service, «сделай CLI для …», «новый CLI», «подключить сервис».
---

<!-- cspell:words whatsapp gcal bitrix worktrees -->

# New WireCat CLI

You lead the work on a new CLI for one service. The rules are not here: they live in the
[WireCat CLI standards](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/README.md) and win over this
skill. This skill is the order of work and the checks between the steps. The checklist the result must pass is
[New CLI](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/new-cli.md); read it whole before step 1.

The goal is a CLI that a user cannot tell apart from the other WireCat CLIs: the same commands, the same answers, the
same errors, the same store. A difference needs a reason the service forces, written down.

The order: **category → spec → generate → source → ready**. Read a reference below when its step comes:

- [references/openapi.md](references/openapi.md): the service publishes OpenAPI, Swagger or Google Discovery (step 4).
- [references/sources.md](references/sources.md): the CLI syncs documents or CRM records into the store (step 5).
- [references/release.md](references/release.md): the first release and the live check (step 7).
- [references/review-brief.md](references/review-brief.md): the brief for the reviewer of each slice (step 6).

## Inputs

The prompt that starts you gives: the service, the category, and the owner's answers to the
[design questions](https://github.com/WireCatLabs/cli-template/blob/main/docs/dev/skills/design-interview/SKILL.md)
it already has. An answer it lacks is asked (step 2), never guessed. The account the CLI runs against is the owner's
choice: never pick a profile, and never run the CLI on a real account without the owner's yes for that run.

## 1. Category and neighbours

1. **The category** decides the reference CLI, the store writer and the contracts `cli-dev ready` expects. The
   reference for each, from [Reference CLIs](https://github.com/WireCatLabs/cli-template/blob/main/docs/dev/reference-clis.md):
   meetings → zoom-cli; messenger → whatsapp-cli, then tg-cli; mail → mail-cli; calendar → gcal-cli;
   files and documents → **notion-cli** for the sync and the contracts, drive-cli only for the command tree;
   CRM → bitrix24-cli; notes → cli-memo. Read its `README.md`, `docs/dev/DESIGN.md`, `commands --json`, the store
   writes and the sync. Write down the command tree you will mirror.
2. **What cli-core and cli-base export**: their `package.json` exports and the type declarations in `node_modules`
   (or on their `origin/main` when you need what is not released), and the
   [Kit surface](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/kit-surface.md). Every helper you are
   about to write is looked for here first.
3. **The service.** Official API docs (context7 or the vendor's pages): sign-in, scopes, rate limits, paging, error
   codes, retention, terms of use, and **its machine-readable API description** (OpenAPI, Swagger, Google Discovery)
   if it publishes one. With no official API: open the web app, capture the real answers it gets (in your own session,
   with the owner's yes), and note what breaks if the vendor changes it.
4. Write `research.md` in the private plans folder (`cli-private/plans/<YYYY-MM-DD>-<cli>/`, never the public repo):
   each fact with its link or captured answer, and what is still unknown. All research for this CLI goes there, one
   place.

Check: every provider name, method and error code you plan to use has a source
([WC-TEST-19](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/testing.md)).

## 2. Design

Run the design interview with the owner's answers from the prompt; ask only the missing ones, one at a time, as
multiple choice with your recommendation first. Then write `plan.md` beside `research.md` (that name: the review and
the next agent look for it):

- the command tree, mapped command by command to the reference CLI's; every extra or missing command has a reason;
- what goes to the store and through which cli-core writer (meetings, messages, documents, events, records);
- **the cli-core gap list**: everything the CLI needs that another provider could also use (a session kind, a
  cookie reader, a store writer, a search lane, a pacer). Each item goes to cli-core or cli-base first
  ([WC-ARCH-5](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/architecture.md)), never into the CLI;
- the slices, smallest useful one first: sign-in and `doctor` → the api group → list and show, live → sync into the
  store → search and MCP → the rest. Each slice is one pull request;
- which builder agent owns which files (see "How to work");
- the risks, and the decisions the owner must make (`NEED-n`, with options and your recommendation).

Show the owner the plan and the gap list before step 3 when the prompt does not say to go on alone.

## 3. Shared code first

For each item on the gap list: a pull request in cli-core or cli-base, with tests, merged, and released when the CLI
needs it on npm (batch with what is already merged; announce as cli-core's
[COORDINATION.md](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/COORDINATION.md) says). The CLI pins the
exact version. A gap found later in the build goes the same way: stop, fix it in the shared package, then go on.
Bump the CLI to the latest cli-core and cli-base as its first commit; `pnpm deps:check` must pass.

## 4. Spec and generate

Start from the template. Every flag takes only the values listed; a flag left out is asked in a terminal, and is an
error without one:

```sh
npx @wirecat/cli-template new <name>-cli --command <word> --package @wirecat/<name>-cli --owner WireCatLabs \
  --category messenger|mail|notes|files|meetings|calendar|crm|other:<what> \
  --content-lang <ISO 639-1 codes, comma-separated> \
  --sign-in oauth|token|session|none \
  --api official-client|official-docs|unofficial \
  --spec openapi|swagger|discovery|none \
  --filters time,person,container,text,status \
  --never-store tokens,codes,secret-links,content \
  --untrusted messages,records,invitations,transcripts,files,links,names|none
```

`--api` is what the service offers; `--spec` is the API description `new` builds the `api` group from. With a spec,
run the steps `new` prints (they regenerate the contracts), then follow [references/openapi.md](references/openapi.md):
replace the sample spec with the service's, fill the overrides, and generate. Fix a name clash `new` warns about
before the first commit.

`new` also prints the owner's steps: `bin/setup-github`, the live check, `bin/release --first` and the entries for
cli-base, cli-core and cli-docs. Hand the owner each script's absolute path; write no script of your own for them.
CI's `repo-setup` fails until `bin/setup-github` has run; the tests still run beside it.

## 5. Source and slices

- **The source.** Documents and CRM records go through cli-core's shared commands and are proved by its contracts:
  [references/sources.md](references/sources.md). Other categories follow the reference CLI.
- Learn how a command reaches the service from the template's sample, and the domain from the reference CLI. Remove
  the sample once your commands cover every pattern it shows: `npx @wirecat/cli-template remove-sample`.
- Every request goes through cli-core's run and `hostFetch` with the manifest's hosts; every list pages the same way
  the reference CLI does; `--json` answers have the same envelope and field names as the reference CLI's for the same
  thing (a meeting is a meeting in zoom-cli and here).
- A secret (token, cookie, session) lives in the keyring through cli-core's token store; it is never an argument,
  never printed, never logged, never in the store.
- Tests against a strict fake that refuses what the real service refuses: `fakeApi` from the spec, or one built from
  captured answers; no real waits; no test reaches the network or the owner's store.
- Text that comes from other people is marked untrusted in every answer an agent reads.
- The agent skill `skills/<cli>/SKILL.md` keeps a core of about 8 KB: the main user job first, the boundaries, and
  one line per file in `references/` saying when to read it
  ([WC-DOC-22](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/docs.md)).

**An unofficial API or a browser session** adds: read-only until the owner asks for writes; requests paced below
what a person in the browser does; one place that maps the service's answers, so a change breaks one file and one
contract test; the session's expiry detected and answered with `session.expired`, never a retry loop; the terms of
use and the risk stated on the CLI's README.

## 6. Review every slice

Before a slice merges, a **fresh agent** reviews it with the brief in
[references/review-brief.md](references/review-brief.md). It gets the code and the plan, never your conclusions, and
checks each claim of the builder's report against the code. Fix the findings or write why not in the pull request.
`cli-dev audit` with the parity groups runs in CI; read its output, do not only wait for green.

## 7. Ready

`pnpm exec cli-dev ready` runs the CLI's checks in the order of
[Done when](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/new-cli.md#done-when) and says for each
whether it is verified, with the evidence, and the one next step. `--json` gives the same to an agent. Work down its
list until every row is verified; the live check is the owner's ([references/release.md](references/release.md)).
Then: the first release, the CLI's entry in WireCat Desktop's catalog (a pull request in wirecat-desktop, as other
CLIs were added), its page on wirecat.dev (the `wirecat-docs` skill) and its provider in cli-core's registry if
cli-core does not seed it.

## How to work

- One worktree per repository off `origin/main`; never `git stash` (worktrees share it); push once per slice when the
  local checks pass; re-run only failed CI jobs.
- **At most two builder agents per repository, each with its own files**, written in `plan.md` before they start
  (one owns `src/commands/` and its tests, the other the source and its fake, for example). Two agents writing the
  same file overwrite each other: notion-cli ended up with two fakes that way. The reviewer is a third agent and only
  reads.
- Heavy commands one at a time: `flock ~/.cache/wirecat-heavy.lock sh -c 'free -g && <command>'`.
- Never delete: list it in `CLEANUP.md`. Never kill a process by name.
- Plans, research and the journal stay private; the public repository gets synthetic data only.

## Report

At the end of each slice and at the end: the pull requests and their state, the slice's checks and their output,
`cli-dev ready`'s rows, the review findings and what was done with each, the decisions you made, and the `NEED-n`
questions left for the owner.

## The prompt that starts this skill

Copy it, fill in the brackets, and give it to an agent:

```text
Use the new-cli skill to build a WireCat CLI for <service>.
Category: <meetings | messenger | mail | calendar | files | crm | notes | other:<what>>.
What it must do first: <the first useful slice, in one sentence>.
Design answers I already have: content languages <…>; sign-in <…>; what the service offers <…>;
API description <openapi | swagger | discovery | none>; filters <…>; never store <…>; untrusted text <…>.
Accounts to test on: <a test account, or "ask me before any live run">.
Go on alone after the plan: <yes | no, show me the plan first>.
```
