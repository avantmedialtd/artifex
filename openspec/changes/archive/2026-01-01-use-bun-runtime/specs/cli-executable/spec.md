# cli-executable

## ADDED Requirements

### Requirement: Executable uses Bun shebang

The executable file MUST include a shebang line that invokes Bun to run the script for fast TypeScript execution.

#### Scenario: Executable file is invoked directly

- **GIVEN** the executable file has execute permissions
- **WHEN** the file is executed
- **THEN** the shebang instructs the system to use the `bun` interpreter
- **AND** the interpreter can locate bun via the environment PATH

## MODIFIED Requirements

### Requirement: Execute TypeScript without build step

The executable MUST run TypeScript code (main.ts) directly without requiring a compilation/build step.

#### Scenario: Running TypeScript directly with Bun

- **GIVEN** Bun is installed on the system
- **WHEN** the af command is executed
- **THEN** main.ts is loaded and executed by Bun
- **AND** no build artifacts are required
- **AND** no third-party TypeScript loaders are needed

## REMOVED Requirements

### Requirement: Executable uses Node.js shebang

_Replaced by Bun shebang requirement._
