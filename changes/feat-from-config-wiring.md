### Added

- **A CLI made with `--from-config` signs in and syncs from its config.** `pnpm generate` writes the config's token
  check, CRM source and hooks into `src/generated/wirecat-config.ts`. With `auth.verify`, `session start` checks a
  token with that operation and keeps the account's id; with a `source`, `src/commands/crm.ts` mounts cli-core's CRM
  commands over `crmSourceFromManifest`, the store keyed by that account ([kit reference](../kit/README.md#new-name)).

### Fixed

- **A CLI made with `--spec` passes `generate:check` after the printed steps.** The first `pnpm generate` writes the
  skill's parts, which the commands page lists only from the second; `new` now prints a last `pnpm generate`.
