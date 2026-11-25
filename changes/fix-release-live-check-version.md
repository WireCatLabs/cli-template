### Fixed

- **`bin/release` checks the live record of the version it publishes.** It checked the version in `package.json`
  before it raised it, so a raised version went out with no live check of its own (slack-cli 0.3.0, checked as
  0.2.0). The check now runs once the version is settled, before the checks and the release run.
