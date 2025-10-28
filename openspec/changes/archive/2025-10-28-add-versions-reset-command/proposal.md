# Proposal: Add `zap versions reset` Command

## Why

Developers working with git worktrees often need to synchronize multiple version branches (v1, v2, v3, etc.) to match the current state of the main development branch. Manually resetting each worktree is tedious and error-prone.

## What Changes

- Add new `versions` top-level command with `reset` subcommand
- Implement git worktree enumeration to find branches matching `/v\d+/` pattern
- Add git status checking to detect uncommitted changes in worktrees
- Add git reset functionality to sync worktrees to current branch revision
- Provide clear error messages when worktrees have uncommitted changes

## Impact

- **Affected specs**: `versions-reset` (new capability)
- **Affected code**: `main.ts` (new command routing), new implementation file for git operations
- **Dependencies**: Uses existing Node.js child_process for git commands
- **User-facing**: New CLI command `zap versions reset`
