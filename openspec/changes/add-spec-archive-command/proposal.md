# Proposal: Add `zap spec archive` Command

## Summary
Add a new CLI command `zap spec archive <spec-id>` that provides a convenient wrapper for invoking Claude Code's OpenSpec archive workflow. This command will execute `claude --permission-mode acceptEdits "/openspec:archive <spec-id>"` to streamline the process of archiving deployed OpenSpec changes.

## Motivation
Currently, archiving an OpenSpec change requires developers to manually invoke Claude Code with the correct flags and slash command syntax. This is verbose and error-prone. By adding a `zap spec archive` command, developers can archive specs with a simpler, more memorable command that integrates naturally with the zap CLI.

## Benefits
- **Improved developer experience**: Shorter, clearer command syntax
- **Reduced errors**: No need to remember Claude Code flags or slash command syntax
- **Consistency**: Aligns with zap's goal of streamlining common development workflows
- **Foundation for future spec commands**: Establishes the `zap spec` namespace for future OpenSpec-related utilities

## Scope
This proposal adds:
1. A new `spec` command to the zap CLI
2. An `archive` subcommand under `spec`
3. Command-line argument validation for spec-id
4. Execution of the Claude Code command with proper arguments
5. Error handling and user feedback

## Out of Scope
- Other spec-related commands (propose, apply, etc.) - these can be added in future proposals
- GUI or interactive mode - this is a CLI-only feature
- Windows-specific command wrapper - relies on Claude Code being available in PATH

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
