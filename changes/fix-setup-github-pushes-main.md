### Fixed

- **`bin/setup-github` pushes `main`, whatever branch is checked out.** It created the repository with
  `gh repo create --push`, which sends the current branch: run from a feature branch, that branch became the default
  and took main's ruleset, and `main` was not on GitHub.
- **A CRM CLI made from a config lists people and companies live when their entity names a `search`.**
  `scripts/from-config.ts` wrote `LIVE` with users only, so a CLI with a people search had to mount `people list` and
  `organizations list` by hand.
