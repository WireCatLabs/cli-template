### Fixed

- **The README describes the kit.** The GitHub and npm page opened with the placeholder `clidev` and explained
  nothing about the template. It now leads with the CLI and MCP server you get from `new`, a quick start, a comparison with other
  tools and what the template does not do. Its banner is rendered from `kit/images/src/banner.html` by
  `pnpm kit:images`, which also renders the GIF from `kit/images/src/new.tape` once VHS can run.
