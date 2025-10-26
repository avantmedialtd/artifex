# spec-archive-cli Specification

## Purpose
TBD - created by archiving change add-spec-archive-command. Update Purpose after archive.
## Requirements
### Requirement: Spec command namespace exists

The zap CLI MUST support a `spec` command that serves as a namespace for OpenSpec-related utilities.

#### Scenario: Developer runs spec command without subcommand

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap spec` without a subcommand
- **THEN** the CLI displays an error message indicating a subcommand is required
- **AND** exits with a non-zero status code

### Requirement: Archive subcommand exists

The `spec` command MUST support an `archive` subcommand that archives a deployed OpenSpec change.

#### Scenario: Developer runs archive command with valid spec-id

- **GIVEN** the developer has Claude Code installed and in their PATH
- **AND** a valid spec-id exists (e.g., "add-user-auth")
- **WHEN** they execute `zap spec archive add-user-auth`
- **THEN** the CLI invokes `claude --permission-mode acceptEdits "/openspec:archive add-user-auth"`
- **AND** the Claude Code process executes the archive workflow
- **AND** the zap command exits with the same status code as the Claude process

### Requirement: Spec-id argument is required

The `archive` subcommand MUST require a spec-id argument and validate its presence.

#### Scenario: Developer runs archive without spec-id

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap spec archive` without providing a spec-id
- **THEN** the CLI displays an error message: "Error: spec archive requires a spec-id argument"
- **AND** shows usage information: "Usage: zap spec archive <spec-id>"
- **AND** exits with status code 1

### Requirement: Claude Code availability check

The archive command MUST verify that Claude Code is available before attempting to execute it.

#### Scenario: Claude Code is not installed

- **GIVEN** the `claude` command is not available in the user's PATH
- **WHEN** the developer executes `zap spec archive <spec-id>`
- **THEN** the CLI displays an error message: "Error: Claude Code CLI not found. Please install it first."
- **AND** exits with status code 1

#### Scenario: Claude Code is installed

- **GIVEN** the `claude` command is available in the user's PATH
- **WHEN** the developer executes `zap spec archive <spec-id>`
- **THEN** the CLI successfully invokes the claude command
- **AND** passes through all output from the Claude process

### Requirement: Command execution with correct arguments

The archive command MUST invoke Claude Code with the exact required flags and slash command syntax.

#### Scenario: Executing claude with proper arguments

- **GIVEN** the developer executes `zap spec archive my-change-id`
- **WHEN** the command is processed
- **THEN** the CLI executes: `claude --permission-mode acceptEdits "/openspec:archive my-change-id"`
- **AND** the permission-mode flag is set to "acceptEdits"
- **AND** the slash command includes the spec-id

### Requirement: Process output and exit code handling

The archive command MUST pass through the output from Claude Code and preserve its exit status.

#### Scenario: Claude Code succeeds

- **GIVEN** the Claude Code archive process completes successfully (exit code 0)
- **WHEN** the zap command finishes
- **THEN** all output from Claude is displayed to the user
- **AND** the zap command exits with status code 0

#### Scenario: Claude Code fails

- **GIVEN** the Claude Code archive process fails (non-zero exit code)
- **WHEN** the zap command finishes
- **THEN** all output and error messages from Claude are displayed to the user
- **AND** the zap command exits with the same non-zero status code

### Requirement: Error handling for unknown subcommands

The `spec` command MUST handle unknown subcommands gracefully.

#### Scenario: Developer uses unknown spec subcommand

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap spec unknown-command`
- **THEN** the CLI displays an error message: "Error: Unknown spec subcommand: unknown-command"
- **AND** exits with status code 1

