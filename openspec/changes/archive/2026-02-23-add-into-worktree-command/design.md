## Context

Claude Code sessions have a fixed working directory that can only be changed via the `EnterWorktree` tool. This tool creates a git worktree under `.claude/worktrees/<name>/` and switches the session into it. Artifex already has worktree utilities (`commands/worktree.ts`, `git-worktree.ts`) that handle env file copying and git-excluded file discovery, but these create sibling worktrees and don't integrate with Claude Code's session switching.

The `/into-worktree` command bridges these: it uses `EnterWorktree` for session switching and then copies environment files that `EnterWorktree` doesn't handle.

## Goals / Non-Goals

**Goals:**

- Single command to create a worktree and enter it, named after an OpenSpec change-id
- Copy `.env` and git-excluded files into the new worktree automatically
- Optional change-id argument with inference from conversation context

**Non-Goals:**

- Re-entering existing worktrees across sessions (handled by starting Claude from the worktree directory)
- Merge strategy back to main (user's responsibility)
- Modifying the existing `af worktree new` command or `EnterWorktree` behavior
- Worktree cleanup or removal automation

## Decisions

### Command file location: `setup/.claude/commands/into-worktree.md`

Claude Code commands are markdown prompt files. The `/into-worktree` command lives in `setup/.claude/commands/` so it's distributed via `af setup` alongside other workflow commands like `/start-work` and `/commit-work`.

**Alternative considered**: A skill (`setup/.claude/skills/`). Skills are for complex, multi-tool capabilities with templates and state. This is a single sequential action — a command is the right fit.

### Env file copying via Bash after EnterWorktree

The command instructs Claude to:
1. Capture the current repo path before entering the worktree
2. Call `EnterWorktree` with the change-id as name
3. Use Bash to copy `.env`, `.env.local`, and git-excluded files from the original repo path

This reuses the logic from `af worktree new` conceptually but executes it as Bash commands rather than calling the TypeScript utility directly, since Claude Code commands operate through tool calls not CLI invocations.

**Alternative considered**: Having the command call `af worktree new` first, then `EnterWorktree`. This fails because `EnterWorktree` always creates a new worktree — it can't enter an existing one.

### Change-id inference from conversation context

When no argument is provided, the command prompt instructs Claude to look for a change-id in the current conversation (e.g., from a preceding `/opsx:explore` session or discussion). If no change-id can be inferred, it asks the user. This is natural language inference, not programmatic detection.

## Risks / Trade-offs

**EnterWorktree creates in `.claude/worktrees/`, not as sibling directories** — Worktrees are less visible than siblings. Users can run `git worktree list` to find them. This is a constraint of Claude Code's session switching mechanism.

**No programmatic env file discovery** — The command copies files via Bash rather than using `getFilesToCopy()` from the TypeScript utilities. The command would hardcode `.env` and `.env.local` and use `git ls-files --others --ignored --exclude-from=.git/info/exclude` for git-excluded files. If the utility logic changes, the command prompt needs manual updating. Acceptable given the simplicity of the operation.

**Single-session only** — `EnterWorktree` creates a new worktree each time. Returning to an existing worktree in a new session requires starting Claude from that directory directly (e.g., via tmux). This is a known limitation accepted in the proposal.
