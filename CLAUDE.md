# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A TypeScript GitHub Action that runs [dependency-tree-diff](https://github.com/JakeWharton/dependency-tree-diff) against a PR to report Gradle dependency changes. Based on the [actions/typescript-action](https://github.com/actions/typescript-action) template. ESM throughout (`"type": "module"`; internal imports use `.js` extensions even in `.ts` files).

## Commands

```shell
npm test                     # Run all tests (jest + ts-jest, tests in __tests__/)
npx jest __tests__/diff.test.ts   # Run a single test file
npm run lint                 # ESLint
npm run format:write         # Prettier
npm run bundle               # format + rollup bundle to dist/
npm run all                  # format + lint + test + coverage badge + package
npm run local-action         # Run the action locally via @github/local-action (needs .env)
```

**Important: `dist/` is committed.** The action executes `dist/index.js` directly. Any change under `src/` must be followed by `npm run bundle`, and the updated `dist/` must be committed — the `check-dist.yml` CI workflow fails otherwise.

Releases are tagged with `script/release` (interactive; maintains the floating major tag, e.g. `v1`).

## Architecture

Entry point is `src/index.ts` → `src/main.ts` `run()`, which orchestrates the whole flow:

1. Read inputs (defined in `action.yml`; keep `getInputs()` in `main.ts` and the README config table in sync when adding inputs).
2. Shallow-clone the PR base branch into a temp dir (`getGitUrl`/`cloneBaseRepository` — handles token auth and rewrites SSH submodule URLs to HTTPS).
3. Download the dependency-tree-diff jar (`diff.ts`).
4. For each configuration: run `./gradlew clean dependencyReport` in both the workspace (head) and the base clone (`gradle.ts`), glob the generated `**/build/reports/project/dependencies.txt` files, and diff head vs base per project with the jar (`diff.ts`). Multi-project builds are supported by matching each head report file to the same relative path in the base clone.
5. Report results (`reporter.ts`): GitHub Checks (split into multiple checks when over the 65,535-char limit, truncated per project if a single diff exceeds it), optional PR comment / PR body update / label / HTML report artifact (diff2html). A `custom-endpoint-url` input can replace Checks with a POST to an external server (experimental).

`octokitHelper.ts` wraps all Octokit calls into a thin interface — tests mock this layer rather than Octokit itself. Shared types and constants live in `types.ts`.

Tests mock `@actions/*` modules and file/exec boundaries; `main.ts`, `diff.ts` export several internal functions marked `// export for testing`.
