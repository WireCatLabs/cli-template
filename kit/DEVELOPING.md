# kit — the template repository's side

What `new` and `upgrade` need from this repository. How to run them is in [README.md](README.md).

## `template.json` in this repository

The lists are in [template.json](../template.json). Their shape, cut short:

```json
{
  "files": [".github/", "bin/release", "AGENTS.md", "docs/dev/skills/"],
  "seeds": ["src/", "README.md", "docs/", "config/wirecat/"],
  "placeholders": {
    "command": "clidev", "name": "clidev-cli", "package": "@wirecat/clidev-cli", "repository": "WireCatLabs/clidev-cli"
  }
}
```

- `files` lists the template-owned files that `upgrade` replays. `seeds` lists the files copied once and never
  touched again; `config/wirecat/` goes there, because community's installer owns it. An entry ending in `/` is a
  folder. The most specific entry wins: an exact path beats a folder, a deeper folder beats a shallower one, and a
  seed wins a tie. Only listed files are copied. A listed file missing from the package stops `new`.
- `template.json` and `kit/` are never copied, whatever the lists say. The kit's tests run inside `pnpm test`, so
  the configs name `kit/`: `new` and `upgrade` drop every `"kit/…"` entry from `vitest.config.ts`, `biome.json`,
  `cspell.json`, `tsconfig*.json` and `.markdownlint-cli2.jsonc`. Do not add a kit-only workflow: `.github/` is
  template-owned and would carry it into every new CLI.
- `README.md` and `CHANGELOG.md` describe the template, so `new` writes short ones for the new CLI.
- `config/parity-groups.json` puts the template in parity groups with the published CLIs, so `scripts/audit.sh`
  compares its `commands`, `upgrade`, `config` and `skill` paths with theirs. It is in neither list, so a new CLI does
  not get it: the file replaces cli-base's `PARITY_GROUPS`, and a new CLI joins those groups instead (step 4 of
  `new`'s output).
- `docs/dev/DESIGN.md` is always a seed: it holds the CLI's interview answers.
- `package.json` is always a seed. `new` rewrites it: `name` becomes `--package`, `version` becomes `0.0.0`, and
  `repository`, `homepage` and `bugs` point at `<owner>/<name>`. It also drops every `bin`, `files` entry and script
  that points into `kit/`, and the `&& pnpm kit:…` parts of other scripts. `src/version.ts` gets `VERSION = "0.0.0"`.
- `placeholders` names the words `new` and `upgrade` replace. The command word is replaced as a whole word, so
  `clidev` changes but `clidevs` and cli-base's `cli-dev` do not. Its upper-case form changes too: `CLIDEV_HOME`
  becomes `CAL_HOME`. Followed by a colon and a space it is a key and stays: `clidev: CLIDEV` becomes `clidev: CAL`.
  `name` (`clidev-cli`) is the repository name: `skills/clidev-cli/` becomes `skills/cal-cli/`. The word `clidev`
  cannot appear in prose for any other meaning. Paths are renamed the same way: `src/bin/clidev.ts` becomes
  `src/bin/cal.ts`.
- Each template version is renamed with its own `placeholders`, so `upgrade` from 0.1.0 or 0.1.1, which used `app`,
  merges cleanly. A key missing from `placeholders` means its `app` value (`app`, `app-cli`, `@wirecat/app-cli`,
  `WireCatLabs/app-cli`): those versions left `name` out.
- The version is `package.json`'s, never a second copy.
- `AGENTS.md` can hold the block that `new` fills with the reference CLI:

  ```md
  <!-- cli-template:reference-cli:start -->
  <!-- cli-template:reference-cli:end -->
  ```

  Without the block, `new` appends one.

## What the package needs from the repository

- `"bin": { "cli-template": "kit/dist/main.js" }`, and `kit/dist` in `files`. No ignore file inside `kit/`: npm
  applies it and drops `kit/dist` from the package. npm also never packs `pnpm-lock.yaml`, so it is not a seed; the
  new CLI makes its own on `pnpm install`.
- Every template-owned file and seed in `files`. npm drops a nested `.gitignore` and any `.npmrc` when it packs.
  When it installs a package, it renames `.gitignore` to `.npmignore`. So the package ships the root `.gitignore` as
  `gitignore`, and `new` and `upgrade` read it back as `.gitignore`. The test in `kit/test/package.test.ts` runs the
  bin from a tarball installed with `npm install` to catch that.
- `kit:build` (`tsc -p kit`, then the copy to `gitignore`) run by `build`, because `bin/release` and CI pack with
  `--ignore-scripts`. Node does not strip types under `node_modules`, so the bin must be JavaScript.
- `pnpm kit:e2e` packs this repository, installs the tarball with npm, runs `new` and then `pnpm install` and
  `pnpm ci:quick` in the new CLI. It needs the network and takes a few minutes, so it is not part of `pnpm test`.
- `kit/test/**/*.test.ts` in vitest's `include`; `kit/dist` is ignored by the root `**/dist` rules of Biome and git.
