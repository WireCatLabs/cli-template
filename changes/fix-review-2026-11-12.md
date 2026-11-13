### Changed — may break callers

- **Built on cli-core 0.647.0** (was 0.623.0), cli-base 0.98.0 and cli-testing 0.7.0. `schedule pause <name>` and
  `schedule resume <name>` take a schedule off its timer and keep it, and `--at` repeats (`--at 08:30 --at 18:00`).
  `doctor reports show` and `doctor reports create` write a problem report to send, and a paged answer reads
  `hasMore` from the service. What changed is in
  [cli-core's changelog](https://github.com/WireCatLabs/cli-core/blob/main/CHANGELOG.md) and
  [cli-base's](https://github.com/WireCatLabs/cli-base/blob/main/CHANGELOG.md).
- **`contracts/mcp-tools.json` keeps only tool names, input schemas and annotations**, cli-testing 0.7.0's short form.
  A cli-core release that rewords a description or widens an answer no longer changes it.

### Fixed

- **A development run of the built CLI never sees your home folder or keyring.** `pnpm lint:commands`,
  `pnpm smoke:node` and `pnpm smoke:bun` run it through the new `scripts/sandboxed.ts`: a throwaway `HOME`, `XDG_*`
  folders inside it, no `CLIDEV_*` overrides, and `DBUS_SESSION_BUS_ADDRESS=disabled:`. `scripts/smoke.ts`,
  `scripts/audit.sh` and `scripts/live.sh` drop or move the same variables. A CLI that moves its folders on start
  moved the owner's real ones from a development build.
- **A merge to main is never cancelled by the next one.** `standards.yml` cancelled a running check on main when
  another merge followed, which left that commit unchecked (WC-CI-7). It now cancels only a pull request's older run.
- **Dependabot opens one pull request a week for GitHub Actions**, not one per action.
- **A pull request that changes only Markdown or the version number** skips the steps of the `node-22` and `kit-e2e`
  jobs, and their checks still pass. The jobs node-ci runs are unchanged.
- **`new` says to turn on deleting merged branches** (`gh repo edit <owner>/<name> --delete-branch-on-merge`), in its
  first step and in the kit's README.
- **The testing page says how to write an upgrade contract**: `"previous": {}`, so `cli-contract` finds the previous
  release, and a seed made with public commands only.
- **`ci:quick` builds once.** It ran `pnpm build` and then `lint:commands`, which builds again.
