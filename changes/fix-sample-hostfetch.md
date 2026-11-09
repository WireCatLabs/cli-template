### Fixed

- **The sample transport reaches only the hosts it declares.** It fell back to the global `fetch`, which reaches any
  host and which cli-base's `raw-network` lint now reports. It now sends through `hostFetch` from
  `@wirecat/cli-base/http` with the identity's `hosts`, `["comments.example.invalid"]` in the sample; an injected
  `fetch` in tests still works. Replace the host with your service's.
