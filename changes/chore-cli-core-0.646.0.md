### Changed — may break callers

- **Built on cli-core 0.646.0** (was 0.624.0): `doctor reports show` and `doctor reports create` write a problem
  report to send, and a paged answer now reads `hasMore` from the service. What changed is in
  [cli-core's changelog](https://github.com/WireCatLabs/cli-core/blob/main/CHANGELOG.md).
