# Testing

How the tests run, and what they never touch. The rules are the handbook's
[Testing page](../../node_modules/@wirecat/cli-base/docs/standards/testing.md).

- `pnpm test` runs vitest. `@wirecat/cli-base/testing/setup` gives each test file its own temporary home folder, a
  keyring that throws and no network, and points this CLI's config, state, cache and the shared store into that
  folder. `src/testing/sandbox.ts` names the config folder, which tests write into by name.
- `pnpm test:coverage` adds the coverage floor in `vitest.config.ts`.
- A script that starts the built bin runs it through `scripts/sandboxed.ts`, as `lint:commands` and the smoke tests
  do: a temporary home folder, its `XDG_*` folders, no `CLIDEV_*` overrides and the keyring out of reach. A run
  that sees your home can move your real folders.
- `pnpm test:slow` lists the 20 slowest tests and the 10 slowest files. No test waits for real time (`WC-TEST-5`):
  waits go through an injected sleep, and `fakeClock()` from `@wirecat/cli-base/testing` records them.
- Each run logs the command lines the tests drove (`coverage/argv.jsonl`). `pnpm test:matrix` turns that log into
  [test-matrix.md](test-matrix.md); a command or option no test drives needs a reason in
  `scripts/test-matrix-untested.ts`.
- `pnpm contracts:check` runs the built CLI against `contracts/plan.json`: help, discovery, errors and the MCP tool
  list. `pnpm exec cli-contract contracts/plan.json --update` rewrites the snapshots; review the diff.
- `src/mcp.test.ts` pins `contracts/mcp-catalogue.json`: this CLI's own commands an agent can find over MCP, each a
  read or a write, from cli-core's `ownCatalogue`. What cli-core mounts is left out, since cli-core pins it, so a
  cli-core release does not rewrite the file. Pin a shared command here only when this CLI changes it on purpose.
- `pnpm contracts:upgrade` does not exist yet, and `.github/workflows/ci.yml` skips the step. It needs both local
  state of the CLI's own (a store, a sync cursor, any other file its code writes and reads back) and a published
  version to upgrade from; the skeleton has neither, and the config file and run records are cli-core's
  ([WC-TEST-14](../../node_modules/@wirecat/cli-base/docs/standards/testing.md)). Once the CLI keeps such state and its
  first version is on npm, add `contracts/upgrade.json` with `"previous": {}`: `cli-contract` then installs the newest
  published version at or below this one by itself
  ([cli-testing's contracts guide](https://github.com/WireCatLabs/cli-testing/blob/main/docs/ci/CONTRACTS.md)), so no
  version is kept by hand. Seed the state with the previous version's public commands only, never by importing its
  internal modules, which move from one release to the next. Then add the script, which runs
  `cli-contract contracts/upgrade.json`, and remove the skip.
- `pnpm smoke` installs the packed package into a temporary folder and runs it offline.
- `pnpm audit:commands` audits the command tree beside the latest published WireCat CLIs.

## The bundle a user installs

`pnpm build` compiles `src/` with `tsc`, then cli-base's `cli-dev bundle`
([WC-LAY-10](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/layout.md))
bundles `dist/bin/clidev.js` into `dist/bundle/` and makes the bin a loader. The vitest suite runs
against `src/`, so `scripts/smoke-bundle.ts` is the proof the bundle works: `pnpm smoke:node` runs it
under Node and `pnpm smoke:bun` under Bun, both in CI.
