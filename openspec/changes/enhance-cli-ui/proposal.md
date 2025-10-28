# Proposal: Enhance CLI UI and Code Structure

## Summary

Enhance the zap CLI with improved user experience through better help documentation, error messages, and output formatting, while refactoring the monolithic main.ts into a modular command structure for better maintainability.

## Why

Currently, the zap CLI has several usability and maintainability issues:

1. **No help system**: Users cannot discover available commands or get usage information
2. **Monolithic structure**: All command logic is in a single 370-line main.ts file, making it hard to maintain and test
3. **Inconsistent output**: Mix of console.log and console.error without visual formatting or hierarchy
4. **Basic error messages**: Error messages lack context and visual emphasis

These issues make the CLI harder to use for new users and harder to extend for developers.

## Goals

1. **Help System**: Add `zap help` and command-specific help to make the CLI self-documenting
2. **Modular Architecture**: Split main.ts into separate command modules for better organization
3. **Consistent Output**: Implement a unified output system with colors and formatting
4. **Better Error Messages**: Improve error messages with context and visual emphasis

## Non-Goals

- Adding new commands (this is purely about improving existing functionality)
- Changing command behavior or arguments
- Adding external UI libraries (use built-in terminal capabilities)
- Breaking changes to existing command interfaces

## Alternatives Considered

### Use a CLI framework (e.g., Commander, Yargs)
**Rejected**: Adds external dependencies and complexity. The current routing is simple enough that a framework isn't needed, we just need better organization.

### Add a full-featured terminal UI library
**Rejected**: Too heavy for our needs. Simple ANSI colors and basic formatting are sufficient.

## Open Questions

None at this time. The scope is well-defined and implementation approach is straightforward.

## Related Changes

This change modifies the existing CLI structure but maintains backward compatibility with all existing commands and their specifications:
- cli-executable
- cli-command-shortcuts
- dependency-upgrade
- spec-archive-cli
- spec-propose-cli
- versions-push
- versions-reset
