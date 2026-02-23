## REMOVED Requirements

### Requirement: Backwards-compatible zap alias exists

**Reason**: The `zap` alias is no longer needed. The CLI is published under `@avantmedia/af` with `af` as the sole command.
**Migration**: Replace all `zap` usage with `af`.

### Requirement: Package.json bin configuration

**Reason**: Replaced by updated bin configuration that only declares `af`.
**Migration**: See new requirement below.

## ADDED Requirements

### Requirement: Package.json bin configuration

The `package.json` MUST declare only the `af` executable in the `bin` field.

#### Scenario: Package is installed globally via NPM

- **WHEN** a user runs `npm install -g @avantmedia/af`
- **THEN** npm creates a symlink for `af` in the global bin directory
- **AND** no `zap` command is created

#### Scenario: Developer links package locally

- **WHEN** a developer runs `bun link` in the project directory
- **THEN** the `af` command becomes available in the terminal
- **AND** no `zap` command is created

## MODIFIED Requirements

### Requirement: Executable works on Windows

The executable MUST work on Windows systems when installed via npm, which automatically generates a .cmd wrapper.

#### Scenario: Running on Windows

- **GIVEN** a developer is using Windows with Bun installed
- **WHEN** they install the package via npm (global install)
- **THEN** npm creates an `af.cmd` wrapper automatically
- **AND** the command executes successfully in cmd.exe or PowerShell
