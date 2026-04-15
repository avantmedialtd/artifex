## 1. Remove command code

- [x] 1.1 Delete `commands/install-extension.ts`
- [x] 1.2 Remove the `handleInstallExtension` import from `router.ts`
- [x] 1.3 Remove the `install-extension` routing block in `router.ts`
- [x] 1.4 Remove the `install-extension` entry from `HELP_CONTENT` in `commands/help.ts`
- [x] 1.5 Remove the `install-extension` `listItem` from `showGeneralHelp` in `commands/help.ts`

## 2. Remove extension-bundling scaffolding

- [x] 2.1 Remove `VSCODE_EXTENSION_DIR`, `ExtensionEntry`, and `getExtensionFile` from `scripts/generate-setup-manifest.ts`
- [x] 2.2 Remove `extensionImport` and the `extension` handling from `generateManifest` in `scripts/generate-setup-manifest.ts`
- [x] 2.3 Remove the `ExtensionFile` interface and `EXTENSION_FILE` export from the emitted template in `scripts/generate-setup-manifest.ts`
- [x] 2.4 Remove the extension logging block at the end of `generateManifest`
- [x] 2.5 Run `bun run generate:manifest` to regenerate `generated/setup-manifest.ts`
- [x] 2.6 Verify the regenerated `generated/setup-manifest.ts` contains no `ExtensionFile` or `EXTENSION_FILE` references

## 3. Verification

- [x] 3.1 Run `bun run format:check` and fix any violations
- [x] 3.2 Run `bun run lint` and fix any violations
- [x] 3.3 Run `bun run spell:check` and fix any violations
- [x] 3.4 Run `bun run test` and confirm all tests pass (243 passed, 5 skipped, 18 files)
- [x] 3.5 Confirm `grep -r "install-extension" commands/ router.ts scripts/ generated/` returns no matches (the command and its scaffolding are fully gone; matches in `openspec/changes/` and `openspec/specs/` archives are expected)
- [x] 3.6 Confirm `grep -r "EXTENSION_FILE" .` returns no matches outside `openspec/changes/` history
- [x] 3.7 Run `./af install-extension` and confirm it prints "Unknown command"
- [x] 3.8 Run `./af help` and confirm `install-extension` is not listed
- [x] 3.9 Run `./af help install-extension` and confirm it prints "Unknown command"

## 4. Spec cleanup (handled by archiving)

- [x] 4.1 Verify `openspec/specs/install-extension-command/spec.md` is still present before archiving (it is deleted automatically when this change is archived via the REMOVED delta)
