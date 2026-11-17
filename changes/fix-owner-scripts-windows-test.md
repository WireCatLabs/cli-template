### Fixed

- **The kit's test of the owner scripts runs on Windows.** It started `bin/setup-github` and `bin/live` by path,
  which Windows cannot do for a script with a shebang, and the 0.25.0 release stopped on it. It now runs them with
  `node`.
