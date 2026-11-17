<!-- cspell:words bitrix Bitrix -->

# Documents and CRM records into the store

Read this when the category is files and documents or CRM. Both go through cli-core's shared commands; the CLI writes
only the source, the part that talks to the service. `cli-dev ready` counts a contract only when its test file ran
with no test skipped.

## Documents

**Reference: ydisk-cli** for the wiring, drive-cli for the command tree and the words, notion-cli for a
source with a change feed. All three run cli-core's shared commands; the words follow the shared vocabulary where
drive-cli keeps older ones in its lint baseline (`files get`, `mkdir`, `trash`).

- The commands: `documentLibraryCommands` from `@wirecat/cli-core/documents/cli` mounts `folders`, `sync`,
  `status`, `documents`, `search`, `catalog` and the knowledge groups over your source, with the profile's files,
  lock, store and account check. The CLI gives the source, `ingestion`, its words, a `documents list` row and, if it
  has one, `folders browse`. See ydisk-cli's `src/commands/library.ts`. notion-cli and drive-cli predate it and
  wire the parts (`addDocumentSyncCommands`, …) themselves; do not copy their wiring.
- The source: one `DocumentSource` (list, read, change feed). A service without a change feed (Yandex Disk, WebDAV,
  S3) writes a `FeedlessDocumentSource`: each sync walks the chosen folders and reads only what changed. A service that
  addresses files by path reads the path from the file cli-core passes to `metadata`, `children` and `content`. Text
  from a downloaded file comes from cli-core's `fileText`. See ydisk-cli's `src/yandex/source.ts`, and
  notion-cli's `src/sync/source.ts` for a feed.
- The contracts, from `@wirecat/cli-core/documents/testing`: `documentSourceContract` against your source over its
  fake (notion-cli's `src/sync/source.test.ts`), and `documentCommandsContract` over the commands with
  a fake source: `fakeDocumentSource`, or a strict fake of your own as notion-cli's `src/library.test.ts` has. Fix a failing contract in the source, never by skipping
  a case.

## CRM

**Reference: bitrix24-cli.** Take its `src/commands/crm-shared.ts`, `src/config.ts`, `src/store.ts` and the shape of
`src/crm/source.ts`; leave its `src/calls/`, `src/commands/api.ts` and `src/api-keys.ts`, which are Bitrix24's own.

- The commands: `addCrmCommands` from `@wirecat/cli-core/crm/cli`, and the shared queries and CSV output it exports.
- The contracts, from `@wirecat/cli-core/crm/testing`: `crmSourceContract` over your source and its fake,
  `crmSyncContract` over the CLI's store and `crmWriteContract` for each kind the CLI writes. See bitrix24-cli's
  `src/crm/contracts.test.ts`. `CRM_TRAIT_COMBINATIONS` lists both ways a CRM reports deletions: the sync must handle
  the one your service uses. `fakeCrmSource` and `acmeScenario` are the shared fake and data.

## Both

- Read cli-core's types from `node_modules` or its `origin/main` before you write a helper: the state, locking,
  `issues`, `next` and embeddings are cli-core's.
- A gap in the shared commands is a cli-core pull request first (step 3), not code in the CLI.
