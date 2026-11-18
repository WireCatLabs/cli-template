### Fixed

- **A tracker CLI made from a config builds.** Its line in WireCat Desktop's manifest listed all seven kinds (64
  characters), and `pnpm generate` stopped on `desktop.sync.what`, which takes 40. The line now keeps the kinds a sync
  reads last: "your projects, issues and comments".
- **A tracker's sync test fails when a kind fails.** A typo in a variable of the source failed every kind before a
  request was sent, and the test passed: it read only the answer's `issues`, not each kind's `error`.
- **The `api` test of a GraphQL CLI sends only the variables an operation requires.** A sample of every optional
  field nests filter in filter (Linear's `IssueFilter` reaches `TeamFilter` and back): the test ran out of memory
  before its first case.
- **Spell checking skips `skills/*/references/api/`,** written by `pnpm generate` from the service's own words, as it
  skips `docs/commands.md`. Linear's descriptions of its API stopped `pnpm docs:check` on twelve words.
