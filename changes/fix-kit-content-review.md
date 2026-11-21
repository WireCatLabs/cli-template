### Fixed

- **A content CLI from a config shows and checks its write keys.** `src/config.ts` passes cli-core's content write
  keys and their `ask` levels, so `posts create --dry-run` no longer says `allow` for a write that asks, and
  `--allow-delete` names `posts.delete.force`. The `api` group's create and update of the written route check
  `posts.create` and `posts.update` too, so a deny on a `posts` command covers the raw write (WC-PERM-22).
- **A WordPress CLI's risky `api` writes ask.** Writes that install a plugin or change settings, users, comments,
  templates, widgets, menus or navigation ask by default.
- **The content and `api` tests check what they send.** `src/content-options.test.ts` checks each write's result,
  and that `posts.create: deny` stops the `api` write. `src/api.test.ts` checks every option's value, reads a second
  page with `--all`, and checks the WordPress writes that ask.
