# Implementation Tasks

## Update Types

- [ ] Add `title?: string` field to ChangeData interface in `vscode-extension/src/types.ts`

## Title Extraction Logic

- [ ] Create new file `vscode-extension/src/titleExtractor.ts` with `extractProposalTitle` function
- [ ] Implement title extraction logic (read first line, strip `#`, remove "Proposal: " prefix, trim whitespace)
- [ ] Return null on errors or empty titles for graceful fallback
- [ ] Add unit tests for title extraction in `vscode-extension/src/titleExtractor.test.ts`

## Parse and Populate Title

- [ ] Import `extractProposalTitle` in `vscode-extension/src/taskParser.ts`
- [ ] Update `getChangeData` function to call `extractProposalTitle` for each change
- [ ] Populate `title` field in returned ChangeData objects
- [ ] Handle cases where title extraction fails by setting `title: undefined`

## Update Tree View Display

- [ ] Update `OpenSpecTaskProvider.getChildren` in `vscode-extension/src/taskProvider.ts` to include title in label
- [ ] Use format: `"${title} (${changeId}) - ${completed}/${total} tasks completed"` when title exists
- [ ] Use format: `"${changeId} (${completed}/${total} tasks completed)"` when title is undefined
- [ ] Test tree view displays correctly with and without titles

## Add Copy Title Button

- [ ] Register new command `openspecTasks.copyTitle` in `vscode-extension/src/extension.ts`
- [ ] Implement command handler that copies title to clipboard using `vscode.env.clipboard.writeText`
- [ ] Show success notification after copying with `vscode.window.showInformationMessage`
- [ ] Add `command` property to OpenSpecTaskItem for change items with titles
- [ ] Set command to `openspecTasks.copyTitle` with title as argument
- [ ] Add appropriate icon (e.g., `clippy` or `copy`) to the inline action

## Testing and Validation

- [ ] Manually test with changes that have titles
- [ ] Manually test with changes that have no proposal.md file
- [ ] Manually test with changes that have empty first line in proposal.md
- [ ] Test copy button copies correct title to clipboard
- [ ] Test tree view updates when proposal.md files are modified
- [ ] Verify no regressions in existing functionality (task navigation, badge, refresh)
