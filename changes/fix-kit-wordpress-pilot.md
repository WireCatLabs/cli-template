### Fixed

- **A WordPress CLI generates from a plain site's whole index.** Two routes of WordPress 6.9.4 read as one item's
  and took the same command name (`block-types-get`, `users-application-passwords-delete`). They are now
  `block-types-list-namespace` and `users-application-passwords-delete-all`.
- **A route with `_` in its name no longer breaks the settings check.** The wp-json seed wrote the key of
  `wp_pattern_category` as written in the path, which `config` does not know. Keys are now written as their
  commands are (`wp-pattern-category.delete`), so every `api` test passes.
- **A content CLI runs cli-core's `contentSyncContract`.** The seed ran only the source and write contracts, so
  `cli-dev ready` could not verify its contracts row.
- **The WordPress example reads tags and categories without `context=edit`.** An Author or a Contributor may not
  edit terms and was refused the read. A term's name and slug are public.
- **A WordPress CLI made from a config passes its test matrix.** The wp-json `api` test passes every option of each
  operation, with `--all` over one page, and `src/content-options.test.ts` runs every content command and option.
  Before, 501 options had no test and `release:check` failed.
