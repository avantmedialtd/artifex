## 1. Build Infrastructure

- [x] 1.1 Update `scripts/generate-setup-manifest.ts` to embed `.vsix` file from `vscode-extension/`
- [x] 1.2 Add `ExtensionFile` interface and `EXTENSION_FILE` export to generated manifest
- [x] 1.3 Run `bun run generate:manifest` to verify VSIX embedding works

## 2. Command Implementation

- [x] 2.1 Create `commands/install-extension.ts` with `handleInstallExtension()` handler
- [x] 2.2 Implement VSIX extraction to temp file (required by `code` CLI)
- [x] 2.3 Execute `code --install-extension <path>` with proper error handling
- [x] 2.4 Clean up temp file after installation

## 3. CLI Integration

- [x] 3.1 Add routing in `router.ts` for `install-extension` command
- [x] 3.2 Add help content in `commands/help.ts`

## 4. Testing

- [x] 4.1 Test command from source (`./af install-extension`)
- [x] 4.2 Compile binary and test from compiled mode
- [x] 4.3 Verify extension appears in VSCode after installation
