## MODIFIED Requirements

### Requirement: Production dependencies are correct

The `package.json` MUST only list runtime dependencies in `dependencies`. Development-only packages MUST be in `devDependencies`. The `bun` package MUST be included as a runtime dependency to provide the Bun runtime for TypeScript execution.

#### Scenario: react-devtools-core is a dev dependency

- **WHEN** the published package is inspected
- **THEN** `react-devtools-core` is in `devDependencies`, not `dependencies`

#### Scenario: bun is a runtime dependency

- **WHEN** the published package is inspected
- **THEN** `bun` is in `dependencies`
- **AND** `ink` and `react` remain in `dependencies`

## ADDED Requirements

### Requirement: Node.js engine requirement

The `package.json` MUST specify a minimum Node.js version of 16 or higher in the `engines` field, since the wrapper only requires basic Node.js features (`child_process.spawn`, `require.resolve`).

#### Scenario: User installs with Node.js 16+

- **GIVEN** the user has Node.js 16 or higher installed
- **WHEN** they run `npm install -g @avantmedia/af`
- **THEN** npm does not emit engine compatibility warnings
- **AND** the wrapper script executes successfully
