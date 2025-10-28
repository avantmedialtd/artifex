# Proposal: Add `zap versions push` Command

## Change ID
`add-versions-push-command`

## Status
Proposed

## Overview
Add a `zap versions push` command that pushes all git worktrees with branches matching the `/v\d+/` pattern to their remote repositories using force-push.

## Motivation
The `zap versions reset` command already provides a way to synchronize version worktrees to the current branch HEAD. However, after resetting these worktrees, developers need to manually push each version worktree to the remote repository. This is tedious and error-prone when managing multiple version worktrees.

The `zap versions push` command automates this workflow by:
- Identifying all version worktrees (branches matching `/v\d+/`)
- Force-pushing each worktree to its remote repository
- Providing clear feedback about success or failures

This complements the existing `versions reset` command and streamlines the workflow for maintaining synchronized version branches across local and remote repositories.

## Scope
This change adds a new subcommand to the existing `versions` command family and extends the git worktree utility functions.

### In Scope
- New `versions push` subcommand in the CLI
- Force-push all version worktrees to remote
- Stop on first failure with clear error reporting
- Success summary showing all pushed worktrees

### Out of Scope
- Uncommitted changes validation (not required per user specification)
- Upstream branch configuration verification
- Interactive confirmation before pushing
- Selective pushing (e.g., push only specific version branches)
- Non-force push options

## Affected Specifications
- **versions-push** (NEW): Specification for the `zap versions push` command

## Dependencies
- Builds on existing git worktree infrastructure from `versions-reset` spec
- Reuses existing git repository validation and worktree enumeration functions

## Success Criteria
- Command successfully force-pushes all version worktrees
- Fails fast on first error with informative error messages
- Integrates seamlessly with existing `versions reset` workflow
- All tests pass
- Documentation updated
