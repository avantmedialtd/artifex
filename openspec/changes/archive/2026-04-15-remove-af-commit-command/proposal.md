## Why

The `af commit` CLI command duplicates functionality that `git commit --trailer` already provides natively, and the extra abstraction layer now generates more maintenance cost than value. The three workflow slash commands that depend on it (`/commit-work`, `/complete-work`, `/work-auto`) can inline plain git invocations instead, removing a whole command surface and three spec capabilities from Artifex.

## What Changes

- **BREAKING**: Remove the `af commit` command entirely, including `af commit save` and `af commit apply`.
- **BREAKING**: Remove the `stageAllAndCommit` and `stageAllAndCommitWithTrailers` helpers from `utils/git.ts` (no other callers).
- Remove the `commit-apply.test.ts` integration test file.
- Remove the `commit` entry from the `af help` registry.
- Rewrite the `/commit-work`, `/complete-work`, and `/work-auto` bundled slash commands to use `git commit --trailer` directly instead of `af commit save`.
- Update the `commit-work-command` spec to describe the git-based commit step.
- Update `setup-command` spec scenarios that reference `af commit save` as the commit mechanism.
- Retire the `commit-command` and `commit-save-subcommand` capabilities entirely.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `commit-command`: Capability retired — the `af commit` / `af commit apply` command is removed.
- `commit-save-subcommand`: Capability retired — the `af commit save` subcommand is removed.
- `commit-work-command`: The `/commit-work` slash command no longer invokes `af commit save`; its commit step now calls `git` directly with `--trailer` arguments.
- `setup-command`: Bundled slash command references to `af commit save` are replaced with inline `git commit --trailer` invocations.

## Impact

**Code removed**

- `commands/spec.ts` — `commitForChange`, `handleCommitApply`, `parseTrailer`, `handleCommitSave` (~130 lines)
- `router.ts` — the `commit` command routing block and its imports
- `commands/help.ts` — the `commit` help entry
- `commit-apply.test.ts` — whole file
- `utils/git.ts` — `stageAllAndCommit`, `stageAllAndCommitWithTrailers`
- `utils/git.test.ts` — corresponding tests

**Workflow slash commands rewritten**

- `setup/.claude/commands/commit-work.md`
- `setup/.claude/commands/complete-work.md`
- `setup/.claude/commands/work-auto.md`

These are the OpenSpec workflow's only documented commit paths. Each rewrite must preserve the existing trailer behavior (`OpenSpec-Id=<id>`, `Issue=<key>`).

**Specs retired / modified**

- `openspec/specs/commit-command/spec.md` (removed)
- `openspec/specs/commit-save-subcommand/spec.md` (removed)
- `openspec/specs/commit-work-command/spec.md` (modified)
- `openspec/specs/setup-command/spec.md` (modified)

**User-facing impact**

Anyone who types `af commit` at the terminal will get an unknown-command error. Automated workflows that go through the bundled slash commands are unaffected — their rewritten git invocations produce byte-equivalent commit messages and trailers.
