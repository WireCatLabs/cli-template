### Fixed

- **`bin/release` leaves the tests to GitHub.** Without `--local` it runs every check of `release:check` here except
  `test:coverage`, which `release.yml` runs on the same commit before it publishes. On a busy computer the local tests
  timed out and stopped releases whose tests passed on GitHub. `--local` and `--first` still run all of
  `release:check`.
