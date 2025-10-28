# no-args-help Specification Delta

## Target Specification
`cli-help-system`

## ADDED Requirements

### Requirement: CLI displays help when no arguments provided

When the user runs the CLI without any arguments, the system MUST display the help page with all available commands.

#### Scenario: User runs zap with no arguments

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap` with no arguments or options
- **THEN** the CLI displays the general help page
- **AND** the output is identical to running `zap help`
- **AND** shows all available commands with descriptions
- **AND** includes usage information and global options
- **AND** exits with status code 0

#### Scenario: No arguments shows standard help output

- **GIVEN** the developer executes `zap` without arguments
- **WHEN** the help page is displayed
- **THEN** the output includes a "USAGE" section showing `zap <command> [options]`
- **AND** includes a "COMMANDS" section listing all commands
- **AND** includes an "OPTIONS" section showing global flags like `--help, -h`
- **AND** includes a footer message: "Run 'zap help <command>' for more information on a command."

#### Scenario: Empty invocation is user-friendly

- **GIVEN** a new user runs `zap` for the first time
- **WHEN** they execute `zap` without knowing the available commands
- **THEN** they immediately see all available commands and how to use them
- **AND** can discover functionality without needing to know about `--help` flag
- **AND** the output provides clear next steps for learning more
