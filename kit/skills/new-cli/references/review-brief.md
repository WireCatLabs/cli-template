# The reviewer's brief

Give a **fresh agent** this brief for each slice, filled in. It gets the code and the plan, never your summary or
your conclusions: a reviewer told what you found tends to find it again.

```text
Review slice <n> of <cli> (pull request <url>, branch <branch>, worktree <absolute path>). Read only; change nothing.

Read first:
- the WireCat CLI standards: node_modules/@wirecat/cli-base/docs/standards/README.md, and new-cli.md whole;
- the plan: <absolute path to plan.md>, the slice's section;
- the public exports of cli-core and cli-base: their package.json exports and the .d.ts files in node_modules;
- the reference CLI's source: <reference CLI path>;
- the builder's report: <absolute path, or pasted below>.

Answer each item with a file:line, or say it holds:
1. The review questions in new-cli.md → Done when.
2. The builder's report, claim by claim: does the code do what the report says? A claim with no code behind it is a
   finding.
3. Parity: each command, option, --json field and error reason against the reference CLI's for the same thing. A
   difference without a reason in plan.md is a finding.
4. Reuse: each function longer than a few lines that cli-core, cli-base or another CLI already has.
5. Security: secrets (argv, output, logs, the store), untrusted text marked, hosts limited, what reaches the store.
6. Tests: does each test fail when the code it covers breaks? A test that cannot fail is a finding.

Report findings first, most serious first, each with its file:line and the fix you propose. Then what you checked and
found sound.
```

The builder fixes each finding or writes in the pull request why not. A second round goes to a fresh agent again.
