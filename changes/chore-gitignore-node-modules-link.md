### Fixed

- A new CLI's `.gitignore` also ignores a `node_modules` that is a link, as an agent's worktree often has; `node_modules/` matched only a folder, and linear-cli#21 committed the link and broke every CI job.
