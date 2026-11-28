# When something goes wrong

A command stopped with an error, the terminal says `clidev` is not found, or the agent says it may not change
something. Most of these take one step to fix, and the error message names that step.

Run the command again with `--json` to see the error's code, such as `configuration_error`. Keep the code and the
profile name for a support request.

**On this page:**

1. [What happened](#what-happened)
2. [Ways to fix it](#ways-to-fix-it)
3. [Check that it is fixed](#check-that-it-is-fixed)
4. [Error codes](#error-codes)

## What happened

- **The terminal cannot find `clidev`.** npm put it in a folder that this terminal does not search yet.
- **The command asks you to name a profile.** A profile is a name you choose for one account, and a command that uses
  an account never guesses one.
- **The settings file has a mistake**, or other users of the computer can read it.
- **A change is refused.** The profile's permissions, or `CLIDEV_READ_ONLY`, do not allow it.
- **The service refuses the request.** The sign-in is missing or has ended.

## Ways to fix it

Start with the first row. `clidev doctor` reads no keyring and uses no network, so it is safe to run at any time.

| What you see | What to do |
| --- | --- |
| Not sure what is set up | Run `clidev doctor`. It shows the version, the profiles and every problem it finds. |
| `clidev` is not found | Open a new terminal. If that does not help, check that npm's global folder is on `PATH`. |
| "name a profile" | Put the profile first, as in `clidev personal config show`, or set `CLIDEV_PROFILE=personal`. |
| `doctor` lists `config.issues` | Run the `config unset` that each issue gives, or fix `config.json` by hand. |
| `doctor` lists `files.problems` | Run each `chmod` that `doctor` prints after "to make it private:". `doctor` never changes a file mode itself. |
| A write is refused | Change the profile's permissions, or unset `CLIDEV_READ_ONLY`. See [settings](configuration.md#permissions). |
| The error says to sign in | Run the sign-in command that the error names, then the command again. |

## Check that it is fixed

Run `clidev doctor` again, then the command that failed. When both work, you are done.

If it still fails, [open an issue](https://github.com/WireCatLabs/clidev-cli/issues) with the error code, the
profile name and what you ran. Never paste a token, a password or private content into it.

## Error codes

With `--json`, an error is one JSON value on stderr, with a code to branch on. The
[command reference](commands.md#exit-codes) lists every code with its exit code.
