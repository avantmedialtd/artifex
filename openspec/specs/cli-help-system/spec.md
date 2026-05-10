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

- **GIVEN** the CLI has commands including jenkins
- **WHEN** the developer executes `af help`
- **THEN** all available commands are listed in the help output including jenkins
- **AND** no obsolete or removed commands are shown

#### Scenario: Help shows correct usage syntax

- **GIVEN** the developer views help for a command
- **WHEN** the help text shows usage syntax
- **THEN** the syntax matches the actual command interface
- **AND** required arguments are clearly marked
- **AND** optional arguments are clearly indicated

#### Scenario: Jenkins-specific help

- **GIVEN** the user runs `af help jenkins`
- **THEN** detailed jenkins command help is displayed
- **AND** all subcommands and options are documented

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

### Requirement: Version flag

The CLI SHALL support a top-level `--version` flag (and short alias `-v`) that prints the installed version of `af` and exits with status code 0. The version string SHALL be the value declared in the package's `package.json`.

#### Scenario: Developer prints the version with the long flag

- **GIVEN** the developer has `af` installed
- **WHEN** they execute `af --version`
- **THEN** the CLI prints the version string declared in `package.json` followed by a newline
- **AND** no other output is written
- **AND** the CLI exits with status code 0

#### Scenario: Developer prints the version with the short flag

- **GIVEN** the developer has `af` installed
- **WHEN** they execute `af -v`
- **THEN** the CLI prints the version string declared in `package.json` followed by a newline
- **AND** no other output is written
- **AND** the CLI exits with status code 0

#### Scenario: Version flag is recognized before subcommand parsing

- **GIVEN** the developer has `af` installed
- **WHEN** they execute `af --version`
- **THEN** the CLI does not attempt to dispatch a subcommand
- **AND** does not emit any "unknown command" error

### Requirement: Version line in help banner

The CLI SHALL display the installed version at the top of the help banner emitted by `af help` and the no-args invocation. The version SHALL be sourced from the same value used by the `--version` flag.

#### Scenario: Help banner shows the version

- **GIVEN** the developer has `af` installed
- **WHEN** they execute `af help`
- **THEN** the first non-empty line of output reads `af v<version>` where `<version>` is the value declared in `package.json`
- **AND** the rest of the help banner is unchanged

#### Scenario: No-args invocation shows the version

- **GIVEN** the developer has `af` installed
- **WHEN** they execute `af` with no arguments
- **THEN** the help banner is displayed
- **AND** the first non-empty line of output reads `af v<version>` where `<version>` is the value declared in `package.json`

