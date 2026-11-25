### Fixed

- **`bin/release` leaves the test matrix check to GitHub too.** `test:matrix:check` reads the argv log the tests
  write, so once `bin/release` stopped running the tests here it failed on every release (0.35.0 of this template).
  `ci.yml` now runs it right after `pnpm test`, so `release.yml` checks it on the commit it publishes, and a pull
  request checks it as well, which it never did. A CLI gets both with its next `upgrade`.
