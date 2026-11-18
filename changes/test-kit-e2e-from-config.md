### Fixed

- **A CLI made by `new --from-config` passes its own `pnpm test:coverage`.** A CRM or tracker CLI with `auth.verify`
  failed it (a tracker reached 52% of branches against 75%): the seed held the token check and branches on the
  config's values that no test of that CLI could take both ways. The check is now cli-core's `manifestVerify`,
  `pnpm generate` writes the config's values with their exact types (a removed `verify` fails typecheck), the hosts-only
  fetch is cli-core's `hostsFetch`, the CRM store is cli-core's `openAppStore`, and new tests cover a sync before
  `session start`, `--offline` and `api show`.
- **The daily "a newer version exists" line shows.** `src/program.ts` set up the update check but never handed it to
  cli-core's `run()`, so no CLI made from the template printed it.
- **The `--offline` refusal is cli-core's `refuseOffline`**, in place of a copy in `src/context.ts`.

### Added

- **`kit:e2e` makes two CLIs with `new --from-config`**, a CRM over an OpenAPI description and a tracker over a GraphQL
  schema, both with a token check and so without the sample, and runs the same checks as the others. The path was
  checked only by hand before.
