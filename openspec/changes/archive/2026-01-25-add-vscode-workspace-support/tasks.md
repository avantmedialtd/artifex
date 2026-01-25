## 1. Type System Updates

- [x] 1.1 Add `workspaceFolder` property to `ChangeData` type to track which workspace folder a change belongs to
- [x] 1.2 Add `WorkspaceFolderRef` interface to reference workspace folders

## 2. Task Parser Updates

- [x] 2.1 Update `getAllChangeData` to accept a workspace folder parameter
- [x] 2.2 Add function to scan all workspace folders and aggregate changes (`getAllChangeDataFromAllWorkspaces`)
- [x] 2.3 Include workspace folder reference in returned `ChangeData` objects

## 3. Task Provider Updates

- [x] 3.1 Refactor `OpenSpecTaskProvider` to manage multiple workspace folders
- [x] 3.2 Update tree structure to optionally group changes by workspace folder (when multiple folders have changes)
- [x] 3.3 Update change item labels to include workspace folder name when in multi-root workspace
- [x] 3.4 Update task file path resolution to use the correct workspace folder

## 4. Extension Activation Updates

- [x] 4.1 Iterate all workspace folders during activation instead of just the first
- [x] 4.2 Create file watchers for each workspace folder with OpenSpec changes
- [x] 4.3 Subscribe to `onDidChangeWorkspaceFolders` event to handle dynamic folder changes
- [x] 4.4 Properly dispose of watchers when workspace folders are removed

## 5. Command Updates

- [x] 5.1 Update `openProposal` command to use the change's workspace folder
- [x] 5.2 Update `openTaskLocation` command to resolve paths against correct workspace folder
- [x] 5.3 Update `executeZapCommand` to run in the correct workspace folder context (cwd)

## 6. Testing

- [x] 6.1 Test with single workspace folder (existing behavior preserved)
- [x] 6.2 Test with multi-root workspace containing multiple OpenSpec projects
- [x] 6.3 Test adding/removing workspace folders dynamically
- [x] 6.4 Test commands execute in correct workspace folder context
