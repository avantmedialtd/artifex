# Implementation Tasks

## Phase 1: Update Data Model and Parser

- [x] Update `Task` interface in `vscode-extension/src/types.ts` to include optional `lineNumber?: number` field
- [x] Modify `parseTasksFile` function in `vscode-extension/src/taskParser.ts` to track line numbers while parsing
    - [x] Update the loop that processes lines to track current line number (1-indexed)
    - [x] Include line number when creating `Task` objects for checkbox items
- [x] Test the parser changes to verify line numbers are captured correctly

## Phase 2: Create Navigation Command

- [x] Register new command `openspecTasks.openTaskLocation` in `vscode-extension/src/extension.ts`
    - [x] Add command registration in `initializeExtension` function
    - [x] Add command to context subscriptions for proper cleanup
- [x] Implement command handler that accepts file path and line number
    - [x] Use `vscode.workspace.openTextDocument` to open the file
    - [x] Use `vscode.window.showTextDocument` to display the document
    - [x] Create a `vscode.Range` for the target line and reveal it
    - [x] Position cursor at the beginning of the line
- [x] Add error handling for cases where file cannot be opened

## Phase 3: Make Tasks Clickable

- [x] Update `OpenSpecTaskItem` class in `vscode-extension/src/taskProvider.ts` to support commands
    - [x] Add logic to set the `command` property for task-type items when they have a line number
    - [x] Pass task file path and line number as command arguments
- [x] Ensure task items without line numbers remain non-interactive (backwards compatibility)
- [x] Verify that change and section items remain expandable/collapsible without triggering navigation

## Phase 4: Testing and Validation

- [x] Manual testing: Create test `tasks.md` with several tasks
- [x] Click on tasks to verify navigation opens correct file at correct line
- [x] Verify cursor positioning is accurate
- [x] Test edge cases: first line, last line, middle of file
- [x] Verify tree expansion/collapse still works for changes and sections
- [x] Verify checkbox icons and completion state display correctly

## Phase 5: Documentation

- [x] Update VSCode extension README with click-to-navigate feature
- [x] Add note about clicking tasks to jump to the line in tasks.md
