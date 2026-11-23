### Added

- **A CRM CLI from a config has `account remove`, and its sign-in refuses an account another profile holds.**
  cli-core's shared command keeps the local copy while another profile here still reads it, and `session start` of a
  second profile to the same account is refused (`session.duplicate`), as the hand-written CRM CLIs do.
  The seed's `src/commands/crm.ts` passes `account` to `addCrmCommands`, and a CRM config's `session.ts` passes
  `claim: crmAccountClaim(…)`.
