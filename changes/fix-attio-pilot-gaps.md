### Fixed

- **`new --from-config` with `auth.verify` makes a CLI without the template's sample.** `src/context.ts`,
  `src/program.ts`, the test harness and `api`, `mcp` and `run-scope` tests reach the API and its fake, and the
  sample's files are left out; before, they imported `src/sample/`, and `remove-sample` refused the CLI until about 30
  lines were rewritten by hand. The hosts an OAuth sign-in in the description reaches, such as `app.attio.com`, join
  `hosts`, so `lint:commands` no longer stops on them.
- **A function in a config's `source` stops `pnpm generate`** and names where it is, instead of being dropped
  silently when the source is written out as JSON.
- **The seed's sync test reads the CRM's rows from `crmManifestFake`**, which pages them to their end. Over
  `fakeServiceApi`, every page of an offset list held a row, so a sync read until its budget ran out and the test
  timed out (382 pages in the Attio pilot).

### Added

- **`auth.verify.active`**: the field of the check's answer that must be `true`, for a service that answers a revoked
  key with 200 and `active: false`, as Attio does. `session start` then says to sign in again, not `provider_error`.
- **A config with `source.users` mounts `users list|show`**, read live from the CRM.
