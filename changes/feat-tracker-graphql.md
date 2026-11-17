### Added

- **`new --spec graphql` makes the api group from a GraphQL schema.** With `--spec-url` (or a config's `spec.from`),
  `new` asks the endpoint for its schema by introspection, as `pnpm spec:sync` does later, and `pnpm generate` makes
  one command of each query and mutation. A GraphQL schema names no sign-in, so the header the key travels in is
  `auth` in `scripts/generate.ts`.
- **A `tracker` category.** `new --from-config` with `category: "tracker"` and a `source` mounts cli-core's tracker
  commands (`sync`, `issues`, `projects`, `teams`…) over `trackerSourceFromManifest`, with a test that checks the
  source against the generated API and syncs through the CLI over a fake of the schema.

### Changed — may break callers

- **cli-core 0.697.0**, which has the tracker category, `trackerSourceFromManifest` and the
  GraphQL executor.
