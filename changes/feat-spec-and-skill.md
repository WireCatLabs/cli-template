### Added

- **`new --spec openapi|swagger|discovery|none`** builds the `api` group from the service's API description, beside
  `--api`, which stays what the service offers. A CLI gets a sample description of the made-up Example Comments
  service in `spec/<command>/` with `provenance.json` (each source's URL and SHA-256), `scripts/sync-spec.ts`,
  `scripts/spec-model.ts` (hash check, Swagger upgraded with `upgradeToOpenApi3`, several sources joined with
  `mergeOpenApi`, corrections through `patchSpec`) and `scripts/generate.ts` with the `overrides`, `readingPosts`,
  `names`, `permissions`, `pagination` and `auth` options marked `SAMPLE:`. `src/commands/api.ts` is cli-core's
  `serviceApiCommand` with the profile's token and the manifest's hosts; `src/config.ts` merges
  `serviceApiPermissions` and sets the delete key every delete through `api` also checks; `src/api.test.ts` runs every
  operation against `fakeApi`. `scripts/commands.ts` writes the agent skill's API pages with `apiSkillFiles`, and the
  agent skill links `references/api.md`. `pnpm generate` and `generate:check` run the API step first.
- **The `new-cli` skill follows the new order**: category → spec → generate → source → `cli-dev ready`. It lists every
  value each `new` flag takes (a test keeps the list equal to the interview's), keeps at most two builder agents per
  repository, each with its own files, and moves the details into references: the API description path, document
  and CRM sources with cli-core's contracts, the first release and live check, and the reviewer's brief, in which the
  reviewer checks the builder's report against the code.
- **notion-cli is the reference for files and documents** in `AGENTS.md` and the reference CLIs page, for the sync and
  cli-core's document contracts; drive-cli stays the reference for the command tree.

### Changed — may break callers

- cli-core 0.684.0, cli-base 0.108.0 and cli-testing 0.7.3. `scripts/commands.ts` (a seed) collects its files in
  `artifacts` and names every stale one; an existing CLI keeps its own copy.
