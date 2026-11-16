# The first release and the live check

Read this when `cli-dev ready` has only the live check and the release left. The rules are cli-base's
[Releases](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/releases.md) and
[WC-TEST-18](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/testing.md#wc-test-18--check-the-real-service-by-hand-never-in-the-test-suite).
Every step here is the owner's: hand over the absolute path and the one command, never a secret.

1. **The repository.** The owner runs `node <cli>/bin/setup-github` once: the GitHub repository, its ruleset with
   CI's checks and the npm environment. Until then CI's `repo-setup` is red; the tests run beside it.
2. **The live check, on the release pull request's branch.** `bin/live <keyring account>` prints what the test
   account needs (`# Needs:` lines of `scripts/live.sh`), asks, reads the token from the keyring entry
   `<app>-live` in its own process, runs `scripts/live.sh` and records the result. With an open pull request it commits
   the record to it and fills its Conformance section. Prepare the test page or record the `# Needs:` lines name before
   asking the owner.
3. **The first publish.** After the release pull request merges, the owner runs `bin/release --first`: it publishes
   from the owner's machine, since npm's trusted publishing needs the package to exist, and prints the trusted
   publisher to set on npm. Every later release goes through CI.
4. **The lists.** The pull requests to cli-base, cli-core and cli-docs with the entries `new` printed.

A live check runs only with the owner's yes for that run. An agent never runs the CLI against the owner's account on
its own.
