### Fixed

- `bin/live` says when it does not run the check because the version's shipped code already passed, and `--again`
  runs it anyway. A change to `scripts/live.sh` alone is not part of the record, so before this the new steps were
  silently skipped and the old record was reported as a pass.
