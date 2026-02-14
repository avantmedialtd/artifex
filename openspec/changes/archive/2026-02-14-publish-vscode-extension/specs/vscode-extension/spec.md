## MODIFIED Requirements

### Requirement: Commands use openspec namespace

All extension commands MUST use the `openspec` prefix instead of `openspecTasks`.

#### Scenario: Command IDs use correct prefix

**Given** the extension is activated
**When** the registered commands are examined
**Then** all commands use the `openspec.*` prefix
**And** the following commands are registered:
- `openspec.refresh`
- `openspec.openTaskLocation`
- `openspec.openProposal`
- `openspec.copyTitle`
- `openspec.copyChangeId`

## REMOVED Requirements

### Requirement: Commands execute in correct workspace folder context

**Reason**: The apply and archive commands that required workspace folder context for CLI execution have been removed. The extension no longer shells out to external CLI tools.

**Migration**: Use the CLI directly for apply/archive operations (`openspec apply <change-id>`, `openspec archive <change-id>`).
