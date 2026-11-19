# kit — `new`, `upgrade` and `remove-sample`

The copy tool behind `npx @wirecat/cli-template`. It is the package's `cli-template` bin
(`kit/dist/main.js`, built from `kit/src` by `tsc -p kit`). It is never copied into a new CLI. How the
template repository feeds it is in [DEVELOPING.md](DEVELOPING.md).

To have an agent build a whole CLI with it, from research to the first release, use the
[new-cli skill](skills/new-cli/SKILL.md); its last section is the prompt to fill in.

```sh
npx @wirecat/cli-template new cal-cli --command cal --package @wirecat/cal-cli --owner WireCatLabs \
  --category notes --content-lang en,ru --sign-in token --api official-docs --spec openapi --filters time,person \
  --never-store tokens --untrusted names,links
npx @wirecat/cli-template upgrade --dry-run
npx @wirecat/cli-template remove-sample
```

## `new <name>`

`new` copies the files of its own package version into `./<name>`. It renames the placeholders, rewrites
`package.json`, runs `git init` and writes `template.json`, `docs/dev/DESIGN.md` and the reference CLI into
`AGENTS.md`. It does not install packages, commit or push.

It sets up what CI's `repo-setup` job (`cli-dev repo-check`) checks in the files: a monthly cron minute and a parity
group in `config/parity-groups.json`. A WireCat CLI gets a free minute inside WC-CI-9's window, from the table in
cli-base's `docs/standards/ci.md`; a CLI outside `@wirecat` gets one after that window. It then prints the steps that
need a person: four for a WireCat CLI, two with `--preset generic`. Before them it prints how to try the CLI, and
`pnpm bootstrap`, the one script that readies it for the first commit. For a WireCat CLI it also prints the entries to
paste into cli-base's minute table, cli-core's `WIRECAT_TOOLS` and cli-docs' `tools.json`. When the command word's
environment prefix is one the service's own tools read, such as `NOTION_`, it makes the CLI with `NOTION_CLI_`
(`WCNOTION_` for a WireCat package) and says so. It warns when the keyring service is taken, such as `notion-cli`.

The steps run the owner's scripts the CLI gets, each one readable file that prints its plan and asks first:

- `bin/setup-github` creates the public repository, main's ruleset with the checks `cli-dev repo-check` requires,
  and the npm environment limited to main. A step already done is skipped.
- `bin/release --first` publishes the first version from the owner's computer, then says how to set npm trusted
  publishing.
- `bin/live <keyring account>` runs `scripts/live.sh` against a test account. It prints the script's `# Needs:`
  lines, reads the token from the keyring entry `service <app>-live account <keyring account>` and passes it on
  stdin, records the pass, and on a release branch commits the record and adds it to the pull request's Conformance
  section (WC-REL-17). A version whose shipped code already passed is not run again; `--again` runs it anyway, as
  after a change to `scripts/live.sh` alone.

With `--spec` other than `none`, `new` also builds the `api` group from the service's API description: one command
per operation through cli-core's `serviceApiCommand`, its permissions, its tests against cli-base's `fakeApi`, and the
agent skill's API pages from `apiSkillFiles`. It writes a sample description of the made-up Example Comments service
to `spec/<command>/` with `provenance.json`, `scripts/sync-spec.ts`, `scripts/spec-model.ts` and `scripts/generate.ts`,
and puts the API step in front of `pnpm generate` and `generate:check`; `pnpm bootstrap` then regenerates the
contracts. Swagger 2.0 adds cli-base's converter, `@scalar/openapi-upgrader`, to `devDependencies`. The order of work is in the new-cli skill's
[references/openapi.md](skills/new-cli/references/openapi.md).

`--spec-url <url>` downloads the service's own description, OpenAPI 3 or Swagger 2.0, JSON or YAML, instead of the
sample: https only, or http from localhost, at most 20 MB. It writes the description's servers into the identity's
`hosts`, and its title and the command word into the api group; the new-cli skill's
[references/openapi.md](skills/new-cli/references/openapi.md#new---spec-url-url) lists what it writes. The first
`pnpm build` or `pnpm generate` then makes one command of each operation.

`--preset generic` is for a CLI outside WireCat. It needs only `<name>` and `--owner`: the command word is `<name>`
without `-cli`, the package `@<owner>/<name>`, and the questions about WireCat's store, search and Desktop get neutral
answers (category `other:api`, content in `en`, a token sign-in, untrusted names and links). Any flag given wins.
It refuses a `@wirecat/` package. `template.json` records `"preset": "generic"`, and `bin/release` and
`release-start.yml` then need no recorded live check (WC-REL-17's exception for a CLI outside WireCat).

```sh
npx @wirecat/cli-template new poke-cli --preset generic --owner example --sign-in none \
  --spec-url https://raw.githubusercontent.com/PokeAPI/pokeapi/d19c710b7f101ea86e02989d23a152d231de98be/openapi.yml
```

`--from-config wirecat.config.ts` takes the answers from one file instead of flags, and the CLI keeps it:

```ts
import { defineCli } from "@wirecat/cli-core/manifest"

export default defineCli({
  identity: { command: "acme", package: "@wirecat/acme-cli", prefix: "WCACME", service: "Acme", owner: "WireCatLabs" },
  spec: { kind: "openapi", from: "https://acme.example/openapi.json" },
  auth: { preset: "token", verify: { operation: "getMe", id: "workspace.id", name: "workspace.name" } },
  category: "crm",
  source: { provider: "acme", kinds: ["person"], entities: { person: { … } } },
})
```

The folder is the package's name without its scope. The config sets `--command`, `--package`, `--owner`,
`--category` (`other` becomes `other:api`), `--sign-in` (`oauth2-pkce` becomes `oauth`), `--spec` and `--spec-url`;
giving one of them as a flag too is an error. The other answers are flags or asked. `prefix` names the environment
variables (`WCACME_…`) and is kept in `template.json`; `service` is the service's name in the README. The config is
read before the CLI has `node_modules`: its import resolves to the kit's own cli-core, which checks it with
`parseCliConfig`. In the CLI:

- `pnpm generate` first writes `src/generated/wirecat-config.ts` from the config (`scripts/from-config.ts`): the
  token check, the source and the hooks, which `src/` reads; the config stays the one file to edit. Each value has its
  exact type, and one the config leaves out is a bare `undefined`: a command that still reads it fails typecheck, not a
  run.
- A `source` (a `crm`, `tracker` or `content` category) needs `auth: { preset: "token", verify }` (`app-password` for
  `content`); `new` writes the files below only for what the config
  holds at `new`, and `pnpm generate` then reads their values again.
- With `auth.verify`, `session start` is cli-core's `tokenSessionCommand` over `manifestVerify`: it checks a token with
  that operation and keeps the account's id from the answer; the CLI holds no check of its own. `verify.active` names a field that must be `true`, for a service that
  answers a revoked key with 200 and `active: false`, as Attio does; anything else is "sign in again".
- With `auth.verify` and a spec, the CLI starts without the template's sample: its wiring and tests reach the API and
  its fake, so there is nothing for `remove-sample` to do. The hosts an OAuth sign-in in the description reaches join
  `hosts`.
- With a `source`, `src/commands/crm.ts` mounts cli-core's CRM commands (`sync`, `store status`, `deals`, `search`…)
  over `crmSourceFromManifest`, the store keyed by the account `session start` checked; with `source.users`, also
  `users list|show`, read live. A function in `source` stops `pnpm generate`: the source is written out as JSON, so
  code goes into the hooks module. A `tracker` source gets
  `src/commands/tracker.ts` in its place: cli-core's tracker commands (`sync`, `issues`, `projects`…) over
  `trackerSourceFromManifest`, usually with `spec: { kind: "graphql", from: "<endpoint>" }`. `new` asks the endpoint
  for its schema by introspection; a GraphQL schema names no sign-in, so the header the key travels in is `auth` in
  `scripts/generate.ts`, the sample's `Authorization` until you check the service's documentation.
- Tests come with them: `src/commands/session.test.ts` signs in against a fake of the API, and
  `src/crm-contracts.test.ts` runs `crmSourceContract` and `crmSyncContract`, and a sync through the CLI over
  `crmManifestFake`, which pages the rows to their end. `lint/contract-exceptions.json` excepts
  `crmWriteContract`, as the source only reads. A list the generator finds no paging for fails the contract's
  cut-list case on purpose: describe the paging in the API description or an override. A tracker's
  `src/tracker-contracts.test.ts` checks the source against the generated API and syncs through the CLI over a fake
  of the schema.
- WordPress: `spec: { kind: "wp-json", from: "https://<plain install>/wp-json/", version: "6.9.4" }` with
  `auth: { preset: "app-password", verify: { operation: "getWpV2UsersMe", id: "id", name: "name" } }`, the two only
  together. `new` saves the index the way `pnpm spec:sync` does (cli-base `syncWpJson`), from a plain install, as the
  CLI serves every site; its host is not the CLI's. `session start --site <address> --login <user>` keeps an
  application password with its site, the `api` group sends every call there and nowhere else on that host, and
  `--all` pages by `X-WP-TotalPages`. The keys: `<route>.publish` for a status of publish or future, a `date`,
  `date_gmt` or `password` (unless the call keeps a draft, pending or private), and `<route>.delete.force` for
  `force=true`, with `_` in a route written as `-` (`wp-pattern-category.delete`). Only `wp/v2` is offered; `batch/v1`
  never is.
- A `content` source (posts on a site, today a WordPress site) gets `src/commands/content.ts`: cli-core's content
  commands (`sync`, `posts list|show|search|stats`, `tags list`, `users list`, `channels list`, and with
  `source.writes` `posts create|update|publish|unpublish|delete`) over `contentSourceFromManifest`. A write goes
  through the `api` group's own write path with its keys, and a key the `posts` command already asked is not asked
  again. `src/content-contracts.test.ts` runs the source, sync and write contracts and a sync through the CLI over
  `contentManifestFake`, a fake built from the config and the generated API. With `source.writes`, `src/config.ts`
  passes the content keys and their `ask` levels to `--dry-run`, and the `api` group's create and update of the
  written route check `posts.create` and `posts.update` too, so a deny on a `posts` command covers the raw write.
  `src/content-options.test.ts` checks what each write changed.
- A WordPress CLI (`wp-json`) leaves out the route that makes an application password, whose answer holds the new
  password in clear, and its `api` writes that install a plugin, change settings, users, comments, templates,
  widgets, menus or navigation ask by default.
- `pnpm source:check` checks the source's operations and every path its map reads against the generated API, after
  `pnpm generate`.

In a terminal it asks for every missing answer. Without a terminal, a missing answer is an error that lists the
choices. Nothing is guessed.

| Flag | Answers (several are comma-separated) |
|---|---|
| `<name>` | the folder and repository name |
| `--command` | the command word |
| `--package` | the npm package name |
| `--owner` | the GitHub owner |
| `--tagline` | the line WireCat Desktop shows, at most 55 characters; left out, it is made from the description |
| `--category` | one for each of cli-core's kinds: `messenger`, `mail`, `notes`, `files`, `meetings`, `calendar`, `crm`; and `tracker` |
| `--content-lang` | language codes, several: `en,ru` |
| `--sign-in` | `oauth`, `token`, `session`, `none` |
| `--api` | `official-client`, `official-docs`, `unofficial` |
| `--spec` | `openapi`, `swagger`, `discovery`, `graphql`, `wp-json` (from `--from-config` only), `none`; left out with `--spec-url`, it is the downloaded description's |
| `--spec-url` | the URL of the service's OpenAPI 3 or Swagger 2.0 description, JSON or YAML; with `--spec graphql`, the endpoint |
| `--filters` | several of `time`, `person`, `container`, `text`, `status` |
| `--never-store` | several of `tokens`, `codes`, `secret-links`, `content` |
| `--untrusted` | several of `files`, `links`, `names`, and for its category `messages` (messenger, mail), `records` (crm), `issues` (tracker), `invitations` (calendar), `transcripts` (meetings); or `none` alone |

Every question except the names, `--tagline` and `--content-lang` also takes `other:<your answer>`. `--tagline` is the
one answer with a default: left out, it is the description cut on a word at 55 characters, and in a terminal an empty
line takes it. In a terminal, `--untrusted` offers only the choices of the category; as a flag it takes any of them.

The new CLI's `package.json` names two programs for the same file: the command word, and `wcat-<command>`, which
`wcat <command>` runs (WC-CMD-29). Its bin calls `wcatStart` from `@wirecat/cli-base/wcat/start` before the program
loads, with `DESKTOP` from `src/identity.ts`: the tagline, and sign-in texts made from `--sign-in` (none for `none`),
both meant to be rewritten. `pnpm generate` writes `contracts/wirecat.json`, the manifest WireCat Desktop reads, with
`cli-dev manifest`; the CLI commits it, `files` ships it, and `pnpm contracts:check` fails when it is stale. The
template itself has none: its `package.json` installs no program for the manifest to name.

`new` writes the content languages into `contentLanguages` in `src/identity.ts`; on the first run, cli-core ticks them
in advance in the search-language question, and the person confirms. `DESIGN.md` records them too, with the
speech-model order a messenger definition should use and the warnings for languages that have no stemmer or speech
model in cli-core. `new` writes no search or model setting.

## Publishing outside WireCat

A CLI made by someone outside WireCatLabs publishes under its own npm scope, such as `@example/acme-cli`. The
`@wirecat` scope and the name "WireCat" stay WireCat's, and so do the names `cli-dev lint` warns about (WC-CMD-29).

WireCat Desktop takes a tool it has not checked only when its data folder names its scope and package: for
`@example/acme-crm-cli` the identity's `appName`, lower case, is `example-acme-crm-cli` or starts with
`example-acme-crm-cli-`. `new` writes it this way for every package outside `@wirecat`; keep it when you rename the
tool.

For such a package `new` also writes what WireCat's own lists would otherwise give: the MCP Registry name
`io.github.<owner>/<name>` in `server.json` and `package.json` (the release publishes it with a GitHub OIDC
sign-in), `--owner` as the author and the copyright holder in `LICENSE`, `config/parity-groups.json`
with a group of its own, and a monthly run between 04:01 and 05:59 UTC picked from the package name. The release
publishes no skill to ClawHub, whose `wirecat` owner is WireCat's.

1. **Make the repository public.** npm makes no provenance record for a package built in a private repository, and
   WireCat Desktop checks that record. `bin/setup-github` makes it public and lets GitHub delete a branch once its
   pull request is merged.
2. **Publish the first version by hand**, `bin/release --first` from your own computer: npm sets a trusted
   publisher in the settings of a package that already exists.
3. **Set the trusted publisher** on npmjs.com, as [Trusted publishing](https://docs.npmjs.com/trusted-publishers)
   says: your GitHub owner and repository, the workflow file `release.yml` (case matters), and the environment `npm`,
   which the template's publish job uses. Its first publish must follow within two days of setting it.
4. **Record a live check.** `bin/release` refuses a version without one (WC-REL-17), unless the CLI was made with
   `--preset generic`; a check against a test account before each release is still worth it. `scripts/live.sh` signs in
   with a token read from stdin, in temporary folders and out of reach of the keyring, runs the CLI's reads, `doctor`
   and `--wcat-describe`, and signs out. Replace the sample's reads and `# Needs:` lines with your own, then run
   `bin/live <keyring account>` on the release branch.
5. **Release with `bin/release`.** It starts `release.yml`, which publishes with no npm token. Trusted publishing
   needs npm 11.5.1 or later and Node 22.14.0 or later.

Planned for a WireCat Desktop release: Desktop adds a tool it has not checked only when its owner turns that on.
Before it installs anything, it reads the package's npm details, its provenance record and its
`contracts/wirecat.json` out of the tarball, and shows the publisher, the repository, the version, where npm built
it and the access the tool asks for.

To list the tool on wirecat.dev and in WireCat Desktop for everyone who turns community tools on, follow cli-docs'
[Community tools](https://github.com/WireCatLabs/cli-docs/blob/main/docs/REVIEWING.md#community-tools) review, and the
guide for makers in [cli-docs pull request 564](https://github.com/WireCatLabs/cli-docs/pull/564).

## `upgrade`

Run it in a CLI made from the template, with a clean git working tree. For each template-owned file that the
template changed since the recorded version, it asks one of four things:

- **apply** merges the change with `git merge-file`. The base is the recorded version, downloaded with `npm pack`.
  "Ours" is the CLI's file and "theirs" is this version. Both template versions are renamed first, so the command
  word never conflicts.
- **replace** takes the template's file as it is.
- **skip** keeps the CLI's file. It is asked again only when the template changes that file again.
- **diff** shows the template's change.

Without a terminal, `--apply`, `--replace` or `--skip` sets the answer for every file. `--dry-run` lists what each
file would get and writes nothing. Seeds and `package.json` are never touched; when the MCP Registry release needs
a change in `package.json` or `server.json` (the `mcpName` and `name` a CLI outside `@wirecat` made before 0.20.0
lacks), upgrade prints it as a step for you.

A conflict leaves git markers, and `template.json` keeps the new state under `pending`. Resolve the markers and run
`upgrade` again: it checks that the markers are gone and then moves to the new version.

## `remove-sample`

Run it in a CLI made from the template, with a clean git working tree, once your own commands replace the
`comments` sample. It refuses, changing nothing, while a file outside the sample still imports it, and names each one.
Otherwise it unmounts `commentsCommand` in `src/program.ts`, deletes `src/sample/`, `src/commands/comments.ts`,
`src/testing/fake-comments.ts` and the sample's tests, and runs `pnpm generate`,
`pnpm exec cli-contract contracts/plan.json --update` and `pnpm exec vitest run src/mcp.test.ts --update`, so no
contract still pins the sample's commands. It lists the files still marked `SAMPLE:`.

## `template.json` in a CLI made from it

`new` writes this shape and `upgrade` keeps it current. `files` has one entry per template-owned file, and `seeds`
is the template's whole list; both are cut short here:

```json
{
  "template": "@wirecat/cli-template",
  "version": "0.1.0",
  "names": { "name": "cal-cli", "command": "cal", "package": "@wirecat/cal-cli", "owner": "WireCatLabs" },
  "files": { ".github/workflows/ci.yml": "<sha256 of the renamed template file at this version>" },
  "seeds": ["src/", "README.md", "docs/", "config/wirecat/"]
}
```
