# Implementation Tasks

## Update Types

- [x] Add `title?: string` field to ChangeData interface in `vscode-extension/src/types.ts`

## Title Extraction Logic

- [x] Create new file `vscode-extension/src/titleExtractor.ts` with `extractProposalTitle` function
- [x] Implement title extraction logic (read first line, strip `#`, remove "Proposal: " prefix, trim whitespace)
- [x] Return null on errors or empty titles for graceful fallback
- [x] Add unit tests for title extraction in `vscode-extension/src/titleExtractor.test.ts`

## Parse and Populate Title

- [x] Import `extractProposalTitle` in `vscode-extension/src/taskParser.ts`
- [x] Update `getChangeData` function to call `extractProposalTitle` for each change
- [x] Populate `title` field in returned ChangeData objects
- [x] Handle cases where title extraction fails by setting `title: undefined`

## Update Tree View Display

- [x] Update `OpenSpecTaskProvider.getChildren` in `vscode-extension/src/taskProvider.ts` to include title in label
- [x] Use format: `"${title} (${changeId}) - ${completed}/${total} tasks completed"` when title exists
- [x] Use format: `"${changeId} (${completed}/${total} tasks completed)"` when title is undefined
- [x] Test tree view displays correctly with and without titles

## Add Copy Title Button

- [x] Register new command `openspecTasks.copyTitle` in `vscode-extension/src/extension.ts`
- [x] Implement command handler that copies title to clipboard using `vscode.env.clipboard.writeText`
- [x] Show success notification after copying with `vscode.window.showInformationMessage`
- [x] Add `command` property to OpenSpecTaskItem for change items with titles
- [x] Set command to `openspecTasks.copyTitle` with title as argument
- [x] Add appropriate icon (e.g., `clippy` or `copy`) to the inline action

## Testing and Validation

- [x] Manually test with changes that have titles
- [x] Manually test with changes that have no proposal.md file
- [x] Manually test with changes that have empty first line in proposal.md
- [x] Test copy button copies correct title to clipboard
- [x] Test tree view updates when proposal.md files are modified
- [x] Verify no regressions in existing functionality (task navigation, badge, refresh)
