# Tasks: VSCode Extension for OpenSpec Task Monitoring

## Implementation Tasks

- [x] Set up extension directory structure
- [x] Create extension manifest (package.json)
- [x] Configure TypeScript for VSCode extension development
- [x] Implement task parser module
    - [x] Port parsing logic from commands/todo.ts
    - [x] Add TypeScript interfaces for Task, Section, ChangeData
    - [x] Handle malformed files gracefully
    - [x] Add unit tests for parser
- [x] Implement TreeDataProvider
    - [x] Create TaskProvider class implementing vscode.TreeDataProvider
    - [x] Implement getChildren() for tree hierarchy
    - [x] Implement getTreeItem() for rendering items
    - [x] Add icons for different item types (change, section, task)
    - [x] Display completion status (☑/☐)
    - [x] Show progress in change items (e.g., "2/5 tasks")
- [x] Implement extension activation
    - [x] Create extension.ts entry point
    - [x] Register TreeView with VSCode
    - [x] Set up FileSystemWatcher for tasks.md files
    - [x] Exclude archive directory from watching
    - [x] Implement debounced refresh on file changes
- [x] Implement badge display
    - [x] Calculate total unchecked tasks across all changes
    - [x] Update TreeView.badge with count
    - [x] Hide badge when count is 0
    - [x] Add tooltip showing task count
- [x] Add error handling
    - [x] Handle missing openspec directory gracefully
    - [x] Show helpful message when no changes found
    - [x] Log errors without crashing extension
    - [x] Handle file read permission errors
- [x] Create extension documentation
    - [x] Write README.md with installation instructions
    - [x] Document activation requirements (workspace must have openspec/changes)
    - [x] Add screenshots/examples of the panel

## Testing Tasks

- [x] Add unit tests for task parser
    - [x] Test parsing valid tasks.md
    - [x] Test handling empty files
    - [x] Test handling malformed markdown
    - [x] Test section and task extraction
    - [x] Test completion counting
- [x] Add integration tests for TreeDataProvider
    - [x] Test tree structure generation
    - [x] Test refresh behavior
    - [x] Test badge calculation
- [x] Manual testing
    - [x] Test in zap project with active changes
    - [x] Test with no active changes
    - [x] Test with malformed tasks.md files
    - [x] Test file watcher refresh
    - [x] Test badge display updates
    - [x] Test in workspace without openspec directory

## Validation Tasks

- [x] Validate extension manifest schema
- [x] Run TypeScript compiler checks
- [x] Test extension packaging (vsce package)
- [x] Verify extension activates correctly
- [x] Verify no errors in VSCode Developer Console
- [x] Run openspec validate add-vscode-extension --strict

## Documentation Tasks

- [x] Update project README.md to mention VSCode extension
- [x] Add vscode-extension/ to .gitignore exceptions if needed
- [x] Document development workflow for extension
- [x] Add troubleshooting section to extension README
