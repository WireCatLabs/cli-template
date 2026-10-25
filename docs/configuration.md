# Settings

Settings live in one file, `config.json`, in the folder `clidev doctor` shows. Each profile has its own part,
and `defaults` apply to every profile. This page lists how to see and change them.

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
