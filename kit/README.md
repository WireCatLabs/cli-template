# kit — `new` and `upgrade`

The copy tool behind `npx @wirecat/cli-template`. It is the package's `cli-template` bin
(`kit/dist/main.js`, built from `kit/src` by `tsc -p kit`). It is never copied into a new CLI. How the
template repository feeds it is in [DEVELOPING.md](DEVELOPING.md).

```sh
npx @wirecat/cli-template new cal-cli --command cal --package @wirecat/cal-cli --owner WireCatLabs \
  --category notes --content-lang en,ru --sign-in token --api official-docs --filters time,person \
  --never-store tokens --untrusted messages,links
npx @wirecat/cli-template upgrade --dry-run
```

## `new <name>`

`new` copies the files of its own package version into `./<name>`. It renames the placeholders, rewrites
`package.json`, runs `git init` and writes `template.json`, `docs/dev/DESIGN.md` and the reference CLI into
`AGENTS.md`. It then prints the four steps that need a person. It does not install packages, commit or push.

In a terminal it asks for every missing answer. Without a terminal, a missing answer is an error that lists the
choices. Nothing is guessed.

| Flag | Answers (several are comma-separated) |
|---|---|
| `<name>` | the folder and repository name |
| `--command` | the command word |
| `--package` | the npm package name |
| `--owner` | the GitHub owner |
| `--category` | `messenger`, `mail`, `notes`, `files`, `calendar`, `meetings` |
| `--content-lang` | language codes, several: `en,ru` |
| `--sign-in` | `oauth`, `token`, `session`, `none` |
| `--api` | `official-client`, `official-docs`, `unofficial` |
| `--filters` | several of `time`, `person`, `container`, `text`, `status` |
| `--never-store` | several of `tokens`, `codes`, `secret-links`, `content` |
| `--untrusted` | several of `messages`, `files`, `links`, `names`, or `none` alone |

Every question except the names and `--content-lang` also takes `other:<your answer>`.

`new` writes the content languages into `contentLanguages` in `src/identity.ts`; on the first run, cli-core ticks them
in advance in the search-language question, and the person confirms. `DESIGN.md` records them too, with the
speech-model order a messenger definition should use and the warnings for languages that have no stemmer or speech
model in cli-core. `new` writes no search or model setting.

## `upgrade`

Run it in a CLI made from the template, with a clean git working tree. For each template-owned file that the
template changed since the recorded version, it asks one of four things:

- **apply** merges the change with `git merge-file`. The base is the recorded version, downloaded with `npm pack`.
  "Ours" is the CLI's file and "theirs" is this version. Both template versions are renamed first, so the command
  word never conflicts.
- **replace** takes the template's file as it is.
- **skip** keeps the CLI's file. It is asked again only when the template changes that file again.
- **diff** shows the template's change.

Without a terminal, `--apply`, `--replace` or `--skip` sets the answer for every file. `--dry-run` lists what each
file would get and writes nothing. Seeds and `package.json` are never touched.

A conflict leaves git markers, and `template.json` keeps the new state under `pending`. Resolve the markers and run
`upgrade` again: it checks that the markers are gone and then moves to the new version.

## `template.json` in a CLI made from it

`new` writes this shape and `upgrade` keeps it current. `files` has one entry per template-owned file, and `seeds`
is the template's whole list; both are cut short here:

```json
{
  "template": "@wirecat/cli-template",
  "version": "0.1.0",
  "names": { "name": "cal-cli", "command": "cal", "package": "@wirecat/cal-cli", "owner": "WireCatLabs" },
  "files": { ".github/workflows/ci.yml": "<sha256 of the renamed template file at this version>" },
  "seeds": ["src/", "README.md", "docs/", "config/wirecat/"]
}
```
