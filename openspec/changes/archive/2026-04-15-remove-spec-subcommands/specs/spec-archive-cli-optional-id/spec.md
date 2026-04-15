## REMOVED Requirements

### Requirement: Spec-id argument is optional

**Reason**: The `af spec archive` command is being removed entirely. This capability was originally introduced as a separate spec for the optional-id behavior, then later duplicated into `spec-archive-cli`. Both capabilities are being removed in this change.

**Migration**: Use `/opsx:archive [change-id]` directly. The skill accepts an optional change-id and handles the zero/one/multiple-changes cases internally.

### Requirement: Help text reflects optional argument

**Reason**: Removed with the `af spec archive` handler. There is no help text to maintain because the command no longer exists.

**Migration**: None. `af help` no longer lists `spec`.
