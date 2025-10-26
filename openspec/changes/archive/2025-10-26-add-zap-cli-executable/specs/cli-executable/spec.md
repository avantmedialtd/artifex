# Spec: CLI Executable

## ADDED Requirements

### Requirement: Zap executable file exists

The project MUST provide an executable file that serves as the entry point for the `zap` command.

#### Scenario: Developer runs zap command

- **GIVEN** the developer has run `npm link` in the zap project directory
- **WHEN** they execute `zap` in their terminal
- **THEN** the executable file is invoked by the system
- **AND** it runs with Node.js as the interpreter

### Requirement: Executable uses Node.js shebang

The executable file MUST include a shebang line that invokes Node.js to run the script.

#### Scenario: Executable file is invoked directly

- **GIVEN** the executable file has execute permissions
- **WHEN** the file is executed
- **THEN** the shebang instructs the system to use the `node` interpreter
- **AND** the interpreter can locate node via the environment PATH

### Requirement: Execute TypeScript without build step

The executable MUST run TypeScript code (main.ts) directly without requiring a compilation/build step.

#### Scenario: Running TypeScript directly with vanilla Node.js

- **GIVEN** Node.js supports TypeScript execution (via experimental flags or import hooks)
- **WHEN** the zap command is executed
- **THEN** main.ts is loaded and executed
- **AND** no build artifacts are required
- **AND** no third-party dependencies like ts-node are needed

### Requirement: Package.json bin configuration

The package.json MUST declare the zap executable in the `bin` field to enable npm linking and installation.

#### Scenario: Developer links package locally

- **GIVEN** the package.json has a `bin` field pointing to the executable
- **WHEN** the developer runs `npm link`
- **THEN** npm creates a symlink to the executable in the global bin directory
- **AND** the `zap` command becomes available in the terminal

#### Scenario: Package is installed globally

- **GIVEN** the package.json has proper bin configuration
- **WHEN** a user runs `npm install -g zap`
- **THEN** the `zap` command is installed to their global bin directory
- **AND** it can be executed from anywhere

### Requirement: Executable works on POSIX systems

The executable MUST work on macOS and Linux systems with standard Node.js installations.

#### Scenario: Running on macOS

- **GIVEN** a developer is using macOS with Node.js installed
- **WHEN** they execute the `zap` command
- **THEN** the shebang resolves node correctly
- **AND** the command executes successfully

#### Scenario: Running on Linux

- **GIVEN** a developer is using Linux with Node.js installed
- **WHEN** they execute the `zap` command
- **THEN** the shebang resolves node correctly
- **AND** the command executes successfully

### Requirement: Executable works on Windows

The executable MUST work on Windows systems when installed via npm, which automatically generates a .cmd wrapper.

#### Scenario: Running on Windows

- **GIVEN** a developer is using Windows with Node.js installed
- **WHEN** they install the package via npm (link or global install)
- **THEN** npm creates a `zap.cmd` wrapper automatically
- **AND** the `zap` command executes successfully in cmd.exe or PowerShell

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
