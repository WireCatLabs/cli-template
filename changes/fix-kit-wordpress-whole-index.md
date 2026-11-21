### Fixed

- **A WordPress CLI leaves out every `api` call whose answer may hold an application password, by the generator's
  own rule.** cli-base 0.125.2 marks the field secret, and cli-core then offers no command for the create, list, get,
  update and introspect of application passwords. The wp-json seed no longer leaves the whole route out by hand, so
  the delete-all of application passwords is a command again. `src/api.test.ts` runs only the offered calls and
  checks that the create is not one.
- **cli-base names the two WordPress routes that clashed.** `block-types-list-namespace` and
  `users-application-passwords-delete-all` come from cli-base's path rule, not from `names.commands` in the seed. The
  names are the same as before.
- **kit e2e builds a WordPress CLI from the whole 6.9.4 index,** 150 operations, not a cut of 26 routes, so a clash
  or a secret field anywhere in WordPress stops the template's own check.
- **A CLI from a config with a source names what its sync keeps.** The README, `docs/index.md` and the agent skill
  said only that the `api` group reaches the service. They now say that `sync` keeps the people, organizations and
  deals (CRM), the issues (tracker) or the posts, pages, terms and authors (content), and which commands read it.
