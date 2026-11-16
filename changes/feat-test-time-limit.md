### Fixed

- **Every test has 15 s, not vitest's default 5 s** (`testTimeout: 15_000` in `vitest.config.ts`), so a test that
  passes on your machine does not fail on a slow CI runner; twice that failed a WireCat release. It is the limit the
  handbook's new rule WC-TEST-20 sets for every WireCat repository: a test that builds big data still runs within
  3 s on a developer machine, so shrink its data and never raise its own timeout. `vitest.config.ts` is copied only
  into a new CLI, so an existing CLI adds the line by hand.
