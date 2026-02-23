# cli-executable Specification

## Purpose

Defines the primary CLI executable (`af`) for the development utility.

## Requirements

### Requirement: Primary af executable file exists

The project MUST provide an executable file named `af` that serves as the primary entry point for the CLI.

#### Scenario: Developer runs af command

- **GIVEN** the developer has run `npm link` in the project directory
- **WHEN** they execute `af` in their terminal
- **THEN** the executable file is invoked by the system
- **AND** it runs with Node.js as the interpreter

### Requirement: Execute TypeScript without build step

The executable MUST run TypeScript code (main.ts) directly without requiring a compilation/build step.

#### Scenario: Running TypeScript directly with Bun

- **GIVEN** Bun is installed on the system
- **WHEN** the af command is executed
- **THEN** main.ts is loaded and executed by Bun
- **AND** no build artifacts are required
- **AND** no third-party TypeScript loaders are needed

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

### Requirement: Executable works on POSIX systems

The executable MUST work on macOS and Linux systems with standard Node.js installations.

#### Scenario: Running on macOS

- **GIVEN** a developer is using macOS with Node.js installed
- **WHEN** they execute the `af` command
- **THEN** the shebang resolves node correctly
- **AND** the command executes successfully

#### Scenario: Running on Linux

- **GIVEN** a developer is using Linux with Node.js installed
- **WHEN** they execute the `af` command
- **THEN** the shebang resolves node correctly
- **AND** the command executes successfully

### Requirement: Executable works on Windows

The executable MUST work on Windows systems when installed via npm, which automatically generates a .cmd wrapper.

#### Scenario: Running on Windows

- **GIVEN** a developer is using Windows with Bun installed
- **WHEN** they install the package via npm (global install)
- **THEN** npm creates an `af.cmd` wrapper automatically
- **AND** the command executes successfully in cmd.exe or PowerShell

### Requirement: Executable has correct permissions

The executable file MUST have execute permissions set appropriately for the system.

#### Scenario: Executable file permissions are set

- **GIVEN** the executable file exists in the repository
- **WHEN** the file is checked into git
- **THEN** it has execute permissions (755 or similar)
- **AND** git preserves these permissions across clones

#### Scenario: NPM preserves executable permissions

- **GIVEN** the package is installed via npm
- **WHEN** npm creates the executable symlink or copies the file
- **THEN** the file retains execute permissions
- **AND** can be executed directly

### Requirement: Executable uses Bun shebang

The executable file MUST include a shebang line that invokes Bun to run the script for fast TypeScript execution.

#### Scenario: Executable file is invoked directly

- **GIVEN** the executable file has execute permissions
- **WHEN** the file is executed
- **THEN** the shebang instructs the system to use the `bun` interpreter
- **AND** the interpreter can locate bun via the environment PATH
