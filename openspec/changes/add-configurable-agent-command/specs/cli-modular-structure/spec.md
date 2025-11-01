# cli-modular-structure Specification Delta

## ADDED Requirements

### Requirement: Agent command configuration

The CLI MUST support configurable agent command names via the `ZAP_AGENT` environment variable.

#### Scenario: Agent command defaults to claude

- **GIVEN** the `ZAP_AGENT` environment variable is not set
- **WHEN** the CLI needs to determine the agent command
- **THEN** it uses `'claude'` as the default command name
- **AND** maintains backward compatibility with existing behavior

#### Scenario: Agent command respects ZAP_AGENT environment variable

- **GIVEN** the `ZAP_AGENT` environment variable is set to `'my-agent'`
- **WHEN** the CLI needs to determine the agent command
- **THEN** it uses `'my-agent'` as the command name
- **AND** applies this to all agent invocations

#### Scenario: Agent command utility function is exported

- **GIVEN** the utils/claude.ts module
- **WHEN** other modules need to determine the agent command
- **THEN** they can import and call `getAgentCommand()` function
- **AND** the function returns the configured agent command name
- **AND** the logic is centralized in one location

#### Scenario: Agent availability check uses configured command

- **GIVEN** the `ZAP_AGENT` environment variable is set to `'test-agent'`
- **WHEN** `checkClaudeAvailable()` is called
- **THEN** it attempts to spawn `'test-agent --version'` instead of `'claude --version'`
- **AND** validates the configured agent's availability

#### Scenario: Spec commands use configured agent

- **GIVEN** the `ZAP_AGENT` environment variable is set to `'custom-agent'`
- **WHEN** any spec command (propose, archive, apply) is executed
- **THEN** it spawns `'custom-agent'` instead of `'claude'`
- **AND** passes the appropriate arguments to the configured agent

#### Scenario: Error messages reflect configured agent

- **GIVEN** the `ZAP_AGENT` environment variable is set to `'my-agent'`
- **WHEN** the agent is not available and an error is displayed
- **THEN** the error message references the configured agent command name
- **AND** provides helpful context about which agent command failed

#### Scenario: Absolute paths work as agent commands

- **GIVEN** the `ZAP_AGENT` environment variable is set to `'/usr/local/bin/claude'`
- **WHEN** the CLI invokes the agent
- **THEN** it successfully executes the agent using the absolute path
- **AND** handles path-based agent commands correctly

## MODIFIED Requirements

### Requirement: Shared utilities extraction

The CLI MUST extract shared utilities into reusable modules.

#### Scenario: Agent command resolution is shared utility

- **GIVEN** multiple commands need to determine the agent command
- **WHEN** the codebase is organized
- **THEN** the agent command resolution logic is in `utils/claude.ts`
- **AND** provides `getAgentCommand()` function for reuse
- **AND** centralizes environment variable reading logic
- **AND** ensures consistent agent command usage across all commands
