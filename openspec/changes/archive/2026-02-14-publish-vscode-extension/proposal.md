# Publish VSCode Extension to Marketplace

## Why

The OpenSpec VSCode extension is fully functional and locally installable via `.vsix`, but cannot be discovered or installed by other users. Publishing to the VSCode Marketplace makes it available to anyone using OpenSpec workflows.

Before publishing, the extension must be decoupled from the `af` CLI tool — it currently shells out to `af spec apply` and `af spec archive` for context menu commands. The extension should be standalone with no external CLI dependencies.

## What Changes

- **BREAKING**: Remove `applyChange` command — shells out to `af spec apply`
- **BREAKING**: Remove `archiveChange` command — shells out to `af spec archive`
- Remove `executeZapCommand` helper function (runs `af` commands)
- Remove apply/archive entries from context menus in `package.json`
- Add marketplace metadata: `keywords`, `@vscode/vsce` devDependency, `publish` script
- Add `CHANGELOG.md` for marketplace version history
- Update `.vscodeignore` to exclude `.vsix` files from published package
- Update `README.md`: remove `af` CLI references, remove stale limitation notes, trim dev-only sections

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `vscode-extension`: Remove `applyChange` and `archiveChange` from registered commands list; remove `af` references from workspace command execution scenarios
- `vscode-extension-commands`: Remove entirely — the apply/archive command specs are no longer applicable

## Impact

- `vscode-extension/src/extension.ts` — remove apply, archive, and executeZapCommand
- `vscode-extension/package.json` — remove command/menu contributions, add marketplace metadata
- `vscode-extension/README.md` — remove `af` references, update for marketplace audience
- `vscode-extension/.vscodeignore` — add `*.vsix` exclusion
- `vscode-extension/CHANGELOG.md` — new file
