## MODIFIED Requirements

### Requirement: Execute TypeScript without build step

The executable MUST run TypeScript code (main.ts) directly without requiring a compilation/build step. The `af` wrapper SHALL resolve the Bun binary from its own `node_modules` and spawn it to execute main.ts.

#### Scenario: Running TypeScript directly with Bun

- **GIVEN** the package is installed via npm (with the `bun` dependency resolved)
- **WHEN** the af command is executed
- **THEN** the wrapper locates the Bun binary from the `bun` dependency in node_modules
- **AND** main.ts is loaded and executed by Bun
- **AND** no build artifacts are required

### Requirement: Executable uses Bun shebang

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

## ADDED Requirements

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
