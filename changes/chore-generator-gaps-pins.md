### Fixed

- **`new --spec-url` makes a CLI from Resend's and Petstore 3's public specs that generates, builds and passes its
  tests.** cli-base now reads OpenAPI 3.1 fields of several types and uploads sent as bytes, and cli-core sends an
  upload from `--body-file <path>`. Each operation's test sends its upload from a small file.
- **The `api` test's fake checks the sign-in each operation's own security names, else the spec's.** It takes the
  manifest's `security`, `securitySchemes` and the profile's token, so an `api_key` header, a bearer token and an
  open call each pass where the spec says; the copy of the spec's `security` onto each operation is gone.
- **A CLI made with `--sign-in none` sends no token from its `api` group**, and its test's fake expects none. Before,
  every `api` call stopped on the missing sign-in.
- **The `api` group, its skill pages and its tests leave out an operation cli-core cannot send**, such as a
  multipart upload, as they already left out one that answers with a credential.

### Changed — may break callers

- **cli-core 0.694.0.** A CLI whose spec names no sign-in now sends no token: generate with `auth`
  to name it (see the SAMPLE comment in `scripts/generate.ts`).
