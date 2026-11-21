### Fixed

- **A WordPress CLI never offers making an application password.** WordPress answers the new password in clear and
  its index marks no field secret. cli-base 0.125.2 marks it, and cli-core then leaves the create, list, get, update
  and introspect of application passwords out of the `api` group; `api show` says why. Both deletes are commands.
  `src/api.test.ts` checks that the create is not offered and that no other call is left out.
- **kit e2e builds a WordPress CLI from the whole 6.9.4 index,** not a cut of 26 routes, so a clash of command names
  or a secret field anywhere in WordPress stops the template's own check.
- **A CLI from a config with a source says what its sync keeps.** The README, `docs/index.md` and the agent skill
  said only that the `api` group reaches the service. They now say that `sync` keeps the people, organizations and
  deals (CRM), the issues with their projects, labels and comments (tracker), or the posts, pages, their terms and
  authors (content), and which commands work from that copy.
