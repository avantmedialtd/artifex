# Implementation Tasks

## Overview
This task list implements the `zap spec propose <proposal-text>` command by adding command parsing, argument handling, Claude Code invocation, and appropriate error handling.

## Tasks

- [x] **Add propose subcommand handler in main.ts**
  - Add conditional branch for `subcommand === 'propose'` in the spec command handler
  - Extract proposal text from remaining args (args.slice(2))
  - Call new `runSpecPropose(proposalText: string)` function
  - **Validates**: Developer can run `zap spec propose` and appropriate handler is invoked
  - **Depends on**: None (extends existing spec command infrastructure)

- [x] **Implement runSpecPropose function**
  - Create `runSpecPropose(proposalText: string)` function in main.ts
  - Validate that proposalText argument is provided (error if missing/empty)
  - Reuse existing `checkClaudeAvailable()` function to verify Claude is installed
  - Build the claude command: `claude --permission-mode acceptEdits "/openspec:proposal ${proposalText}"`
  - Use `child_process.spawn` to execute the command
  - Pipe stdout, stderr, and stdin to process (stdio: 'inherit')
  - Exit with the same status code as the claude process
  - Handle process errors gracefully
  - **Validates**: Developer can run `zap spec propose <text>` and see Claude Code execute
  - **Depends on**: Task 1

- [x] **Add proposal text validation**
  - Check if proposalText is empty or undefined after joining args
  - Display error: "Error: spec propose requires proposal text"
  - Display usage: "Usage: zap spec propose <proposal-text>"
  - Exit with status code 1 if validation fails
  - **Validates**: User gets clear error when no proposal text provided
  - **Depends on**: Task 2

- [x] **Add unit tests for spec propose command**
  - Create or extend test file for spec command tests
  - Test: spec propose without proposal text shows error
  - Test: spec propose with single-word text constructs correct command
  - Test: spec propose with multi-word text constructs correct command
  - Test: error handling when Claude Code is not available
  - Test: exit code is preserved from Claude process
  - **Validates**: All error cases and command construction are tested
  - **Depends on**: Tasks 1-3
  - **Can parallelize**: Yes (write tests alongside implementation)

- [x] **Add integration test for spec propose**
  - Add test case to existing integration test suite
  - Test the full command execution flow (if Claude is available)
  - Verify multi-word proposal text is passed correctly
  - Verify exit codes are preserved
  - **Validates**: End-to-end workflow works correctly
  - **Depends on**: Tasks 1-3

- [x] **Update README.md with new command**
  - Add `zap spec propose <proposal-text>` to the commands section
  - Include description of what the command does
  - Add prerequisite note about Claude Code installation
  - Add example usage with multi-word proposal
  - Position it alongside `zap spec archive` command for discoverability
  - **Validates**: Users can discover and understand the new command
  - **Depends on**: None (documentation can be written in parallel)
  - **Can parallelize**: Yes

## Validation Checklist

After completing all tasks:
- [x] `npm test` passes with all new tests
- [x] `npm run lint` passes without errors
- [x] `zap spec propose` shows missing proposal text error
- [x] `zap spec propose "Add new feature"` invokes Claude Code correctly (when installed)
- [x] `zap spec propose Add new feature` (unquoted multi-word) works correctly
- [x] Error message appears when Claude Code is not available
- [x] `openspec validate add-spec-propose-command --strict` passes
