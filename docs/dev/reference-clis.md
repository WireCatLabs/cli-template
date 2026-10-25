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

A messenger CLI sets `messenger: true` in `src/identity.ts`, and `new --category messenger` writes it. Every other
category keeps the template's `messenger: false`, so the shared help, `commands` and `config` do not speak of chats,
messages and senders.

cli-core keeps a provider registry (WC-ARCH-21). A CLI whose provider is not built into cli-core calls
`registerProvider(store, { name, kind, aliases, command })` from `@wirecat/cli-core/store` on every run that opens
the shared store. `kind` is one of `messages`, `mail`, `notes`, `documents`, `meetings` or `events`. Until the CLI
has run once on a computer, `search` there leaves its accounts out and lists them under `skipped`. The reference CLIs
do not show this call: their providers are built into cli-core. The skeleton opens no store and has no provider, so
it registers nothing; the call comes with the CLI's first store code.
