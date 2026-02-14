# Rename VSCode Extension to OpenSpec

## Why

The VSCode extension is currently named "OpenSpec Tasks" with the identifier `openspec-tasks`. Since the extension is the primary interface for OpenSpec in VSCode — not just a task viewer — the name should simply be "OpenSpec" to reflect its broader scope and align with the project identity.

## What Changes

- **BREAKING**: Rename extension identifier from `openspec-tasks` to `openspec` in `package.json`
- **BREAKING**: Rename display name from "OpenSpec Tasks" to "OpenSpec"
- **BREAKING**: Rename all command IDs from `openspecTasks.*` prefix to `openspec.*`
- **BREAKING**: Rename configuration keys from `openspecTasks.*` to `openspec.*`
- Rename view ID from `openspecTasks` to `openspecChanges` (view container already uses `openspec`)
- Update VSIX filename from `openspec-tasks-*.vsix` to `openspec-*.vsix`
- Update README and documentation references

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `vscode-extension`: Extension identity changes — name, displayName, command prefix, configuration prefix, view ID, and VSIX filename all change
- `vscode-extension-collapsed-sections`: Configuration key prefix changes from `openspecTasks` to `openspec`
- `vscode-copy-change-id`: Command ID changes from `openspecTasks.copyChangeId` to `openspec.copyChangeId`
- `vscode-extension-commands`: All command IDs change prefix from `openspecTasks` to `openspec`
- `install-extension-command`: VSIX filename pattern changes

## Impact

- **Extension users**: Must uninstall old extension and install new one (different identifier)
- **Settings**: Any user-configured `openspecTasks.*` settings will need to be migrated to `openspec.*`
- **Source code**: `extension.ts` and `taskProvider.ts` command registrations updated
- **Build pipeline**: VSIX output filename changes, setup manifest regenerated
- **Existing specs**: Multiple specs reference old command/config names and need delta updates
