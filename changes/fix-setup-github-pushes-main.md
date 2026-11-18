### Fixed

- **`bin/setup-github` pushes `main`, whatever branch is checked out.** It created the repository with
  `gh repo create --push`, which sends the current branch: run from a feature branch, that branch became the default
  and took main's ruleset, and `main` was not on GitHub.
