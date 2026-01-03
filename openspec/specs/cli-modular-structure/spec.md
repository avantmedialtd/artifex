# cli-modular-structure Specification

## Purpose
TBD - created by archiving change enhance-cli-ui. Update Purpose after archive.
## Requirements
### Requirement: Command routing separation

The CLI MUST separate command routing logic from command implementation.

#### Scenario: Router handles command dispatching

- **GIVEN** the CLI receives arguments `zap npm upgrade`
- **WHEN** the router processes these arguments
- **THEN** it identifies the command as "npm upgrade"
- **AND** delegates to the appropriate command handler
- **AND** returns the exit code from the handler

#### Scenario: Router validates command structure

- **GIVEN** the CLI receives invalid arguments
- **WHEN** the router processes these arguments
- **THEN** it validates the command structure before delegation
- **AND** returns appropriate error messages for invalid commands
- **AND** exits with status code 1

### Requirement: Modular command structure

The CLI MUST organize command implementations into separate modules by functional area.

#### Scenario: NPM commands in separate module

- **GIVEN** the CLI has npm-related commands
- **WHEN** the codebase is organized
- **THEN** npm command handlers are in a dedicated module (e.g., commands/npm.ts)
- **AND** the module exports handler functions for npm commands
- **AND** the module can be tested independently

#### Scenario: Spec commands in separate module

- **GIVEN** the CLI has spec-related commands (propose, archive)
- **WHEN** the codebase is organized
- **THEN** spec command handlers are in a dedicated module (e.g., commands/spec.ts)
- **AND** the module exports handler functions for spec commands
- **AND** the module can be tested independently

#### Scenario: Versions commands in separate module

- **GIVEN** the CLI has versions-related commands (reset, push)
- **WHEN** the codebase is organized
- **THEN** versions command handlers are in a dedicated module (e.g., commands/versions.ts)
- **AND** the module exports handler functions for versions commands
- **AND** the module can be tested independently

### Requirement: Shared utilities extraction

The CLI MUST extract shared utilities into reusable modules.

#### Scenario: Agent command resolution is shared utility

- **GIVEN** multiple commands need to determine the agent command
- **WHEN** the codebase is organized
- **THEN** the agent command resolution logic is in `utils/claude.ts`
- **AND** provides `getAgentCommand()` function for reuse
- **AND** centralizes environment variable reading logic
- **AND** ensures consistent agent command usage across all commands

### Requirement: Main entry point simplification

The main.ts file MUST serve as a minimal entry point that delegates to the router.

#### Scenario: Main.ts delegates to router

- **GIVEN** the zap command is executed with arguments
- **WHEN** main.ts is invoked
- **THEN** it immediately delegates to the router with the arguments
- **AND** exits with the status code returned by the router
- **AND** contains minimal logic beyond delegation

#### Scenario: Main.ts size is reduced

- **GIVEN** the CLI has been refactored
- **WHEN** measuring the size of main.ts
- **THEN** it is significantly smaller than the original monolithic implementation
- **AND** contains primarily import statements and delegation logic
- **AND** is easy to understand at a glance

### Requirement: Command handler interface consistency

All command handler functions MUST follow a consistent interface pattern.

#### Scenario: Command handlers return exit codes

- **GIVEN** any command handler function
- **WHEN** the function completes execution
- **THEN** it returns a number representing the exit code
- **AND** returns 0 for success
- **AND** returns 1 (or other non-zero) for errors

#### Scenario: Command handlers are async

- **GIVEN** any command handler function
- **WHEN** the function is defined
- **THEN** it is declared as async
- **AND** returns a Promise<number>
- **AND** allows for asynchronous operations

### Requirement: Backward compatibility maintained

The modular refactoring MUST NOT change any existing command behavior or interfaces.

#### Scenario: All existing commands work identically

- **GIVEN** any command that existed before the refactoring
- **WHEN** a developer executes that command with the same arguments
- **THEN** it produces identical output to the pre-refactoring behavior
- **AND** accepts the same arguments
- **AND** has the same error conditions
- **AND** returns the same exit codes

#### Scenario: Integration tests pass without modification

- **GIVEN** integration tests existed before the refactoring
- **WHEN** the modular structure is implemented
- **THEN** all existing integration tests pass without modification
- **AND** test the same command behaviors
- **AND** validate the same outputs

### Requirement: Agent command configuration

The CLI MUST support configurable agent command names via the `ARTIFEX_AGENT` environment variable.

#### Scenario: Agent command defaults to claude

- **GIVEN** the `ARTIFEX_AGENT` environment variable is not set
- **WHEN** the CLI needs to determine the agent command
- **THEN** it uses `'claude'` as the default command name
- **AND** maintains backward compatibility with existing behavior

#### Scenario: Agent command respects ARTIFEX_AGENT environment variable

- **GIVEN** the `ARTIFEX_AGENT` environment variable is set to `'my-agent'`
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

- **GIVEN** the `ARTIFEX_AGENT` environment variable is set to `'test-agent'`
- **WHEN** `checkClaudeAvailable()` is called
- **THEN** it attempts to spawn `'test-agent --version'` instead of `'claude --version'`
- **AND** validates the configured agent's availability

#### Scenario: Spec commands use configured agent

- **GIVEN** the `ARTIFEX_AGENT` environment variable is set to `'custom-agent'`
- **WHEN** any spec command (propose, archive, apply) is executed
- **THEN** it spawns `'custom-agent'` instead of `'claude'`
- **AND** passes the appropriate arguments to the configured agent

#### Scenario: Error messages reflect configured agent

- **GIVEN** the `ARTIFEX_AGENT` environment variable is set to `'my-agent'`
- **WHEN** the agent is not available and an error is displayed
- **THEN** the error message references the configured agent command name
- **AND** provides helpful context about which agent command failed

#### Scenario: Absolute paths work as agent commands

- **GIVEN** the `ARTIFEX_AGENT` environment variable is set to `'/usr/local/bin/claude'`
- **WHEN** the CLI invokes the agent
- **THEN** it successfully executes the agent using the absolute path
- **AND** handles path-based agent commands correctly

