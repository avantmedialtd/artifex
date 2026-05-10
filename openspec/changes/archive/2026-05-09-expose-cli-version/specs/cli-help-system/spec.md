## ADDED Requirements

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
