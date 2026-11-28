# Install

Get `clidev` working on your computer in a few minutes, for you and for every agent that runs there. You install it
once per computer, and one check tells you that it works.

You need Node.js 22.16 or a later 22.x, or 24 or later. Node 23 is not supported.

```sh
npm install -g @wirecat/clidev-cli
clidev --version
clidev doctor
```

`doctor` needs no network and opens no keyring. It shows the version, where settings live, the profiles that
exist, and whether other users of the computer can read the settings.

Commands that use an account start with a profile, a name you choose for that account, such as `personal`. Next:
[use it](usage.md).
