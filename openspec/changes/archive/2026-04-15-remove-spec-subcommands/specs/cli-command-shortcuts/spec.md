## REMOVED Requirements

### Requirement: Top-level propose command

**Reason**: The `af propose` shorthand is being removed along with the `af spec propose` command it delegated to. The OPSX skill workflow (`/opsx:new`, `/opsx:ff`) provides a more direct entry point for creating OpenSpec proposals.

**Migration**: Use `/opsx:new <change-name>` or `/opsx:ff <change-name>` directly in Claude Code.

### Requirement: Propose shorthand requires proposal text

**Reason**: Removed with the `af propose` shorthand.

**Migration**: None.

### Requirement: Backward compatibility with spec propose

**Reason**: Both `af propose` and `af spec propose` are being removed in the same change, so there is no longer anything to be backward-compatible with.

**Migration**: None.

### Requirement: Multi-word proposal text handling in shorthand

**Reason**: Removed with the `af propose` shorthand.

**Migration**: None.

### Requirement: Claude Code availability check in shorthand

**Reason**: Removed with the `af propose` shorthand.

**Migration**: None.

### Requirement: Unknown top-level command handling

**Reason**: This requirement was specifically about preserving error handling after the propose shorthand was added. With all shorthands removed, the standard "Unknown command" error in `router.ts` covers the same behavior without needing a dedicated requirement.

**Migration**: None — the unknown-command error path in `router.ts` is unchanged.

### Requirement: Top-level archive command

**Reason**: The `af archive` shorthand is being removed along with the `af spec archive` command it delegated to.

**Migration**: Use `/opsx:archive [change-id]` directly, or `/complete-work` for the full Jira-aware archival workflow.

### Requirement: Archive shorthand requires spec-id

**Reason**: Removed with the `af archive` shorthand.

**Migration**: None.

### Requirement: Backward compatibility with spec archive

**Reason**: Both `af archive` and `af spec archive` are being removed in the same change.

**Migration**: None.

### Requirement: Claude Code availability check in archive shorthand

**Reason**: Removed with the `af archive` shorthand.

**Migration**: None.

### Requirement: Top-level apply command

**Reason**: The `af apply` shorthand is being removed along with the `af spec apply` command it delegated to.

**Migration**: Use `/opsx:apply [change-id]` directly in Claude Code.

### Requirement: Apply shorthand accepts optional change-id

**Reason**: Removed with the `af apply` shorthand.

**Migration**: None.

### Requirement: Backward compatibility with spec apply

**Reason**: Both `af apply` and `af spec apply` are being removed in the same change.

**Migration**: None.

### Requirement: Claude Code availability check in apply shorthand

**Reason**: Removed with the `af apply` shorthand.

**Migration**: None.
