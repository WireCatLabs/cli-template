### Fixed

- **A CLI built from a config answers `session.missing` when its profile is not signed in**, with the same words as
  cli-core's sign-in check. Its CRM, content and tracker commands answered `auth.missing`, which no other WireCat tool
  gives, so an agent that knew one tool's answer could not read the other's. A CLI generated earlier keeps the old line
  in `src/commands/`: change it there.
