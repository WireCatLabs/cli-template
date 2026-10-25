# When something goes wrong

Start with the symptom, run the check, then retry the command. Keep the error code and the profile name for a
support request.

| Symptom | What to do |
| --- | --- |
| Not sure what is set up | Run `clidev personal doctor`. It reads no keyring and uses no network. |
| `clidev` is not found | Open a new terminal, and check that npm's global folder is on `PATH`. |
| "name a profile" | Put the profile first, as in `clidev personal config show`, or set `CLIDEV_PROFILE`. |
| The settings file does not read | `doctor` names the file and the error. Fix it, or move it away and set the values again. |
| A write is refused | The profile's permissions or `CLIDEV_READ_ONLY` stop it; see [settings](configuration.md#permissions). |

Never paste a token, a password or private content into a support request.
