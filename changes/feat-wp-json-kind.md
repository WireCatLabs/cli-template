### Added

- **A WordPress CLI from a site's REST index: `spec.kind: "wp-json"` in `wirecat.config.ts`.** With
  `auth.preset: "app-password"` and the WordPress `spec.version`, `new --from-config` saves the index of a plain
  install as `pnpm spec:sync` does, and the CLI's `api` group offers every `wp/v2` route. `session start --site
  <address> --login <user>` keeps an application password with its site; every call goes to that site alone, never to
  another site on the same host, and `--all` pages by `X-WP-TotalPages`. Publishing needs `<route>.publish`, by
  status, by a date or a password, unless the call keeps a draft, pending or private; a delete with `force=true` also
  needs `<route>.delete.force`. `batch/v1` is never offered. The README says which key guards what, and the one limit
  of the raw `api` group: a missed schedule publishes on any edit. See [the kit's README](../kit/README.md).
- **A content CLI from a config: `category: "content"`.** A config whose `source` maps a site's posts, tags and users
  (a WordPress site today) gets cli-core's content commands: `sync` into a local copy, `posts list|show|search|stats`,
  `tags list`, `users list`, `channels list`, and with `source.writes` `posts create|update|publish|unpublish|delete`.
  A write goes through the `api` group's own write path and keys, and asks the owner once. Two profiles on two
  sites keep two copies, even when both sign in as user 1. The CLI comes with the
  content contract tests over a fake of its own API. See [the kit's README](../kit/README.md).
