### Fixed

- **A CLI from a config no longer names the sample it left out.** `docs/index.md`, `docs/security.md` and
  `docs/configuration.md` of a CLI made by `new --from-config` with a token check said the sample's made-up address
  never resolves and that `comments` runs in a run; that CLI has no sample and no `comments`. Found on linear-cli.
