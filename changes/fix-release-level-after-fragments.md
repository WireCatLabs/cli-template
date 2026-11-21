### Fixed

- **`bin/release` picks the version after it collects `changes/`.** When npm already had the version, it chose the
  next one from the changelog before the fragments were in it, so a fragment with `Added` still gave a patch, and
  `version:check` then refused the release pull request (wordpress-cli 0.1.3, which had to be 0.2.0). The fragments
  are now collected first, and an `Added` raises the release to a minor. A version dated by hand is raised the same
  way when the fragments merged since need more. `scripts/release.test.ts` checks both and is kept up to date by
  `upgrade`, as `bin/release` is. A CLI gets this with its next `upgrade`.
- **The template builds on cli-core 0.718.0 and cli-base 0.126.1**, so `pnpm audit:commands` passes the family audit
  again: the published CLIs still name an unknown profile twice, and cli-base 0.126.1 lists that as a shared
  difference.
