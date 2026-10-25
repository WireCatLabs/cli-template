---
name: release
description: Prepare a release of this CLI for the owner to publish — run release:check, write the changelog under the handbook's headings, check the docs against what changed, raise the version in a pull request; the owner runs bin/release. Use when asked to release, prepare a release, cut a version, «выпуск», «выпустить версию».
---

# Release

The rules are the handbook's [Releases page](../../../../node_modules/@wirecat/cli-base/docs/standards/releases.md)
(`WC-REL-<n>`), which wins over this skill. An agent prepares the release; the owner merges the release pull request
and runs `bin/release`.

1. **What changed.** In a worktree off `origin/main`: `git log --oneline v<last version>..origin/main`. The
   `docs/commands.md` diff shows what a cli-core or cli-base release changed in the commands.
2. **The checks.** `pnpm release:check`. Before the version is raised, only the changelog's `## Unreleased` may be
   left; report anything else and fix it in the release pull request.
3. **The changelog.** Write `## Unreleased` under the handbook's headings, each at most once: `Added`,
   `Changed — may break callers`, `Fixed`, `Security`, `Removed` (`WC-DOC-14` to `WC-DOC-18`). No internal ids.
4. **The docs.** `README.md`, `docs/*.md` and `skills/clidev-cli/SKILL.md` state what the code does now (`WC-DOC-3`).
   `pnpm generate` and `pnpm test:matrix` rewrite the generated pages (`WC-DOC-4`).
5. **The version.** `npm view @wirecat/clidev-cli version` is what is published. Set the next version in
   `package.json`, run `pnpm version:sync`, date the section as `## <version> — DD.MM.YYYY`, run
   `pnpm release:check` again, and open the pull request `chore(release): <version>`.
6. **The owner** merges it and runs `bin/release` on a clean `main`. `bin/release --local` publishes from this
   computer when GitHub Actions cannot, with the owner's own npm login or `NPM_TOKEN`.
