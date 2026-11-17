### Fixed

- **A new CLI's family audit no longer blocks on a schema its published neighbours disagree on.** cli-base 0.114.0
  keeps cli-base's accepted entity and reason differences in the audit by a CLI's own `config/parity-groups.json`,
  and does not block a CLI on a schema a published CLI shares with it. A CRM CLI from `new --from-config` failed
  `cli-dev ready` on `entity hit`, which half the family prints from an older cli-core.
