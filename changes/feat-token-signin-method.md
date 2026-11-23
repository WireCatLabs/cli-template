### Added

- **A new CLI with a token sign-in tells WireCat Desktop how to sign it in.** `src/identity.ts` declares the token
  method (`session start --json`, the token on stdin) under `signIn.methods`, so `--wcat-describe` carries it and
  Desktop asks for the token in its own window, with no change to Desktop. Before, a new CLI added to Desktop by its
  npm name could sign in only in a terminal. `clidev new` writes it only for `--sign-in token`.
