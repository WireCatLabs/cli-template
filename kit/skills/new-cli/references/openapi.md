# The api group from an API description

Read this when the service publishes OpenAPI, Swagger or a Google Discovery document. What each generator option does
is in cli-base's [Kit surface → The API generator](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/kit-surface.md#the-api-generator);
this page is the order of work.

## What `new --spec` gives you

| File | What it is | What you change |
|---|---|---|
| `spec/<cli>/` | The made-up Example Comments service's description and `provenance.json` (the source URL and SHA-256 of each file) | Replace with the service's, through `pnpm spec:sync` |
| `scripts/sync-spec.ts` | Downloads each source `provenance.json` lists and records its hash | For OpenAPI and Swagger: nothing, the sources are listed in `provenance.json`. For Discovery: the documents in the script |
| `scripts/spec-model.ts` | Checks the hashes, upgrades Swagger to OpenAPI 3, joins several sources with `mergeOpenApi`, applies `patchSpec` | The `PATCHES`, each with its reason |
| `scripts/generate.ts` | Writes `src/generated/` and `docs/dev/API_COVERAGE.md`; `--check` fails on stale files | `overrides`, `readingPosts`, `names`, `permissions`, `pagination`, `auth` |
| `src/commands/api.ts` | The `api` group through cli-core's `serviceApiCommand`: `api list`, `api show` and one command per operation, the profile's token and pace, the hosts in `src/identity.ts` | The service's name |
| `src/config.ts` | `API`: the service's name, the operations the group offers (none that answers with a credential) and the key every delete through `api` also checks | `service`, and `deleteKey` to the delete key your own commands use |
| `scripts/commands.ts` | Also writes the agent skill's API pages, `references/api.md` and one `references/api/api-<group>.md` per tag, with `apiSkillFiles`; the skill's `SKILL.md` links `references/api.md` | The tags in the spec, if a group comes out too large |
| `src/api.test.ts` | Runs every operation against `fakeApi`, a strict fake built from the spec, and checks that a denied delete key refuses before anything is sent | The sample body |

`pnpm generate` and `pnpm generate:check` run the API step before the build. Every line marked `SAMPLE:` is replaced
before the first release.

## Order of work

1. **Find the description** on the service's documentation, never a third-party copy. Put each source's `name`, `url`
   and `file` in `spec/<cli>/provenance.json` (Discovery: in `scripts/sync-spec.ts`), run `pnpm spec:sync`, and read the
   diff. A service with one spec per object (HubSpot) lists each one it needs; `mergeOpenApi` joins them and its report
   lands in `docs/dev/API_COVERAGE.md`.
2. **Swagger 1.2** (Yandex Disk) is a resource listing plus one declaration per API. `new --spec swagger` sets up
   2.0; for 1.2, change `scripts/sync-spec.ts` to fetch the listing and each declaration, and call
   `upgradeToOpenApi3(listing, declarations)` in `scripts/spec-model.ts`, as the Kit surface describes. The sync reads
   JSON only: a service that publishes YAML needs a YAML parser there.
3. **Correct the source only with a reason** from the documentation or a captured answer: a missing server, a wrong
   type, an undefined schema (`stubMissingSchemas`). Each patch is listed under "Spec corrections" on the coverage page.
4. **Fill the options in `scripts/generate.ts`**, each from the documentation:
   - `overrides` for a POST that deletes (HubSpot's `batch/archive`, `merge`) or a method that misleads;
   - `readingPosts: true` only when every `…/search` and `…/query` POST of the service only reads;
   - `names`: command names from paths (`fromPath`, `segments`), and `commands` for one that comes out wrong. Match the
     reference CLI's words (`deals-list`, not `get-deals`);
   - `permissions`: the group (the CLI's delete key is `<group>.delete`), `deletingFlags` (Notion's `in_trash`, Yandex
     Disk's `permanently` and `overwrite`; an undocumented flag counts as a delete) and `shares`;
   - `auth` when the spec's sign-in is wrong or missing, with the reason.
5. **The delete key.** `src/config.ts` passes one `deleteKey` to the whole group: a destructive operation also asks
   by that key, so denying `<group>.delete` holds in `api` as in your own commands. cli-core 0.684 does not yet read
   the manifest's `permissions`, so a deleting body field (`in_trash`) is checked only when it is listed in the
   operation's `deletingFields`, and a deleting query parameter or a share not at all: check what your cli-core
   version reads before you rely on `deletingFlags` and `shares`. A body only the CLI can read as a delete goes in
   `deletingBodies`.
6. **What the api group cannot send.** An operation that answers with a credential is left out in `src/config.ts`.
   `excluded` in `serviceApiCommand` only explains to `api show` why an operation is missing; it removes nothing.
   To leave an operation out of an OpenAPI spec, remove its path with a patch, with the reason; a Discovery method
   goes in the spec model's `exclude`, and so does one with a `{+name}` path, which the group cannot send.
   One server per account (a CRM portal of its own) does not fit the group's one fixed `baseUrl` yet: that is a cli-core
   gap.
7. Run `pnpm generate`, the contract and MCP updates `new` printed, and `pnpm ci:quick`. Read the coverage page: every
   operation the service offers is either a command or left out with its reason.

## The tests

`src/api.test.ts` sends every operation once through `fakeApi`. The fake refuses a call the spec does not allow (an
unknown path, a missing required field, a wrong type, a call without the token) and lists why in `refusals`; the
test expects none. Give `answers` for an operation whose sample answer is not enough, and `hosts` for a download link
the service hands out. A command of your own over the same operation is tested against the same fake.
