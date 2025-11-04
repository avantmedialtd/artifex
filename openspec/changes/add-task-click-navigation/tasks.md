# Implementation Tasks

## Phase 1: Update Data Model and Parser

- [ ] Update `Task` interface in `vscode-extension/src/types.ts` to include optional `lineNumber?: number` field
- [ ] Modify `parseTasksFile` function in `vscode-extension/src/taskParser.ts` to track line numbers while parsing
    - [ ] Update the loop that processes lines to track current line number (1-indexed)
    - [ ] Include line number when creating `Task` objects for checkbox items
- [ ] Test the parser changes to verify line numbers are captured correctly

## Phase 2: Create Navigation Command

- [ ] Register new command `openspecTasks.openTaskLocation` in `vscode-extension/src/extension.ts`
    - [ ] Add command registration in `initializeExtension` function
    - [ ] Add command to context subscriptions for proper cleanup
- [ ] Implement command handler that accepts file path and line number
    - [ ] Use `vscode.workspace.openTextDocument` to open the file
    - [ ] Use `vscode.window.showTextDocument` to display the document
    - [ ] Create a `vscode.Range` for the target line and reveal it
    - [ ] Position cursor at the beginning of the line
- [ ] Add error handling for cases where file cannot be opened

## Phase 3: Make Tasks Clickable

- [ ] Update `OpenSpecTaskItem` class in `vscode-extension/src/taskProvider.ts` to support commands
    - [ ] Add logic to set the `command` property for task-type items when they have a line number
    - [ ] Pass task file path and line number as command arguments
- [ ] Ensure task items without line numbers remain non-interactive (backwards compatibility)
- [ ] Verify that change and section items remain expandable/collapsible without triggering navigation

## Phase 4: Testing and Validation

- [ ] Manual testing: Create test `tasks.md` with several tasks
- [ ] Click on tasks to verify navigation opens correct file at correct line
- [ ] Verify cursor positioning is accurate
- [ ] Test edge cases: first line, last line, middle of file
- [ ] Verify tree expansion/collapse still works for changes and sections
- [ ] Verify checkbox icons and completion state display correctly

## Phase 5: Documentation

- [ ] Update VSCode extension README with click-to-navigate feature
- [ ] Add note about clicking tasks to jump to the line in tasks.md
