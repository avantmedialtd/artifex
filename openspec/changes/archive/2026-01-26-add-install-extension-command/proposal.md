# Add Install Extension Command

## Why

Users who download the compiled Artifex binary need a way to install the bundled VSCode extension. Currently, extension installation requires navigating to the `vscode-extension/` directory and running npm scripts, which isn't possible when the binary is distributed standalone.

## What Changes

- Add `af install-extension` command that installs the OpenSpec Tasks VSCode extension
- Embed the `.vsix` file into the compiled binary using Bun's file import attribute
- Use the `code --install-extension` CLI to install the extension from the embedded file

## Impact

- Affected specs: new `install-extension-command` capability
- Affected code:
    - `commands/install-extension.ts` - New command handler
    - `router.ts` - Add routing for new command
    - `commands/help.ts` - Add help content
    - `scripts/generate-setup-manifest.ts` - Add VSIX file embedding
    - `generated/setup-manifest.ts` - Auto-generated with VSIX import
