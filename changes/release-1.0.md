### Changed — may break callers

- **Built on cli-core 1.0 and cli-base 1.0.** A new CLI's generated API files read their types from
  `@wirecat/cli-base/codegen/runtime`, the WordPress seed's `spec-model.ts` uses `ModelOverride`, and the GraphQL seed's
  test takes `SchemaNode` from `/codegen/runtime`. A CLI from a WordPress config also tests that a sync which would
  mark every post deleted stays held, with `--rescan` too, until `--allow-deletions` names the count.
