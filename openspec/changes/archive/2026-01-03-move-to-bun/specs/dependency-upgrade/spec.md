# Dependency Upgrade Spec Delta

## ADDED Requirements

### Requirement: Bun Package Upgrade Command

The CLI SHALL provide a `bun upgrade` command that upgrades all outdated packages using Bun's package manager.

#### Scenario: Upgrade outdated packages with Bun

- **WHEN** user runs `af bun upgrade`
- **THEN** the CLI runs `bun outdated` to detect outdated packages
- **AND** upgrades each package using `bun add <package>@latest`
- **AND** displays upgrade results

#### Scenario: No outdated packages with Bun

- **WHEN** user runs `af bun upgrade` and all packages are up to date
- **THEN** the CLI displays a message indicating no upgrades needed

#### Scenario: Bun upgrade error handling

- **WHEN** user runs `af bun upgrade` and a package upgrade fails
- **THEN** the CLI displays an error message for the failed package
- **AND** continues upgrading remaining packages

### Requirement: Bun Command Routing

The CLI SHALL route `bun` commands to the appropriate handler.

#### Scenario: Bun without subcommand

- **WHEN** user runs `af bun` without a subcommand
- **THEN** the CLI displays an error requesting a subcommand
- **AND** suggests running `af help bun` for more information

#### Scenario: Invalid bun subcommand

- **WHEN** user runs `af bun <invalid>` with an unrecognized subcommand
- **THEN** the CLI displays an error for the unknown subcommand
