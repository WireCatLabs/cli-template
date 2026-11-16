### Added

- **`npx @wirecat/cli-template remove-sample`** removes the `comments` sample once your own commands replace it, and
  regenerates `docs/commands.md`, `contracts/` and `contracts/mcp-catalogue.json`, so no test still pins the sample's
  commands. It changes nothing while another file imports the sample, and names each one.
- **`pnpm deps:check`**, in `ci:quick`, `release:check` and CI: `pnpm peers check` and one copy of `@wirecat/cli-base`
  in `pnpm-lock.yaml` (`scripts/one-cli-base.ts`).
- **`src/test-timeouts.test.ts`** fails a test that passes `--timeout` between 1 s and 10 s: too short for a slow
  Windows runner to finish, too long to be a deliberate cut.

### Fixed

- **`new` sets up a WireCat CLI fully**, so CI's `repo-setup` passes from the first pull request. A `@wirecat/` CLI
  now gets a free monthly minute inside WC-CI-9's window and `config/parity-groups.json`, as a CLI outside WireCat
  already did, and `new` prints the entries for cli-base's minute table, cli-core's `WIRECAT_TOOLS` and cli-docs'
  `tools.json`.
