# Proposal: Add Click-to-Navigate for Tasks in VSCode Extension

## Why

Users of the VSCode extension can view tasks from `tasks.md` files in the OpenSpec Tasks panel, but clicking on a task item does nothing. Users must manually locate and open the `tasks.md` file, then scroll to find the specific task they want to check off or review. This inefficient workflow reduces the extension's usefulness as a task management tool.

## What Changes

- **Track line numbers during parsing**: Modify the task parser in `vscode-extension/src/taskParser.ts` to capture the line number where each task checkbox appears
- **Extend Task data model**: Update the `Task` interface in `vscode-extension/src/types.ts` to include an optional `lineNumber` field
- **Add navigation command**: Register a VSCode command `openspecTasks.openTaskLocation` that opens a file at a specific line
- **Make tasks clickable**: Update `OpenSpecTaskItem` in `vscode-extension/src/taskProvider.ts` to add the `command` property for task items with line numbers

## Impact

- Affected specs: `vscode-extension` (enhanced with new click-to-navigate capability)
- Affected code:
    - `vscode-extension/src/types.ts` - Task interface with lineNumber field
    - `vscode-extension/src/taskParser.ts` - Line number tracking during parsing
    - `vscode-extension/src/extension.ts` - Command registration
    - `vscode-extension/src/taskProvider.ts` - Command assignment to task items
