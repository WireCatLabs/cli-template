### Changed — may break callers

- **A new CLI pins `@wirecat/cli-core` 0.698.0 and `@wirecat/cli-base` 0.117.0.** cli-base's command vocabulary has
  the tracker's nouns and cli-core's tracker commands follow it, so a tracker CLI from `new --from-config` passes
  `pnpm lint:commands`. cli-base also knows a Basic sign-in.
