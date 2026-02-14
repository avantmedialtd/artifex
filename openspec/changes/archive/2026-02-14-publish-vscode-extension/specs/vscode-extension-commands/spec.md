## REMOVED Requirements

### Requirement: Apply command available for incomplete changes

**Reason**: The apply command shelled out to the `af` CLI tool. The extension must be standalone with no external CLI dependencies for marketplace publishing.

**Migration**: Use the CLI directly: `openspec apply <change-id>`.

### Requirement: Archive command available for complete changes

**Reason**: The archive command shelled out to the `af` CLI tool. The extension must be standalone with no external CLI dependencies for marketplace publishing.

**Migration**: Use the CLI directly: `openspec archive <change-id>`.

### Requirement: Terminal stays open on command failure

**Reason**: No longer applicable — the terminal-based command execution has been removed entirely.

**Migration**: N/A.

### Requirement: Context value encodes completion status

**Reason**: The context value encoding was primarily used to conditionally show apply/archive menu items based on completion status. With those commands removed, the completion-based context value encoding is no longer needed. The `with-title` suffix remains for the copy title menu.

**Migration**: N/A. The `contextValue` still encodes title presence for copy commands.
