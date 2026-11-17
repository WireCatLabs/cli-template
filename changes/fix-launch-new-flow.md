### Added

- **`new --spec-url <url>` downloads the service's API description and builds the api group from it.** OpenAPI 3 or
  Swagger 2.0, JSON or YAML, https only (or http from localhost), at most 20 MB. `new` writes the description's
  servers into the identity's `hosts`, a recorded patch when they are relative to its URL, its title as the service's
  name, and drops the path prefix every operation shares from the command names
  ([openapi](../kit/skills/new-cli/references/openapi.md#new---spec-url-url)).
- **A CLI made with `--spec openapi` or `--spec swagger` reads YAML descriptions.** `scripts/sync-spec.ts` and
  `scripts/spec-model.ts` read JSON and YAML, with `yaml` in the CLI's `devDependencies`.

### Fixed

- **A CLI made with `new --spec` builds before its first `pnpm generate`.** `pnpm build` and `pnpm typecheck`
  failed with a type error on the missing `src/generated/`, and `doctor` then crashed. Both now generate once when
  `src/generated/` is missing.
- **The api group's test fits any API.** It sends each operation as a test of its own, so a large API stays within
  the test timeout, checks a delete only when the API has one, and gives the fake the document's sign-in when an
  operation names none, as `security: []` does.
