### Added

- **A new CLI gets cli-core's types from its `-dev` release.** `pnpm-workspace.yaml` overrides `@wirecat/cli-core` to
  the pinned version plus `-dev`, the same code with its type files, which only this checkout installs; users keep the
  lean package. Without it `pnpm typecheck` fails with TS7016
  ([README](../README.md#cli-cores-types-come-from-its--dev-release)).
