# Proposal: Add `zap spec propose` Command

## Why
Currently, creating an OpenSpec proposal requires developers to manually invoke Claude Code with the correct flags and slash command syntax: `claude --permission-mode acceptEdits "/openspec:proposal <text>"`. This is verbose, error-prone, and requires knowledge of both the Claude CLI and OpenSpec conventions.

The existing `zap spec archive` command has proven that wrapping OpenSpec workflows in simple zap commands improves developer experience. Adding a `propose` subcommand completes the core spec lifecycle (propose → apply → archive) and makes it trivial to start new OpenSpec changes.

By providing `zap spec propose <text>`, developers can initiate spec-driven development with a memorable, simple command that integrates naturally with their existing workflow.

## What Changes
This change introduces:
1. **Propose subcommand** - A new `zap spec propose <proposal-text>` command under the existing `spec` namespace
2. Proposal text validation (required, supports multi-word input)
3. Claude Code availability checking (reuses existing infrastructure)
4. Command execution with proper flags: `claude --permission-mode acceptEdits "/openspec:proposal ..."`
5. Process output and exit code pass-through

## Impact
**User Experience:**
- Developers can run `zap spec propose Add new feature` to start a proposal
- No need to remember Claude Code flags or slash command syntax
- Multi-word proposal text works without manual quoting
- Clear error messages when proposal text is missing or Claude is not installed

**Technical:**
- Adds one new function `runSpecPropose()` in main.ts
- Extends existing spec command handler with new conditional branch
- Reuses existing `checkClaudeAvailable()` utility
- No new dependencies required

**Migration:**
- No breaking changes (net-new subcommand)
- Existing `zap spec archive` command unaffected
- Existing spec command error handling preserved

## Approach
Extend the existing spec command structure in main.ts to add a `propose` subcommand that:
- Validates proposal text is provided (args.slice(2).join(' '))
- Checks Claude Code availability using existing `checkClaudeAvailable()` function
- Constructs and executes: `claude --permission-mode acceptEdits "/openspec:proposal ${proposalText}"`
- Uses `child_process.spawn` with `stdio: 'inherit'` for seamless output pass-through
- Exits with the same status code as the Claude process

**Decisions made:**
- ✅ Reuse existing `checkClaudeAvailable()` function for consistency
- ✅ Join all args after "propose" to support multi-word proposal text
- ✅ Use same command pattern as `spec archive` for consistency
- ✅ Pass through all stdio streams for full interactivity

Alternative approaches considered:
- **Interactive wizard**: Rejected to keep command simple and composable
- **File-based input**: Rejected as less ergonomic for quick proposals
- **Direct OpenSpec scaffolding**: Rejected to leverage Claude Code's AI-assisted proposal generation

## Dependencies
- Depends on existing spec command infrastructure (from add-spec-archive-command)
- Requires Claude Code CLI in PATH (same as spec archive)
- Requires `/openspec:proposal` slash command in project

## Related Changes
- Complements `add-spec-archive-command` (already completed)
- Future: Could add `zap spec apply` and `zap spec show` commands

## Open Questions
None (all questions resolved)
