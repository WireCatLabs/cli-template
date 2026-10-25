# Security

What WireCat CLIs share — the keyring, permissions, MCP and what never reaches a log — is on the
[shared security page](https://wirecat.dev/en/docs/security). This page keeps only what is particular to `clidev`.

`clidev` keeps its settings in `config.json` and its state in the folders `clidev doctor` shows. It sends nothing
to any service yet.

`config.json` is saved readable by you only (`0600`), and its folder is created for you only (`0700`). A file or
folder made by an older version may be open to other users of the computer: `clidev doctor` lists each under
`files.problems` and prints the `chmod` that fixes it. Windows is not checked. Report a vulnerability as [SECURITY.md](https://github.com/WireCatLabs/clidev-cli/blob/main/SECURITY.md)
says.
