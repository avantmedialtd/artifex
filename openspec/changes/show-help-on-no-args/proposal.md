# Proposal: Show help page if no argument is provided

## Problem Statement

Currently, when users run `zap` without any arguments, the CLI displays "zap CLI ready" and exits. This provides minimal value to users and doesn't help them discover available commands or understand how to use the tool.

This behavior is inconsistent with standard CLI conventions where running a command without arguments typically shows help information. Users expect to see available commands and usage information when they run a CLI tool without arguments.

## Proposed Solution

Modify the CLI router to display the help page (same as `zap help`) when no arguments are provided. This will:

- Help new users discover available commands immediately
- Align with standard CLI conventions and user expectations
- Provide a better first-run experience
- Reduce the need for users to remember to run `--help` or `help`

## User Value

- **Improved discoverability**: Users can immediately see what commands are available
- **Better first-run experience**: New users don't need to guess how to get help
- **Standards compliance**: Aligns with common CLI tool behavior
- **Reduced friction**: Users don't need to remember help flags or commands

## Scope

This change modifies the CLI help system specification to require help display when no arguments are provided.

### In Scope

- Modifying the router behavior to show help when `args.length === 0`
- Updating the `cli-help-system` specification to document this requirement
- Ensuring consistent behavior across all entry points

### Out of Scope

- Changing help content format or structure
- Modifying other help-related behaviors
- Adding new commands or features

## Implementation Approach

The implementation is straightforward:

1. Update router.ts to call `handleHelp()` when no arguments are provided
2. Remove the "zap CLI ready" message behavior
3. Add tests to verify the new behavior
4. Update documentation to reflect the change

## Risks and Mitigation

**Risk**: Breaking existing automation that depends on "zap CLI ready" output
- **Likelihood**: Very low - this output provides no useful automation value
- **Mitigation**: The change aligns with standard CLI behavior; any scripts should be using specific commands

## Success Criteria

- Running `zap` with no arguments displays the help page
- Exit code remains 0 (success)
- Help output is identical to `zap help`
- All existing help functionality continues to work
- Tests pass and validate the new behavior
