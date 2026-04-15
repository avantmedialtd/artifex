## Why

The `af install-extension` command existed to install the bundled OpenSpec Tasks VSCode extension from an embedded `.vsix` file. That extension is now published to the VSCode Marketplace, so users install it through VSCode directly and the bespoke installer is redundant maintenance overhead. The command is also currently dead code — `EXTENSION_FILE` is `null` in the generated manifest because no `.vsix` is bundled, so every invocation fails with "No extension file bundled".

## What Changes

- **BREAKING**: Remove the `af install-extension` command. Users who still type it will get the standard "Unknown command" error.
- Delete `commands/install-extension.ts`.
- Remove `install-extension` routing from `router.ts`.
- Remove the `install-extension` entry from `commands/help.ts` (both `HELP_CONTENT` and the general-help `listItem`).
- Remove `.vsix` discovery and embedding from `scripts/generate-setup-manifest.ts` (drop `getExtensionFile`, `ExtensionEntry`, `extensionImport`, and the `EXTENSION_FILE`/`ExtensionFile` outputs).
- Regenerate `generated/setup-manifest.ts` so the `ExtensionFile` interface and `EXTENSION_FILE` export disappear.
- Delete the `openspec/specs/install-extension-command/` capability spec.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `install-extension-command`: Entire capability is removed. Every requirement in `openspec/specs/install-extension-command/spec.md` is deleted.

## Impact

- **Code removed**: `commands/install-extension.ts` (133 lines), the install-extension route in `router.ts`, the `install-extension` entries in `commands/help.ts`, and the extension-embedding branch of `scripts/generate-setup-manifest.ts`.
- **Generated code**: `generated/setup-manifest.ts` regenerates smaller — no `ExtensionFile` interface or `EXTENSION_FILE` export.
- **Spec removed**: `openspec/specs/install-extension-command/spec.md`.
- **Not affected**: The `vscode-extension/` source tree stays put (the extension still exists, just distributed via Marketplace). The README's `vscode-extension/` references remain valid. The `.vscode/tasks.json` "Install extension" task invokes the extension's *own* npm scripts inside `vscode-extension/`, unrelated to `af install-extension`, so it also stays.
- **User-visible**: Anyone who had `af install-extension` in a script will now hit "Unknown command". Low blast radius — the command was already failing in practice because no `.vsix` was bundled.
