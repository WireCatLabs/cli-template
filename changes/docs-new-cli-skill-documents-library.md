### Fixed

- **The new-cli skill points a documents CLI at cli-core's `documentLibraryCommands`** and at yandex-disk-cli as the
  reference for its wiring, with drive-cli for the command tree and notion-cli for a source with a change feed. It
  said drive-cli predates the shared commands; drive-cli runs them now. It also names `FeedlessDocumentSource` and
  `fileText` ([sources](../kit/skills/new-cli/references/sources.md)).
- **Coverage leaves out `src/generated/`.** A CLI made with `new --spec` failed its coverage thresholds on the
  generated schemas, which `src/api.test.ts` already sends every operation through.
