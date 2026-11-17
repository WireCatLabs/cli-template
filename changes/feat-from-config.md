### Added

- **`new --from-config wirecat.config.ts` builds a CLI from one file.** The config, typed by `defineCli` from
  `@wirecat/cli-core/manifest`, gives the names, the environment prefix, the service's name, the API description's
  URL, the sign-in preset, the category and, for a CRM, the source manifest. The CLI keeps the file and gets
  `pnpm source:check`, which checks the source's operations and the paths its map reads against the generated API
  ([kit reference](../kit/README.md#new-name)).
- **The new-cli skill starts a CLI from the config** and works in a loop: the API's answers, the config,
  `pnpm generate && pnpm source:check`, the contract tests, and a hook only where they show the config cannot say it.

### Changed — may break callers

- cli-core 0.693.0 and cli-base 0.112.0, so a CLI made from the template starts on them; cli-core 0.693.0 needs
  cli-base 0.112.0 or later.

### Fixed

- **A CLI made with `--spec` from a description without a top-level `security` typechecks.** The seed
  `src/api.test.ts` read `API.manifest.security`, which the generated manifest leaves out then.
