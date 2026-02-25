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

The executable MUST run TypeScript code (main.ts) directly without requiring a compilation/build step. The `af` wrapper SHALL resolve the Bun binary from its own `node_modules` and spawn it to execute main.ts.

#### Scenario: Running TypeScript directly with Bun

- **GIVEN** the package is installed via npm (with the `bun` dependency resolved)
- **WHEN** the af command is executed
- **THEN** the wrapper locates the Bun binary from the `bun` dependency in node_modules
- **AND** main.ts is loaded and executed by Bun
- **AND** no build artifacts are required

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

### Requirement: Executable uses Node.js shebang with Bun launcher

The executable file MUST use a Node.js shebang (`#!/usr/bin/env node`) and act as a launcher that resolves and spawns the Bun binary from the package's own dependencies.

#### Scenario: Executable file is invoked directly

- **GIVEN** the executable file has execute permissions
- **WHEN** the file is executed
- **THEN** the shebang instructs the system to use the `node` interpreter
- **AND** the wrapper resolves the Bun binary via `require.resolve('bun/package.json')`
- **AND** spawns Bun with main.ts and all forwarded arguments

#### Scenario: Bun dependency is not installed

- **GIVEN** the `bun` dependency failed to install (e.g., unsupported platform)
- **WHEN** the af command is executed
- **THEN** the wrapper prints an error message indicating the Bun binary could not be found
- **AND** exits with a non-zero exit code

### Requirement: Signal forwarding to Bun process

The Node.js wrapper MUST forward SIGINT and SIGTERM signals to the spawned Bun child process for clean shutdown of Ink interactive components.

#### Scenario: User presses Ctrl+C during interactive command

- **GIVEN** an Ink interactive component is running (e.g., Select, Confirm)
- **WHEN** the user presses Ctrl+C
- **THEN** SIGINT is forwarded to the Bun child process
- **AND** Ink components unmount cleanly

### Requirement: Exit code forwarding

The Node.js wrapper MUST forward the exit code from the Bun child process.

#### Scenario: Command exits with success

- **WHEN** the Bun process exits with code 0
- **THEN** the wrapper process exits with code 0

#### Scenario: Command exits with error

- **WHEN** the Bun process exits with code 1
- **THEN** the wrapper process exits with code 1
