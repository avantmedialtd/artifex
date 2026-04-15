## Context

`af install-extension` was built to install the OpenSpec Tasks VSCode extension from an embedded `.vsix`. The extension is now published to the VSCode Marketplace, so the bespoke installer no longer has a purpose. In fact the command is already dead code: `generated/setup-manifest.ts` exports `EXTENSION_FILE = null` because no `.vsix` is present in `vscode-extension/`, so every real-world invocation fails at the first guard with "No extension file bundled".

The extension source tree (`vscode-extension/`) still exists and stays untouched — it's the extension's own development repo-within-a-repo and is documented in README.md. Only the `af`-side machinery that exists solely to ship the extension is being removed.

## Goals / Non-Goals

**Goals:**
- Remove the `install-extension` command and all supporting code paths inside `af`.
- Simplify `scripts/generate-setup-manifest.ts` and `generated/setup-manifest.ts` by dropping the `EXTENSION_FILE` plumbing that only the removed command consumed.
- Delete the `install-extension-command` capability spec so it doesn't imply a non-existent feature.

**Non-Goals:**
- Removing or modifying the `vscode-extension/` source tree. The extension itself is unaffected.
- Removing or modifying any other `vscode-extension*` capability specs (`vscode-extension`, `vscode-extension-commands`, `vscode-extension-badge`, etc.). Those describe the extension's behavior, not `af`'s relationship to it.
- Touching the `.vscode/tasks.json` "Install extension" task — it invokes the extension's own npm scripts inside `vscode-extension/`, independent of `af install-extension`.
- Providing a deprecation warning or shim. The command is already non-functional in practice, so users are not actively relying on it.

## Decisions

### Decision 1: Medium-scope cut — remove command plus its unique scaffolding

Remove:
- `commands/install-extension.ts`
- The routing block and import in `router.ts`
- The `install-extension` entry in `commands/help.ts` (both `HELP_CONTENT` and the `showGeneralHelp` `listItem`)
- `getExtensionFile`, `ExtensionEntry`, `extensionImport`, and the `EXTENSION_FILE`/`ExtensionFile` output in `scripts/generate-setup-manifest.ts`
- The resulting `ExtensionFile` interface and `EXTENSION_FILE` export in `generated/setup-manifest.ts` (regenerated)
- `openspec/specs/install-extension-command/`

**Alternatives considered:**
- *Narrow cut*: Leave `getExtensionFile()` in the manifest generator. Rejected — it would orphan code that scans for `.vsix` files nothing else cares about, creating a confusing crumb.
- *Wide cut*: Also delete `vscode-extension/` and remove the extension specs. Rejected — the extension is still maintained and distributed via the Marketplace, just no longer bundled. That's a separate decision with a much bigger blast radius.

### Decision 2: No deprecation warning or stub command

Running `af install-extension` after this change will produce the standard "Unknown command" error from `router.ts`. No interim stub that prints "use the Marketplace instead".

**Rationale:** The command is already broken for all users (returns exit 1 with "No extension file bundled" on every run because `EXTENSION_FILE` is `null`). Adding a deprecation path for a command that doesn't work is ceremony without benefit.

### Decision 3: Delete the capability spec rather than add a `REMOVED Requirements` delta in place

The spec delta in this change will list every requirement under `## REMOVED Requirements` with a shared reason and migration note. When the change archives, `openspec/specs/install-extension-command/spec.md` is deleted entirely.

**Alternatives considered:**
- Marking individual requirements as removed but keeping the spec file around. Rejected — OpenSpec's archiving mechanism handles whole-capability removal cleanly, and leaving an empty spec file behind is confusing.

## Risks / Trade-offs

- **Risk**: A user or script hard-codes `af install-extension` and breaks after upgrading. → **Mitigation**: The command is already non-functional in practice, so this transition is effectively a no-op for anyone running it. The error message changes from "No extension file bundled" (exit 1) to "Unknown command" (exit 1). Documented in the proposal's Impact section and via the commit/PR description.
- **Risk**: Removing `EXTENSION_FILE` from `generated/setup-manifest.ts` breaks an unknown consumer. → **Mitigation**: `commands/install-extension.ts` is the only importer of `EXTENSION_FILE`; grep confirms no other references. Once the handler is deleted, the export has no consumers. TypeScript will catch any missed import at compile time.
- **Trade-off**: After this change, if we ever want to re-bundle the extension in the binary, we'll need to re-introduce the manifest plumbing. Acceptable — the Marketplace decision signals we don't plan to, and rebuilding ~20 lines of manifest code is cheap if priorities flip.

## Migration Plan

1. Delete `commands/install-extension.ts`.
2. Remove the import and routing block for `install-extension` from `router.ts`.
3. Remove the `install-extension` entry from `HELP_CONTENT` and the `listItem` from `showGeneralHelp` in `commands/help.ts`.
4. Edit `scripts/generate-setup-manifest.ts` to drop `VSCODE_EXTENSION_DIR`, `ExtensionEntry`, `getExtensionFile`, `extensionImport`, the `extension` handling in `generateManifest`, and the `ExtensionFile`/`EXTENSION_FILE` block in the emitted template.
5. Run `bun run generate:manifest` to regenerate `generated/setup-manifest.ts`.
6. Delete `openspec/specs/install-extension-command/`. (Handled by archiving this change via its REMOVED delta.)
7. Run `bun run format:check`, `bun run lint`, `bun run spell:check`, and `bun test` to verify nothing else references the removed command or exports.
8. Manually confirm `af install-extension` now prints "Unknown command" and `af help` no longer lists it.

No rollback mechanism needed — this is a clean deletion with no data or state migration.
