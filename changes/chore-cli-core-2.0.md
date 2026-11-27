### Changed — may break callers

- **Built on cli-core 2.0.0 and cli-base 1.1.0.** A new CLI starts on cli-core 2.0, which moves the shared message
  store to version 78: an agent is `agent` and `agent:<id>`, and a sender bot is `bot:<id>`. Tools on cli-core 1.x
  refuse that store, so a CLI made from the template moves with every other WireCat CLI.
