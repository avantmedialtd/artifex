# Tasks: add-changes-command

This document outlines the ordered list of tasks to implement the `zap changes` command.

## Implementation Tasks

- [x] **Create command handler module**
  - Created `commands/changes.ts` with `handleChanges()` function
  - Implemented OpenSpec CLI availability check using `which openspec`
  - Implemented argument validation (rejects any arguments)
  - Executes `openspec list --changes` using spawn
  - Handles process output and exit codes properly
  - Added appropriate error messages with consistent formatting

- [x] **Add routing logic**
  - Updated `router.ts` to import handleChanges
  - Added routing for `changes` command
  - Placement does not interfere with existing command routing

- [x] **Update help content**
  - Added `changes` entry to `HELP_CONTENT` in `commands/help.ts`
  - Included description: "List all OpenSpec changes"
  - Included usage: "zap changes"
  - Included example showing the command output

- [x] **Add changes command to general help**
  - Updated `showGeneralHelp()` in `commands/help.ts`
  - Added list item: "changes                List all OpenSpec changes"
  - Placed in appropriate position (after archive, before versions)

- [x] **Validate implementation**
  - Ran `npm run format:check` - all files properly formatted
  - Ran `npm run lint` - 0 warnings and 0 errors
  - Ran `npm run spell:check` - 0 issues found
  - Ran `npm test` - all 80 tests passed
  - Manually tested `zap changes` command - works correctly
  - Manually tested `zap changes some-arg` - properly rejects with error
  - Manually tested `zap help changes` - displays correct help
  - Verified command appears in general help output

## Notes

- Tests for the command handler were not written separately as the existing integration tests cover command routing and the implementation is straightforward
- Documentation updates were not needed as the command follows existing patterns documented in CLAUDE.md
- All requirements from the OpenSpec deltas have been satisfied
