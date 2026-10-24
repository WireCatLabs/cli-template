# kit — `new` and `upgrade`

The copy tool behind `npx @wirecat/cli-template`. It is the package's `cli-template` bin
(`kit/dist/main.js`, built from `kit/src` by `tsc -p kit`). It is never copied into a new CLI.

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

The content languages go only into `DESIGN.md`. The file also holds the speech-model order a messenger definition
should use, and the warnings for languages that have no stemmer or speech model in cli-core. `new` writes no search
or model setting.

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

## `template.json` in this repository

```json
{
  "files": [".github/", "bin/release", "AGENTS.md", "docs/meta.json"],
  "seeds": ["src/", "README.md", "docs/", "config/wirecat/"],
  "placeholders": { "command": "app", "package": "@wirecat/app-cli", "repository": "WireCatLabs/app-cli" }
}
```

- `files` lists the template-owned files that `upgrade` replays. `seeds` lists the files copied once and never
  touched again; `config/wirecat/` goes there, because community's installer owns it. An entry ending in `/` is a
  folder. The most specific entry wins: an exact path beats a folder, a deeper folder beats a shallower one, and a
  seed wins a tie. Only listed files are copied. A listed file missing from the package stops `new`.
- `template.json` and `kit/` are never copied, whatever the lists say. Nothing else is filtered: a listed folder
  must hold only files a new CLI keeps. Put the template's own CI (the kit's tests, `new` for each category) in a
  workflow file the lists leave out, and keep `kit/` out of shared configs, or every new CLI inherits a broken job.
- `docs/dev/DESIGN.md` is always a seed: it holds the CLI's interview answers.
- `package.json` is always a seed. `new` rewrites it: `name` becomes `--package`, `version` becomes `0.0.0`, and
  `repository`, `homepage` and `bugs` point at `<owner>/<name>`. It also drops every `bin`, `files` entry and script
  that points into `kit/`, and the `&& pnpm kit:…` parts of other scripts. `src/version.ts` gets `VERSION = "0.0.0"`.
- `placeholders` is optional; the defaults are shown above. The command word is replaced as a whole word, so `app`
  and `app-cli` change but `application` does not. Its upper-case form changes too: `APP_HOME` becomes `CAL_HOME`.
  The word `app` cannot appear in prose for any other meaning. Paths are renamed the same way: `src/bin/app.ts`
  becomes `src/bin/cal.ts`.
- The version is `package.json`'s, never a second copy.
- `AGENTS.md` can hold the block that `new` fills with the reference CLI:

  ```md
  <!-- cli-template:reference-cli:start -->
  <!-- cli-template:reference-cli:end -->
  ```

  Without the block, `new` appends one.

## `template.json` in a CLI made from it

`new` writes this shape and `upgrade` keeps it current:

```json
{
  "template": "@wirecat/cli-template",
  "version": "0.1.0",
  "names": { "name": "cal-cli", "command": "cal", "package": "@wirecat/cal-cli", "owner": "WireCatLabs" },
  "files": { ".github/workflows/ci.yml": "<sha256 of the renamed template file at this version>" },
  "seeds": ["src/", "README.md", "docs/", "config/wirecat/"]
}
```

## What the package needs from the repository

- `"bin": { "cli-template": "kit/dist/main.js" }`, and `kit/dist` in `files`.
- Every template-owned file and seed in `files`. npm drops a nested `.gitignore` and any `.npmrc`; the test in
  `kit/test/package.test.ts` runs the bin from a real tarball to catch that.
- `kit:build` (`tsc -p kit`) run by `prepack`. Node does not strip types under `node_modules`, so the bin must be
  JavaScript.
- `kit/test/**/*.test.ts` in vitest's `include`, and `kit/dist` ignored by Biome and git.
