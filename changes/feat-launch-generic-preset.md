### Added

- **`new --preset generic` for a CLI outside WireCat.** It needs only the name and `--owner`: the command word is the
  name without `-cli`, the package `@<owner>/<name>`, and the questions only WireCat's store, search and Desktop need
  get neutral answers. Any flag given wins, and a `@wirecat/` package is refused. `template.json` records the preset,
  and `bin/release` and `release-start.yml` then need no recorded live check
  ([kit reference](../kit/README.md#new-name)).
- **An agent skill for building a CLI from an API description**, installed with `npx skills add
  WireCatLabs/cli-template` ([SKILL.md](../SKILL.md)), without WireCat's own repositories and reviews.
- **The README opens with a demo GIF**: `new --spec-url` on PokeAPI's description, 102 commands, a real call and
  `mcp check`. `pnpm kit:images --gif --local` renders it from this checkout and shrinks it with gifsicle.- **A new CLI's README follows tg-cli's order**: the gains, what you get and why, then the quick start and the agent
  setup, as cli-base's README rule asks.

### Fixed

- **A CLI made with `--sign-in none` has no sign-in check in its MCP command**, so `mcp check` reports it healthy
  instead of waiting for an account it never needs.
