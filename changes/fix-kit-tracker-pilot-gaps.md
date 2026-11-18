### Fixed

- **A tracker CLI made from a config builds.** Its line in WireCat Desktop's manifest listed all seven kinds (64
  characters), and `pnpm generate` stopped on `desktop.sync.what`, which takes 40. The line now keeps the kinds a sync
  reads last: "your projects, issues and comments".
- **A tracker's sync test fails when a kind fails.** A typo in a variable of the source failed every kind before a
  request was sent, and the test passed: it read `issues` where the answer has none (they are under `meta`), and not each kind's `error`.
- **The `api` test of a GraphQL CLI fits a large schema.** It sends what an operation requires plus its optional plain
  fields, and an object flag as JSON. A sample of every optional field nests filter in filter (Linear's
  `IssueFilter` reaches `TeamFilter` and back), and the worker ran out of memory; an object flag went as
  `[object Object]`. Linear's 493 operations now pass in about 20 seconds.
- **No `api` test waits for the pace.** Every case shared the profile's pace file, so past the burst each case
  waited for real; the file is cleared after each case.
- **Spell checking skips `skills/*/references/api/`,** written by `pnpm generate` from the service's own words, as it
  skips `docs/commands.md`. Linear's descriptions of its API stopped `pnpm docs:check` on twelve words.
- **A tracker CLI from a config runs `trackerSourceContract`** over cli-core's `trackerManifestFixture`, a fake of
  its API built from the source, so `cli-dev ready` verifies its category (cli-base 0.119.0 asks a tracker for that
  contract). cli-core 0.701.0 and cli-base 0.119.0.
- **A CLI from a config drives every command and option in its tests**, so its test matrix starts with nothing
  untested: the session test covers `--credential-storage`, `session list` and `api list`; a tracker gets
  `src/tracker-options.test.ts`, which runs each tracker command and option over a synced copy; the GraphQL `api`
  test sends every variable, `--body` and `--body-file`, and `--all` on a paged list.
