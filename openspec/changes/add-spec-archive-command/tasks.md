# Implementation Tasks

## Overview
This task list implements the `zap spec archive <spec-id>` command by adding command parsing, Claude Code invocation, and appropriate error handling.

## Tasks

- [ ] **Add spec command parser to main.ts**
  - Add conditional branch for `command === 'spec'` in main.ts
  - Extract subcommand from args (e.g., 'archive')
  - Handle missing subcommand error case
  - Handle unknown subcommand error case
  - **Validates**: Developer can run `zap spec` and see appropriate error messages
  - **Depends on**: None (foundational change)

- [ ] **Implement archive subcommand handler**
  - Create `runSpecArchive(specId: string)` function in main.ts
  - Validate that specId argument is provided (error if missing)
  - Build the claude command: `claude --permission-mode acceptEdits "/openspec:archive <spec-id>"`
  - Use `child_process.spawn` to execute the command
  - Pipe stdout and stderr to process output
  - Exit with the same status code as the claude process
  - **Validates**: Developer can run `zap spec archive <spec-id>` and see Claude Code execute
  - **Depends on**: Task 1

- [ ] **Add Claude Code availability check**
  - Create `checkClaudeAvailable()` utility function
  - Use `child_process.spawn` to check if `claude --version` succeeds
  - Return boolean indicating availability
  - Call this check before executing the archive command
  - Display helpful error message if claude is not found
  - **Validates**: User gets clear error if Claude Code is not installed
  - **Depends on**: Task 2

- [ ] **Add unit tests for spec command**
  - Create `spec-archive.test.ts` test file
  - Test: spec command without subcommand shows error
  - Test: spec archive without spec-id shows error
  - Test: spec archive with unknown subcommand shows error
  - Test: spec archive with valid spec-id constructs correct command (can mock spawn)
  - Test: error handling when Claude Code is not available
  - **Validates**: All error cases and command construction are tested
  - **Depends on**: Tasks 1-3
  - **Can parallelize**: Yes (write tests alongside implementation)

- [ ] **Add integration test for spec archive**
  - Add test case to `integration.test.ts`
  - Test the full command execution flow (if Claude is available)
  - Verify exit codes are preserved
  - **Validates**: End-to-end workflow works correctly
  - **Depends on**: Tasks 1-3

- [ ] **Update README.md with new command**
  - Add `zap spec archive <spec-id>` to the commands section
  - Include description of what the command does
  - Add prerequisite note about Claude Code installation
  - Add example usage
  - **Validates**: Users can discover and understand the new command
  - **Depends on**: None (documentation can be written in parallel)
  - **Can parallelize**: Yes

## Validation Checklist

After completing all tasks:
- [ ] `npm test` passes with all new tests
- [ ] `npm run lint` passes without errors
- [ ] `zap spec` shows appropriate error
- [ ] `zap spec archive` shows missing spec-id error
- [ ] `zap spec archive test-spec` invokes Claude Code correctly (when installed)
- [ ] Error message appears when Claude Code is not available
- [ ] `openspec validate add-spec-archive-command --strict` passes
