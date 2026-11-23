### Fixed

- **A CRM CLI from a config checks its source against the generated API in CI.** `pnpm source:check` did it only when
  someone ran it by hand, so a config that reads an operation or path the API lacks passed CI. The seed's
  `crm-contracts.test.ts` now runs the same check.
