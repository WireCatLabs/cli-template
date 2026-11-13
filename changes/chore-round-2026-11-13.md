### Changed — may break callers

- **Built on cli-core 0.651.0** (was 0.650.0) and cli-base 0.99.0. A stale meeting project fingerprint fails with
  `conflict`, not `configuration_error` (reason `meeting-project.stale`), and the first screen lists `pbx`, the
  Asterisk tool. `doctor reports create` gives a pre-filled issue link when package.json names a GitHub repository. What
  changed is in [cli-core's changelog](https://github.com/WireCatLabs/cli-core/blob/main/CHANGELOG.md) and
  [cli-base's](https://github.com/WireCatLabs/cli-base/blob/main/CHANGELOG.md).
- **The family audit is cli-base's `cli-dev audit --family`**, in CI and in `pnpm audit:commands`, as mail, gcal and
  beeline run it. `scripts/audit.sh` is gone, and `template.json` no longer lists it. It installs the published CLIs
  of the parity groups, reads every CLI's `commands info` and fails only on a finding that names this CLI.
  Known differences go in the new `lint/audit-differences.json` (`--differences`), each with its group and
  `review_after`; a new CLI starts with an empty list. A CLI that still has `scripts/audit.sh` deletes it once CI
  runs the new command.
- **The shared workflows run cli-base 0.99.0's** `node-ci.yml`, `changelog-guard.yml`, `release-checks.yml` and
  `release-start.yml` (the last two were on 0.85.1).
