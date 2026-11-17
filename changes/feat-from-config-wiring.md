### Added

- **A CLI made with `--from-config` signs in and syncs from its config.** `pnpm generate` writes the config's token
  check, CRM source and hooks into `src/generated/wirecat-config.ts`. With `auth.verify`, `session start` checks a
  token with that operation and keeps the account's id; with a `source`, `src/commands/crm.ts` mounts cli-core's CRM
  commands over `crmSourceFromManifest`, the store keyed by that account ([kit reference](../kit/README.md#new-name)).
- **Its tests cover that wiring.** `src/commands/session.test.ts` signs in against a fake of the API built from its
  description. `src/crm-contracts.test.ts` runs cli-core's `crmSourceContract` over `crmManifestFixture` and
  `crmSyncContract` over the store. `lint/contract-exceptions.json` excepts `crmWriteContract` with its reason, as the
  source only reads. The CLI says what `sync` copies in (`syncs`). On a fresh CLI `cli-dev ready` verifies every row
  but two: the contracts row is partial for that exception, and the live check is the owner's to run.
- **`new --from-config` refuses a CRM `source` without `auth: { preset: "token", verify }`**, the only sign-in that
  names the account the store keeps the rows under; `pnpm source:check` checks that `auth.verify` is a read.

### Changed — may break callers

- **The sample's `session` tests moved from `src/comments.test.ts` to `src/commands/session.test.ts`**, so a CLI can
  replace them along with `session.ts`.

### Fixed

- **A CLI made with `--spec` passes `generate:check` after the printed steps.** The first `pnpm generate` writes the
  skill's parts, which the commands page lists only from the second; `new` now prints a last `pnpm generate`.
