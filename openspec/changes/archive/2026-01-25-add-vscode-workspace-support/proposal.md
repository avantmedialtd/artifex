# Proposal: Add VS Code Workspace Support

## Why

The OpenSpec Tasks extension currently only monitors the first workspace folder, ignoring other folders in multi-root workspaces. Developers working with monorepos or multiple related projects in a single VS Code window cannot see OpenSpec changes from all their workspace folders.

## What Changes

- Scan all workspace folders for `openspec/changes` directories instead of just the first folder
- Aggregate changes from all workspace folders into the unified tree view
- Display workspace folder name alongside change titles to distinguish changes from different folders
- Set up file watchers for each workspace folder that contains OpenSpec changes
- Handle workspace folder additions and removals dynamically
- Execute commands (apply, archive) in the correct workspace folder context

## Impact

- Affected specs: `vscode-extension`
- Affected code: `extension.ts`, `taskProvider.ts`, `taskParser.ts`, `types.ts`
