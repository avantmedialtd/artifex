## MODIFIED Requirements

### Requirement: Modular command structure

The CLI MUST organize command implementations into separate modules by functional area.

#### Scenario: NPM commands in separate module

- **GIVEN** the CLI has npm-related commands
- **WHEN** the codebase is organized
- **THEN** npm command handlers are in a dedicated module (e.g., commands/npm.ts)
- **AND** the module exports handler functions for npm commands
- **AND** the module can be tested independently

#### Scenario: Versions commands in separate module

- **GIVEN** the CLI has versions-related commands (reset, push)
- **WHEN** the codebase is organized
- **THEN** versions command handlers are in a dedicated module (e.g., commands/versions.ts)
- **AND** the module exports handler functions for versions commands
- **AND** the module can be tested independently

## REMOVED Requirements

### Requirement: Shared utilities extraction

**Reason**: The only scenario for this requirement described `utils/claude.ts` and the `getAgentCommand()` helper. Both are being deleted in this change because their only consumer was the `af spec` handler. The broader principle ("the CLI extracts shared utilities into reusable modules") is still implicitly captured by the modular structure requirement above and by the existence of other shared modules (`utils/output.ts`, `utils/git.ts`, etc.), so no replacement requirement is needed.

**Migration**: None.

### Requirement: Agent command configuration

**Reason**: This requirement covered the `ARTIFEX_AGENT` environment variable, which existed solely to let the `af spec` handler swap out the `claude` binary. With the spec handler removed, nothing reads `ARTIFEX_AGENT` and the variable is no longer part of the user-facing surface.

**Migration**: None. Users who set `ARTIFEX_AGENT` will see no effect. The variable can be unset.
