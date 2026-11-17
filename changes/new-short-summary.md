### Changed — may break callers

- **`new` ends with a short summary.** "Try it" lists the four lines that make the CLI and show its commands. "Before
  the first commit" is one new script, `pnpm bootstrap`, in place of seven commands: it runs the lint fix, the
  generator twice, the contract and MCP snapshot updates and `ci:quick`. A `--preset generic` CLI gets two publishing
  steps with paths relative to it, in place of three long ones with absolute paths.
- **`new` picks a free environment prefix by itself.** When the command word's prefix is one the service's own tools
  read (`NOTION_`, `GH_`, `GITHUB_`, `HUBSPOT_`), the CLI is made with `<PREFIX>_CLI_` (`WC<PREFIX>_` for a WireCat
  package) and the summary says so, in place of a list of files to rename by hand.
