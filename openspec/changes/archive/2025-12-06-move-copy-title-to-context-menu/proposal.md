# Move Copy Title to Context Menu

## Why

Currently, clicking on a change item in the VSCode extension copies the title to the clipboard. This is unexpected behavior - users typically expect clicking to navigate to a relevant file. Moving "Copy Title" to the context menu (alongside "Copy Change ID") and making the click action open `proposal.md` would be more intuitive.

## What Changes

- Remove the click action that copies the title
- Add "Copy Title" as a context menu item for change items (alongside existing "Copy Change ID")
- Make clicking on a change item open the `proposal.md` file for that change

## Impact

- Affected specs: `vscode-copy-change-id`
- Affected code: `vscode-extension/src/taskProvider.ts`, `vscode-extension/src/extension.ts`, `vscode-extension/package.json`
