### Added

- **A new CLI's README says that over MCP `ask` does not ask.** A CLI with an api group gets one paragraph beside
  the MCP setup: the agent runs the API's writes and deletes, each one is kept in `runs list`, and
  `config set permissions.api readonly` or `permissions.api.<operation> deny` stops them for a profile.
