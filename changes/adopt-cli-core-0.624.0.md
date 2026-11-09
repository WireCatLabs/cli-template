### Changed — may break callers

- **Built on cli-core 0.624.0** (was 0.623.0): `schedule pause <name>` and `schedule resume <name>` take a schedule
  off its timer and keep it, and `--at` repeats (`--at 08:30 --at 18:00`). What changed is in
  [cli-core's changelog](https://github.com/WireCatLabs/cli-core/blob/main/CHANGELOG.md).
