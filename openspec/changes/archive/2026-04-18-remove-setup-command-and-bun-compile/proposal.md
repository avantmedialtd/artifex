# Proposal: Remove Setup Command and Bun Compile Pipeline

## Why

The `af setup` command exists solely to ship bundled Claude Code workflow commands (`/start-work`, `/complete-work`, `/commit-work`, `/work-auto`, `/into-worktree`, `/e2e`) into the user's `~/.claude/` directory. These workflows are now authored and distributed through the dedicated skills repository (`avantmedialtd/skills`, installed via `npx skills add`), which is purpose-built for this and handles versioning, updates, and cross-project distribution far better than an ad-hoc copy command.

With the workflow bundle gone, the `af setup` command has no reason to exist. And with nothing left to embed in the published binary, the `bun compile` pipeline — along with its manifest generator, `SETUP_FILES` plumbing, and precompile hook — also becomes dead weight. `af` already ships as a Node shim that executes TypeScript directly via Bun, so removing the compile step is a pure simplification with no user-facing change.

## What Changes

- **BREAKING**: Remove the `af setup` command and its subcommands (`--list`, `--force`). Users relying on `af setup` should migrate to `npx skills add avantmedialtd/skills`.
- **BREAKING**: Remove all Claude Code workflow commands bundled under `setup/.claude/commands/` (`start-work.md`, `complete-work.md`, `commit-work.md`, `work-auto.md`, `into-worktree.md`, `e2e.md`). Each is either migrated to the skills repo or already superseded there.
- Remove the `bun compile` pipeline: drop `compile`, `compile:all`, `compile:darwin-arm64`, `compile:darwin-x64`, `compile:linux-x64`, `compile:linux-arm64`, `compile:windows-x64`, `compile:current`, and `precompile` scripts from `package.json`.
- Remove the manifest generator (`scripts/generate-setup-manifest.ts`) and the generated manifest file (`generated/setup-manifest.ts`). Simplify `utils/resources.ts` to read `resources/copy-prompt-reporter.ts` directly from the filesystem (no binary embedding required).
- Remove `commands/setup.tsx`, `utils/setup-files.ts`, and `components/file-conflict.tsx` (used only by `af setup`).
- Remove the setup route from `router.ts` and the setup entry from `commands/help.ts`.
- Update `package.json` `files` array: drop `setup/` and `generated/`.
- Update `CLAUDE.md`: remove the "Setup Command" section and any references to compiled-mode behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `setup-command`: all requirements removed — the capability is being deleted.
- `commit-work-command`: all requirements removed — the bundled `/commit-work` command is being deleted.
- `into-worktree-skill`: all requirements removed — the bundled `/into-worktree` command is being deleted.
- `e2e-command`: remove the "Reporter copied in compiled mode" scenario; reporter extraction is now filesystem-only. Requirements around reporter copying still hold for dev/runtime usage.
- `npm-package-config`: update the published `files` whitelist to drop `setup/` and `generated/`.

## Impact

- **Code**: deletes `setup/`, `commands/setup.tsx`, `utils/setup-files.ts`, `components/file-conflict.tsx`, `scripts/generate-setup-manifest.ts`, `generated/setup-manifest.ts`. Simplifies `utils/resources.ts`. Edits `router.ts`, `commands/help.ts`, `package.json`, `CLAUDE.md`.
- **APIs**: `af setup` is removed; `af --help` no longer lists it.
- **Distribution**: the published NPM package no longer ships the `setup/` directory or the `generated/` manifest. Compiled binaries under `dist/` are no longer produced by the project's own scripts (the directory can be removed from the repo separately if desired).
- **Workflow continuity**: the five workflow commands migrate to `avantmedialtd/skills` as agent skills. Users install them via `npx skills add avantmedialtd/skills` or by copying into `~/.claude/skills/` manually. The existing `e2e-testing` skill in that repo already covers the `/e2e` command's surface.
