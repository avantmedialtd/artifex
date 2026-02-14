## Context

The OpenSpec VSCode extension currently works as a local `.vsix` install. It has two commands (`applyChange`, `archiveChange`) that shell out to the `af` CLI tool via `executeZapCommand`. For marketplace publishing, the extension must be standalone — no external CLI dependencies.

The extension uses plain TypeScript compilation (`tsc`) with no bundler. It has no runtime npm dependencies (VSCode API only).

## Goals / Non-Goals

**Goals:**
- Remove all `af` CLI dependencies so the extension is self-contained
- Add required marketplace metadata for publishing
- Produce a clean `.vsix` package via `@vscode/vsce`

**Non-Goals:**
- Replacing apply/archive with alternative implementations (removed entirely)
- Adding a custom extension icon (deferred)
- Adding a repository URL (private repo)
- Changing the license (keeping proprietary/UNLICENSED)
- Bundling with esbuild/webpack (current `tsc` approach is sufficient)

## Decisions

### Remove both apply and archive commands (not just archive)

Both commands depend on `af` via `executeZapCommand`. Removing archive alone would leave apply still calling `af`. Remove both commands and the shared helper function entirely.

The `contextValue` encoding (`change-complete`/`change-incomplete`) remains — it's still used by the copy title menu (`with-title` suffix). Only the menu entries referencing apply/archive are removed.

### Keep `@vscode/vsce` as a devDependency rather than global install

Adding it to `devDependencies` ensures consistent versioning across CI and local development. The existing Jenkinsfile already uses `npx @vscode/vsce package`.

### README trimmed for marketplace audience

The marketplace renders the extension's `README.md` as the main listing page. Development-only sections (building from source, manual `.vsix` installation) should be removed. The `af` CLI examples in the "Copying Change Information" section are removed.

## Risks / Trade-offs

- **Reduced functionality**: Users lose the ability to apply/archive from VSCode context menus. This is acceptable — the extension's core value is monitoring and navigation, not command execution.
- **No icon**: The marketplace listing won't have a custom icon, which reduces visual appeal. Can be added in a future update without breaking changes.
