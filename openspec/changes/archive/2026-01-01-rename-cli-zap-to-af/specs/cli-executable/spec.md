## MODIFIED Requirements

### Requirement: Primary af executable file exists

The project MUST provide an executable file named `af` that serves as the primary entry point for the CLI.

#### Scenario: Developer runs af command

- **GIVEN** the developer has run `npm link` in the project directory
- **WHEN** they execute `af` in their terminal
- **THEN** the executable file is invoked by the system
- **AND** it runs with Node.js as the interpreter

### Requirement: Backwards-compatible zap alias exists

The project MUST provide an executable file named `zap` that works identically to `af` for backwards compatibility.

#### Scenario: Developer runs zap command (legacy alias)

- **GIVEN** the developer has run `npm link` in the project directory
- **WHEN** they execute `zap` in their terminal
- **THEN** the executable file is invoked by the system
- **AND** it produces identical output to running `af`

### Requirement: Package.json bin configuration

The package.json MUST declare both `af` and `zap` executables in the `bin` field to enable npm linking and installation.

#### Scenario: Developer links package locally

- **GIVEN** the package.json has a `bin` field pointing to both executables
- **WHEN** the developer runs `npm link`
- **THEN** npm creates symlinks to both executables in the global bin directory
- **AND** both `af` and `zap` commands become available in the terminal

#### Scenario: Package is installed globally

- **GIVEN** the package.json has proper bin configuration
- **WHEN** a user runs `npm install -g af`
- **THEN** both `af` and `zap` commands are installed to their global bin directory
- **AND** they can be executed from anywhere with identical behavior
