# Proposal: Add Worktree Reset Command

## Why

Developers need to reset individual worktrees to the current HEAD revision, similar to `af versions reset` but without the `/v\d+/` branch pattern filter. This enables quick synchronization of any worktree to match the main working directory's state.

## What Changes

- Add `af worktree reset [name]` subcommand to the existing worktree command
- Support resetting current worktree when no name is provided
- Support resetting a named worktree when name is specified
- Check for uncommitted changes before reset (safety guard)
- Use `git reset --hard` to synchronize to current HEAD

## Impact

- Affected specs: New `worktree-reset` capability
- Affected code: `commands/worktree.ts`, `commands/help.ts`
- Reuses existing utilities from `git-worktree.ts`
