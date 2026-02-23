# Add /into-worktree Skill

## Why

OpenSpec changes worked on the main branch leave unfinished artifacts in `openspec/changes/` when work is paused or abandoned. Moving change work into isolated git worktrees keeps the main branch clean, but currently there's no Claude Code skill to create a worktree from the change-id and enter it in a single step.

## What Changes

- Add a `/into-worktree [change-id]` Claude Code skill that creates a `.claude/worktrees/<change-id>/` worktree and enters it
- The skill uses Claude Code's `EnterWorktree` tool to create the worktree and switch the session's working directory
- After entering the worktree, copies `.env` and git-excluded files from the main repo (reusing existing `getFilesToCopy`/`copyFileToWorktree` logic)
- `change-id` is optional — inferred from conversation context when omitted (e.g., during `/opsx:explore` sessions)

## Capabilities

### New Capabilities

- `into-worktree-skill`: Claude Code skill that creates and enters a worktree named after an OpenSpec change-id, with env file copying

### Modified Capabilities

None

## Impact

- New skill file under `setup/.claude/skills/` (or equivalent skill location)
- Depends on existing worktree utilities in `commands/worktree.ts` and `git-worktree.ts` for file copying logic
- No changes to existing commands or APIs
- Users must merge worktree branches back to main manually when work is complete
