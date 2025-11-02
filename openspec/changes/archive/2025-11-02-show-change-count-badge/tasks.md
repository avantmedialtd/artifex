# Implementation Tasks

## Core Implementation

- [x] Add `getActiveChangesWithUncheckedTasks()` method to `OpenSpecTaskProvider` class in `vscode-extension/src/taskProvider.ts` that returns the count of changes with unchecked tasks
- [x] Update `updateBadge()` function in `vscode-extension/src/extension.ts` to use the new count instead of completion percentage
- [x] Update badge tooltip text to show "X active change(s) with unchecked tasks" format
- [x] Update badge visibility logic to hide badge when count is 0

## Testing & Validation

- [x] Test badge with multiple changes where some have unchecked tasks and some are complete
- [x] Test badge when all changes are complete (should be hidden)
- [x] Test badge when no changes exist (should be hidden)
- [x] Test badge with single change with unchecked tasks (should show 1)
- [x] Verify badge updates in real-time when tasks are checked/unchecked in tasks.md files

## Documentation

- [x] Update `vscode-extension/README.md` to reflect new badge behavior (change from "completion percentage" to "count of changes with unchecked tasks")
