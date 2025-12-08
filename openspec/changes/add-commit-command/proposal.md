# Proposal: Add Commit Command for OpenSpec Changes

## Why

When working on OpenSpec changes, developers frequently need to commit their implementation progress with a descriptive commit message that references the change title. Currently, this requires manually extracting the title from `proposal.md` and formatting the commit message. A dedicated `zap commit apply` command would automate this workflow, matching the existing `archive` and `apply` commands which also handle change selection interactively.

## What Changes

- Add `commit` as a new top-level command namespace with an `apply` subcommand
- Add shorthand `commit` command (equivalent to `commit apply`)
- The command commits all staged/unstaged changes with the message format: `Apply: <Change Title>`
- When no change-id is provided:
  - 0 changes: Show error message
  - 1 change: Auto-select it
  - Multiple changes: Show interactive selection menu
- Follow the same pattern as `spec archive` and `spec apply` for consistency

## Impact

- Affected specs: New spec `commit-command`
- Affected code:
  - `router.ts` - Add routing for `commit apply` and `commit` shorthand
  - `commands/spec.ts` - Add `handleCommitApply` function (or new file `commands/commit.ts`)
  - `commands/help.ts` - Add help content for new commands
  - `utils/git.ts` - May need `stageAllAndCommit` utility
