# Reference CLIs

The template has no sample code. The agent that builds a new CLI learns from the WireCat CLI closest to it, picked by
the first question of the [design interview](skills/design-interview/SKILL.md):

| Category | Learn from |
| --- | --- |
| messenger | [whatsapp-cli](https://github.com/WireCatLabs/whatsapp-cli), the handbook's worked example; then [tg-cli](https://github.com/WireCatLabs/tg-cli) and [max-cli](https://github.com/WireCatLabs/max-cli) |
| files and documents | [drive-cli](https://github.com/WireCatLabs/drive-cli) |
| meetings | [zoom-cli](https://github.com/WireCatLabs/zoom-cli) |
| notes | [cli-memo](https://github.com/WireCatLabs/cli-memo) |
| mail, calendar, other | none yet: pick the nearest one with the owner |

Until cli-core has a provider registry, a CLI made from this template is not listed as a provider of its own, and
`search` finds its records as messages.
