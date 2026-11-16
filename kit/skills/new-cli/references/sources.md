<!-- cspell:words bitrix Bitrix -->

# Documents and CRM records into the store

Read this when the category is files and documents or CRM. Both go through cli-core's shared commands; the CLI writes
only the source, the part that talks to the service. `cli-dev ready` counts a contract only when its test file ran
with no test skipped.

## Documents

**Reference: notion-cli**, not drive-cli: notion-cli runs cli-core's shared commands and contracts, drive-cli predates
them. Take from drive-cli only the command tree.

- The commands: `addDocumentCommands` and its parts (`addDocumentSyncCommands`, `addDocumentSearchCommand`,
  `addDocumentCatalogCommands`, …) from `@wirecat/cli-core/documents/cli`. See notion-cli's `src/commands/library.ts`.
- The source: one `DocumentSource` (list, read, cursor, files). See notion-cli's `src/sync/source.ts`, `cursor.ts` and
  `markdown.ts`.
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
