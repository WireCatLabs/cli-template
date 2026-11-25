# Sign-in

`session start | status | end | list` comes from cli-core. Never build these commands by hand, and never copy them
from another CLI: a copy drifts from the shared texts, the keyring rules and the moved-run rules (WC-ACCT-12,
WC-SECR-24). A gap in the shared command is fixed in cli-core.

## A token or key

The template's `src/commands/session.ts` is cli-core's `tokenSessionCommand` from `@wirecat/cli-core/cli`. Give it:

- `verify`: one call that asks the service whose the token is. It returns `id`, which names the account, and
  `account`, which `session start` and `session status --check` show.
- `guide`: the steps and links that make a token, for a person who never made one. `session start` prints them before
  it asks.
- `site`, when the service runs on the owner's own site.
- `login`, when the secret is a password for a user name.
- `claim`, when one account may belong to only one profile.

With `auth.verify` in `wirecat.config.ts`, `new` writes the same command with `manifestVerify` as `verify`.

## Sign-in in the browser (OAuth)

Switch `src/commands/session.ts` to cli-core's `oauthSessionCommand`, with `oauthPreset` and `oauthFlowOf` from
`@wirecat/cli-core/cli`. It signs in with PKCE on the loopback, checks the account before it keeps the tokens, and
refreshes them under one lock (WC-SECR-22). Give it:

- `providerId` and `service`: the preset's `id` and `name`.
- `preset`: `oauthPreset(oauthFlowOf(manifest), { id, name, client, scopes, redirect })`. The flow comes from the
  description's `securitySchemes`. A service with no description writes the flow by hand.
- `verify`: as for a token, but with the access token.

The other commands need the access token this sign-in keeps, not `ProfileTokenStore`. cli-core 1.0.0 has no shared
helper that hands it to a command yet. That gap belongs in cli-core, so add the helper there rather than rebuild the
storage in the CLI. `oauthSessionCommand` and `oauthPreset` are marked experimental in cli-core: read their doc
comments before you build on them.
