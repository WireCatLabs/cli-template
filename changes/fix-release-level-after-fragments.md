### Fixed

- **`bin/release` picks the version after it collects `changes/`.** When npm already had the version, it chose the
  next one from the changelog before the fragments were in it, so a fragment with `Added` still gave a patch, and
  `version:check` then refused the release pull request (wordpress-cli 0.1.3, which had to be 0.2.0). The fragments
  are now collected first, and an `Added` raises the release to a minor. A CLI gets this with its next `upgrade`.
