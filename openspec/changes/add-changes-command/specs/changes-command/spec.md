# changes-command Specification

## Purpose

Provide a convenient shorthand command `zap changes` that lists all OpenSpec changes by executing `openspec list --changes`.

## ADDED Requirements

### Requirement: Top-level changes command

The CLI MUST support `changes` as a top-level command that executes `openspec list --changes`.

#### Scenario: Developer lists changes using shorthand

- **GIVEN** the developer has zap installed
- **AND** they want to view all OpenSpec changes
- **WHEN** they execute `zap changes`
- **THEN** the CLI executes the command: `openspec list --changes`
- **AND** displays the output from the openspec command
- **AND** exits with the same status code as the openspec process

#### Scenario: Changes command shows active changes

- **GIVEN** there are active OpenSpec changes in the openspec/changes/ directory
- **WHEN** the developer executes `zap changes`
- **THEN** the command displays a list of all changes with their task progress
- **AND** the format matches the output of `openspec list --changes`

### Requirement: Changes command requires no arguments

The `changes` command MUST NOT require any arguments and MUST reject any provided arguments.

#### Scenario: Developer runs changes without arguments

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap changes` without any arguments
- **THEN** the command executes successfully
- **AND** displays the list of changes
- **AND** exits with status code 0 (or the openspec command's exit code)

#### Scenario: Developer provides unexpected arguments

- **GIVEN** the developer executes `zap changes some-argument`
- **WHEN** the command is processed
- **THEN** the CLI displays an error message: "Error: changes command does not accept arguments"
- **AND** shows usage information: "Usage: zap changes"
- **AND** exits with status code 1

### Requirement: OpenSpec CLI availability check

The changes command MUST verify that the OpenSpec CLI is available before attempting to execute it.

#### Scenario: OpenSpec CLI is not installed

- **GIVEN** the `openspec` command is not available in the user's PATH
- **WHEN** the developer executes `zap changes`
- **THEN** the CLI displays an error message: "Error: openspec command is not installed or not in PATH"
- **AND** displays help text with installation instructions
- **AND** exits with status code 1

### Requirement: Help content for changes command

The help system MUST include documentation for the changes command.

#### Scenario: Developer views general help

- **GIVEN** the changes command has been added
- **WHEN** the developer executes `zap help` or `zap --help`
- **THEN** the help output includes a line: "changes                List all OpenSpec changes"
- **AND** the command is listed in the appropriate section

#### Scenario: Developer views command-specific help

- **GIVEN** the changes command has been added
- **WHEN** the developer executes `zap help changes` or `zap changes --help`
- **THEN** the help output includes:
  - Description: "List all OpenSpec changes"
  - Usage: "zap changes"
  - Example: "zap changes  # Show all active OpenSpec changes"

### Requirement: Process output and error handling

The changes command MUST properly handle the output and errors from the underlying openspec command.

#### Scenario: OpenSpec command succeeds

- **GIVEN** the openspec command executes successfully
- **WHEN** the developer runs `zap changes`
- **THEN** all stdout from openspec is displayed to the user
- **AND** all stderr from openspec is displayed to the user
- **AND** the exit code matches the openspec command's exit code

#### Scenario: OpenSpec command fails

- **GIVEN** the openspec command fails with an error
- **WHEN** the developer runs `zap changes`
- **THEN** the error output from openspec is displayed
- **AND** the zap command exits with the same non-zero status code

### Requirement: Command routing and integration

The changes command MUST be properly integrated into the command routing system.

#### Scenario: Router recognizes changes command

- **GIVEN** the developer executes `zap changes`
- **WHEN** the router processes the command
- **THEN** the router routes to the handleChanges function
- **AND** the command executes without falling through to unknown command error

#### Scenario: Unknown command handling remains functional

- **GIVEN** the changes command has been added
- **WHEN** a developer executes `zap unknown-command`
- **THEN** the CLI displays an error message: "Error: Unknown command: unknown-command"
- **AND** suggests running `zap help` for available commands
- **AND** exits with status code 1
