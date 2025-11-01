# Tasks: VSCode Extension for OpenSpec Task Monitoring

## Implementation Tasks

- [ ] Set up extension directory structure
- [ ] Create extension manifest (package.json)
- [ ] Configure TypeScript for VSCode extension development
- [ ] Implement task parser module
    - [ ] Port parsing logic from commands/todo.ts
    - [ ] Add TypeScript interfaces for Task, Section, ChangeData
    - [ ] Handle malformed files gracefully
    - [ ] Add unit tests for parser
- [ ] Implement TreeDataProvider
    - [ ] Create TaskProvider class implementing vscode.TreeDataProvider
    - [ ] Implement getChildren() for tree hierarchy
    - [ ] Implement getTreeItem() for rendering items
    - [ ] Add icons for different item types (change, section, task)
    - [ ] Display completion status (☑/☐)
    - [ ] Show progress in change items (e.g., "2/5 tasks")
- [ ] Implement extension activation
    - [ ] Create extension.ts entry point
    - [ ] Register TreeView with VSCode
    - [ ] Set up FileSystemWatcher for tasks.md files
    - [ ] Exclude archive directory from watching
    - [ ] Implement debounced refresh on file changes
- [ ] Implement badge display
    - [ ] Calculate total unchecked tasks across all changes
    - [ ] Update TreeView.badge with count
    - [ ] Hide badge when count is 0
    - [ ] Add tooltip showing task count
- [ ] Add error handling
    - [ ] Handle missing openspec directory gracefully
    - [ ] Show helpful message when no changes found
    - [ ] Log errors without crashing extension
    - [ ] Handle file read permission errors
- [ ] Create extension documentation
    - [ ] Write README.md with installation instructions
    - [ ] Document activation requirements (workspace must have openspec/changes)
    - [ ] Add screenshots/examples of the panel

## Testing Tasks

- [ ] Add unit tests for task parser
    - [ ] Test parsing valid tasks.md
    - [ ] Test handling empty files
    - [ ] Test handling malformed markdown
    - [ ] Test section and task extraction
    - [ ] Test completion counting
- [ ] Add integration tests for TreeDataProvider
    - [ ] Test tree structure generation
    - [ ] Test refresh behavior
    - [ ] Test badge calculation
- [ ] Manual testing
    - [ ] Test in zap project with active changes
    - [ ] Test with no active changes
    - [ ] Test with malformed tasks.md files
    - [ ] Test file watcher refresh
    - [ ] Test badge display updates
    - [ ] Test in workspace without openspec directory

## Validation Tasks

- [ ] Validate extension manifest schema
- [ ] Run TypeScript compiler checks
- [ ] Test extension packaging (vsce package)
- [ ] Verify extension activates correctly
- [ ] Verify no errors in VSCode Developer Console
- [ ] Run openspec validate add-vscode-extension --strict

## Documentation Tasks

- [ ] Update project README.md to mention VSCode extension
- [ ] Add vscode-extension/ to .gitignore exceptions if needed
- [ ] Document development workflow for extension
- [ ] Add troubleshooting section to extension README
