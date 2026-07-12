# Contributing

This repo's coding conventions live in [AGENTS.md](./AGENTS.md) (Angular 22 + TypeScript best practices, accessibility, testing, commit format) — read that first. This file covers the parts specific to human contributors.

## Setup

```bash
yarn install
yarn start   # dev server
```

Package manager is **yarn** only — a `preinstall` guard blocks `npm`/`pnpm`.

## Before opening a PR

```bash
yarn lint
yarn test
yarn build
```

All three must pass. Tests follow TDD (red-green-refactor) and must keep coverage at or above the thresholds set in `angular.json` (80% statements/functions/lines, 75% branches).

## Commits

Conventional Commits only — see the format rules in [AGENTS.md](./AGENTS.md#commit-message-format). A `commit-msg` hook (Husky + commitlint) rejects non-compliant messages automatically, and a `pre-commit` hook lints/formats staged files.

## Scaffolding

Use `yarn ng generate` for new components/services/etc. rather than hand-writing files — it applies this workspace's schematics (including ESLint) automatically.
