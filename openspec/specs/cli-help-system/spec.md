# cli-help-system Specification

## Purpose
TBD - created by archiving change enhance-cli-ui. Update Purpose after archive.
## Requirements
### Requirement: Help command displays available commands

The CLI MUST provide a `help` command that displays all available commands with descriptions.

#### Scenario: Developer runs help command

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap help`
- **THEN** the CLI displays a formatted list of all available commands
- **AND** each command includes a brief description
- **AND** includes usage examples for common commands
- **AND** exits with status code 0

#### Scenario: Help shows command categories

- **GIVEN** the developer executes `zap help`
- **WHEN** the help output is displayed
- **THEN** commands are organized into logical groups (e.g., "Package Management", "Spec Management", "Version Management")
- **AND** the output includes a "USAGE" section showing the general command format
- **AND** the output includes an "OPTIONS" section showing global flags

### Requirement: Command-specific help

The CLI MUST provide detailed help for individual commands when requested.

#### Scenario: Developer requests help for specific command

- **GIVEN** the developer wants detailed information about the "npm upgrade" command
- **WHEN** they execute `zap help npm` or `zap help npm upgrade`
- **THEN** the CLI displays detailed help for that command
- **AND** includes the command description
- **AND** shows usage syntax
- **AND** provides examples
- **AND** exits with status code 0

#### Scenario: Help for unknown command

- **GIVEN** the developer requests help for a non-existent command
- **WHEN** they execute `zap help unknown-command`
- **THEN** the CLI displays an error message: "Error: Unknown command: unknown-command"
- **AND** suggests running `zap help` to see available commands
- **AND** exits with status code 1

### Requirement: Help flag support

The CLI MUST support `--help` and `-h` flags for displaying help information.

#### Scenario: Developer uses --help flag

- **GIVEN** the developer wants help for a command
- **WHEN** they execute `zap --help`
- **THEN** the CLI displays the same output as `zap help`
- **AND** exits with status code 0

#### Scenario: Developer uses -h flag

- **GIVEN** the developer wants help for a command
- **WHEN** they execute `zap -h`
- **THEN** the CLI displays the same output as `zap help`
- **AND** exits with status code 0

#### Scenario: Command-specific help flag

- **GIVEN** the developer wants help for a specific command
- **WHEN** they execute `zap npm --help` or `zap npm upgrade --help`
- **THEN** the CLI displays detailed help for that command
- **AND** the output matches `zap help npm upgrade`
- **AND** exits with status code 0

### Requirement: Help content accuracy

Help information MUST accurately reflect the current command behavior and options.

#### Scenario: Help includes all available commands

- **GIVEN** the CLI has commands: npm, spec, propose, archive, versions, help
- **WHEN** the developer executes `zap help`
- **THEN** all available commands are listed in the help output
- **AND** no obsolete or removed commands are shown

#### Scenario: Help shows correct usage syntax

- **GIVEN** the developer views help for a command
- **WHEN** the help text shows usage syntax
- **THEN** the syntax matches the actual command interface
- **AND** required arguments are clearly marked
- **AND** optional arguments are clearly indicated

### Requirement: Help output formatting

Help text MUST be well-formatted and easy to read in the terminal.

#### Scenario: Help uses visual hierarchy

- **GIVEN** the developer views help output
- **WHEN** the help text is displayed
- **THEN** section headers are visually distinct (e.g., "USAGE", "COMMANDS")
- **AND** command names are emphasized
- **AND** descriptions are properly aligned
- **AND** the output uses consistent indentation

#### Scenario: Help text fits terminal width

- **GIVEN** the developer views help in a standard terminal (80-120 columns)
- **WHEN** the help text is displayed
- **THEN** lines do not wrap awkwardly
- **AND** the text is readable without horizontal scrolling
- **AND** formatting remains intact

