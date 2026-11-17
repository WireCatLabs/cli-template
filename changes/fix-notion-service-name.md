### Fixed

- **A CLI made from an OpenAPI description names the service without a trailing "API".** Notion's description is
  titled "Notion API", and `api --help`, `api list`, the README, the skill and the MCP texts said "the raw Notion API
  API". `new` now takes "Notion" as the service's name; the download line still shows the description's own title.
- **The sign-in, the MCP server and an offline refusal name the real service, not the sample's.** `session --help`
  said "keep this profile's Example Comments token" in a CLI made for Notion. The CLI's service name is now `SERVICE`
  in `src/identity.ts`, and `new` writes the service's name there; the sample's `comments` group and its transport
  keep "Example Comments".
- **A required parameter with a default needs no flag.** With cli-core 0.696.0, Notion's page-markdown calls
  send `Notion-Version: 2026-03-11` by themselves instead of stopping with `required option '--notion-version
  <value>' not specified`. The generated `src/api.test.ts` leaves such a parameter out, so it checks this.
- **A CLI made from a description without sign-in typechecks again.** PokeAPI's manifest has no `securitySchemes`,
  and the generated `src/api.test.ts` read it, so `pnpm bootstrap` stopped at `ci:quick`.
- **The docs and the skill of a CLI made with `--spec-url` say its `api` group reaches the service.** They said its
  one service was the sample.

### Changed — may break callers

- **With cli-base 0.116.0, `GET /v1/users/me` is `users-me-get`, not `users-me-list`.** A path ending in `/me`
  reads one item. A CLI generated before keeps its names until it regenerates.
- **A new CLI pins `@wirecat/cli-core` 0.696.0 and `@wirecat/cli-base` 0.116.0**, which carry the two fixes above.
