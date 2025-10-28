# Proposal: Add `apply` command to apply OpenSpec changes

## Why

Currently, the zap CLI provides commands to create proposals (`propose`) and archive completed changes (`archive`), but lacks a command to apply approved changes. Users must manually invoke Claude Code with the correct flags and slash command syntax: `claude --permission-mode acceptEdits "/openspec:apply [change-id]"`. This is verbose, error-prone, and requires knowledge of both the Claude CLI and OpenSpec conventions.

The existing `zap spec propose` and `zap spec archive` commands have proven that wrapping OpenSpec workflows in simple zap commands improves developer experience. Adding an `apply` command completes the core spec lifecycle (propose → apply → archive) and makes it trivial to implement approved OpenSpec changes.

By providing `zap apply [change-id]`, developers can execute the application workflow with a memorable, simple command that integrates naturally with their existing workflow, whether providing a specific change-id or letting Claude Code prompt interactively.

## What Changes

This change introduces:

1. **Apply subcommand** - A new `zap spec apply [change-id]` command under the existing `spec` namespace
2. **Apply shorthand** - A top-level `zap apply [change-id]` shorthand command
3. Optional change-id argument (Claude Code prompts if omitted)
4. Claude Code availability checking (reuses existing infrastructure)
5. Command execution with proper flags: `claude --permission-mode acceptEdits "/openspec:apply [change-id]"`
6. Process output and exit code pass-through
7. Help system updates to document the new command

## Impact

**User Experience:**

- Developers can run `zap apply my-change-id` to apply a specific change
- Or run `zap apply` to let Claude Code prompt for change selection
- No need to remember Claude Code flags or slash command syntax
- Clear error messages when Claude is not installed
- Consistent with existing `propose` and `archive` commands

**Technical:**

- Adds `handleSpecApply()` function in commands/spec.ts
- Extends router.ts with apply routing for both namespace and shorthand forms
- Updates commands/help.ts with apply documentation
- Reuses existing `checkClaudeAvailable()` utility
- No new dependencies required

**Migration:**

- No breaking changes (net-new command)
- All existing commands continue to work unchanged
- Pure additive change to the CLI

## Approach

Extend the existing spec command structure to add an `apply` subcommand that:

- Accepts an optional change-id argument from `args[2]` for namespace form or `args[1]` for shorthand
- Checks Claude Code availability using existing `checkClaudeAvailable()` function
- Constructs command: `claude --permission-mode acceptEdits "/openspec:apply [change-id]"` (omits change-id if not provided)
- Uses `child_process.spawn` with `stdio: 'inherit'` for seamless output pass-through
- Exits with the same status code as the Claude process

**Decisions made:**

- ✅ Reuse existing `checkClaudeAvailable()` function for consistency
- ✅ Make change-id optional to support interactive selection via Claude Code
- ✅ Follow same command pattern as `propose` and `archive` for consistency
- ✅ Provide both namespace (`spec apply`) and shorthand (`apply`) forms
- ✅ Pass through all stdio streams for full interactivity

Alternative approaches considered:

- **Required change-id**: Rejected to enable interactive workflow when change-id is unknown
- **Interactive selection in zap**: Rejected to leverage Claude Code's superior selection UI
- **List-based selection**: Rejected as less ergonomic than Claude Code's interface

## Dependencies

- Depends on existing spec command infrastructure
- Requires Claude Code CLI in PATH (same as propose and archive)
- Requires `/openspec:apply` slash command in project

## Related Changes

- Builds on `add-spec-archive-command` (archived)
- Builds on `add-spec-propose-command` (archived)
- Builds on `add-propose-shorthand` (archived)
- Builds on `add-archive-shorthand` (archived)
- Completes the OpenSpec command trilogy (propose, apply, archive)

## Open Questions

None (all questions resolved)
