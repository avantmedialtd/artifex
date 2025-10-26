# Proposal: Add `zap spec archive` Command

## Why

Archiving an OpenSpec change currently requires developers to manually invoke Claude Code with verbose flags and slash command syntax (`claude --permission-mode acceptEdits "/openspec:archive <spec-id>"`). This is error-prone and inconsistent with zap's goal of streamlining common development workflows.

## What Changes

- Add a new `spec` command namespace to the zap CLI
- Add an `archive` subcommand under `spec` that accepts a spec-id argument
- Implement command-line argument validation for the spec-id
- Invoke Claude Code with the correct flags and slash command syntax
- Add error handling for missing Claude Code CLI or invalid arguments
- Provide clear user feedback for success and error cases

## Impact

- **Affected specs**: `spec-archive-cli` (newly created)
- **Affected code**:
  - `main.ts` - Add `spec` command namespace and `archive` subcommand routing
  - New command handler for executing Claude Code process
  - Error handling and validation logic

## Dependencies

- Claude Code CLI must be installed and available in the user's PATH as `claude`
- The `/openspec:archive` slash command must be available in the project

## Risks and Mitigations

- **Risk**: Claude Code not installed or not in PATH
  - **Mitigation**: Provide clear error message directing user to install Claude Code
- **Risk**: Invalid spec-id provided
  - **Mitigation**: Claude Code's archive command will validate the spec-id and provide feedback

## Alternatives Considered

1. **Shell alias or function**: Users could create their own aliases, but this doesn't provide validation or error handling
2. **npm script**: Could work but would be less flexible and harder to pass arguments
3. **Full OpenSpec integration**: Could reimplement archive logic in zap, but this duplicates functionality and increases maintenance burden
