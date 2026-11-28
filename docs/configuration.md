# Settings

Set a limit, change what an agent may do, or choose which runs are kept, for one profile or for all of them. Each
change is one command, and `config show` tells you where each value came from.

Settings live in one file, `config.json`, in the folder `clidev doctor` shows. Each profile has its own part,
and `defaults` apply to every profile.

```sh
clidev personal config show
clidev personal config set limit 50
clidev personal config unset limit
```

`config show` lists each setting and where it came from: the file, a variable or the default.

## Permissions

`permissions` decides what a command may do for this profile: `allow`, `ask`, `readonly` or `deny`, per permission
key. Over MCP there is no one to ask, so `ask` lets the command run. `CLIDEV_READ_ONLY=1` refuses every write, whatever
the permissions say.

## Run records

A command that fails is kept as a run, for `clidev runs list` and `runs show`. A command you add that does its work
in `context.run` is kept when it succeeds too, unless `record` is `false` (then only failures) or it ran with
`--no-record`. `comments` and `session status --check` do their work in a run, so `--record` keeps them. `record_input` decides whether a run
keeps the words you typed; it is `true` unless you set it to `false`. Secrets are masked either way; see
[Security](security.md).
