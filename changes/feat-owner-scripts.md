### Added

- **The owner's scripts, template-owned**, each one readable file that prints its plan and asks first:
  - `bin/setup-github` creates the public repository, main's ruleset with the checks `cli-dev repo-check` requires (a
    test keeps the list equal to cli-base's) and the npm environment limited to main; a step already done is skipped.
  - `bin/live <keyring account>` prints the `# Needs:` lines of `scripts/live.sh`, reads the token from the keyring
    entry `service <app>-live`, passes it to `scripts/live.sh` on stdin, records the pass, and on a release branch
    commits the record and adds its line to the pull request's Conformance section (WC-REL-17).
  - `bin/release --first` publishes a package npm has never seen from the owner's computer, then says how to set npm
    trusted publishing (WC-REL-11).
- **`new` warns about a name the service's own tools use**: an environment prefix such as `NOTION_` or `GH_`, or the
  keyring service `notion-cli`, with the files to change. The steps it prints name the scripts by their absolute
  paths, and `scripts/live.sh` starts with `# Needs:` lines.
