## REMOVED Requirements

### Requirement: Apply subcommand exists

**Reason**: The `af spec apply` command and its underlying handler are being removed. The `/opsx:apply` skill provides a direct entry point for applying an approved OpenSpec change.

**Migration**: Use `/opsx:apply [change-id]` directly in Claude Code. The skill auto-detects ongoing changes and prompts for selection when multiple exist.

### Requirement: Change-id argument is optional

**Reason**: Removed with the `af spec apply` handler.

**Migration**: `/opsx:apply` accepts an optional change-id argument and handles the zero/one/multiple-changes cases internally.

### Requirement: Claude Code availability check

**Reason**: Removed with the `af spec apply` handler. The `/opsx:apply` skill runs inside Claude Code, so an availability check is unnecessary.

**Migration**: None.

### Requirement: Command execution with correct arguments

**Reason**: Removed with the `af spec apply` handler. There is no longer an external process to invoke.

**Migration**: None.

### Requirement: Process output and exit code handling

**Reason**: Removed with the `af spec apply` handler.

**Migration**: None.

### Requirement: Integration with existing spec command

**Reason**: The entire `af spec` command namespace is being removed.

**Migration**: None.

### Requirement: Interactive change selection

**Reason**: Removed with the `af spec apply` handler. The `Ink` picker (`utils/change-select-render.tsx`, `components/change-select.tsx`) is also deleted.

**Migration**: `/opsx:apply` and `/opsx:archive` handle change selection through their own conversational flow when multiple changes exist.
