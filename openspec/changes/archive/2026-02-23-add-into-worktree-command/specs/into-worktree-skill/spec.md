# into-worktree-skill Specification

## ADDED Requirements

### Requirement: Command invocation and change-id resolution

The `/into-worktree` command SHALL accept an optional `change-id` argument. When provided, it SHALL use that value directly. When omitted, it SHALL infer the change-id from the current conversation context. If no change-id can be inferred, it SHALL ask the user to provide one.

#### Scenario: Explicit change-id provided

- **WHEN** the user runs `/into-worktree add-widget`
- **THEN** the command uses `add-widget` as the change-id

#### Scenario: Change-id inferred from conversation

- **WHEN** the user runs `/into-worktree` without an argument
- **AND** the conversation contains a clear change-id (e.g., from a preceding explore session)
- **THEN** the command infers and uses that change-id

#### Scenario: No change-id available

- **WHEN** the user runs `/into-worktree` without an argument
- **AND** no change-id can be inferred from conversation context
- **THEN** the command asks the user to provide a change-id before proceeding

### Requirement: Worktree creation and session entry

The command SHALL create a git worktree using Claude Code's `EnterWorktree` tool with the change-id as the worktree name, then switch the current session's working directory into it.

#### Scenario: Successful worktree creation

- **WHEN** the command has a resolved change-id
- **AND** no worktree with that name already exists
- **THEN** it captures the current repository path
- **AND** calls `EnterWorktree` with `name` set to the change-id
- **AND** the session's working directory switches to `.claude/worktrees/<change-id>/`

#### Scenario: Worktree already exists

- **WHEN** the command attempts to create a worktree
- **AND** a worktree with that name already exists at `.claude/worktrees/<change-id>/`
- **THEN** the command informs the user that the worktree already exists
- **AND** suggests starting a new Claude session from that directory instead

### Requirement: Environment file copying

After entering the worktree, the command SHALL copy `.env`, `.env.local`, and files matched by `.git/info/exclude` from the original repository into the worktree.

#### Scenario: Environment files exist in source repo

- **WHEN** the session has entered the worktree
- **AND** `.env` or `.env.local` files exist in the original repository
- **THEN** the command copies those files into the worktree root

#### Scenario: Git-excluded files exist in source repo

- **WHEN** the session has entered the worktree
- **AND** `.git/info/exclude` in the original repository matches files
- **THEN** the command copies those files into the worktree, preserving directory structure

#### Scenario: No environment files to copy

- **WHEN** the session has entered the worktree
- **AND** no `.env`, `.env.local`, or git-excluded files exist in the original repository
- **THEN** the command completes without copying any files
- **AND** does not report an error

### Requirement: Command file distribution

The `/into-worktree` command SHALL be a markdown file at `setup/.claude/commands/into-worktree.md`, distributed to users via `af setup`.

#### Scenario: Command available after setup

- **WHEN** a user runs `af setup`
- **THEN** the file `~/.claude/commands/into-worktree.md` is installed
- **AND** `/into-worktree` becomes available as a Claude Code slash command
