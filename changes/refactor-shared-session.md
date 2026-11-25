### Changed — may break callers

- **The sample sign-in is cli-core's `tokenSessionCommand`.** A new CLI's `src/commands/session.ts` no longer builds
  `session start`, `status`, `end` and `list` by hand: it hands cli-core a `verify` that asks the service whose the
  token is. `session start --json` now shows the account's fields at the top of its item (`id`, `name`) in place of a
  `user` object. The [sign-in reference](../kit/skills/new-cli/references/sign-in.md) says how to switch to
  `oauthSessionCommand` for a sign-in in the browser.
