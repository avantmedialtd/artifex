# Code Linting Capability

This spec defines the requirements for adding OXLint-based static code analysis to the zap development utility project.

## ADDED Requirements

### Requirement: OXLint package installation

The project MUST include OXLint as a development dependency to provide fast TypeScript/JavaScript static analysis.

#### Scenario: Developer installs dependencies

- When a developer runs `npm install` in the project
- Then OXLint should be installed in node_modules
- And the developer should be able to run `npx oxlint --version`
- And the version command should complete successfully

#### Scenario: OXLint dependency in package.json

- When examining the package.json file
- Then `oxlint` should be listed in devDependencies
- And the version should be a stable release (not pre-release)

### Requirement: Lint command availability

The project MUST provide npm script commands for running code linting operations.

#### Scenario: Basic lint command

- When a developer runs `npm run lint`
- Then OXLint should analyze the source code files
- And return appropriate exit codes (0 for clean, non-zero for violations)
- And display violations in readable format

#### Scenario: Lint with auto-fix

- When a developer runs `npm run lint:fix`
- Then OXLint should fix automatically resolvable issues
- And preserve code semantics and formatting
- And report any remaining violations that require manual attention

#### Scenario: Comprehensive lint check

- When a developer runs `npm run lint:check`
- Then OXLint should analyze all relevant files in the project
- And respect configured ignore patterns
- And provide complete violation reporting

### Requirement: TypeScript and ES modules support

The linting configuration MUST be compatible with the project's TypeScript and ES modules setup.

#### Scenario: TypeScript file analysis

- When OXLint analyzes TypeScript files (.ts)
- Then it should understand TypeScript syntax and types
- And not generate false positives for valid TypeScript code
- And detect TypeScript-specific issues (unused imports, type errors, etc.)

#### Scenario: ES modules compatibility

- When OXLint analyzes files using ES module syntax
- Then it should correctly handle import/export statements
- And understand module resolution patterns
- And not flag valid ES module code as violations

### Requirement: Performance characteristics

The linting process MUST complete quickly to maintain developer productivity.

#### Scenario: Fast execution on current codebase

- When running `npm run lint` on the current project files
- Then the command should complete in under 2 seconds
- And provide immediate feedback for development workflows

#### Scenario: Incremental linting performance

- When running linting repeatedly during development
- Then subsequent runs should leverage caching where possible
- And maintain fast feedback cycles

### Requirement: Configuration and customization

The project MUST have appropriate linting rules configured for its code style and requirements.

#### Scenario: Project-appropriate rule set

- When OXLint analyzes the codebase
- Then it should use rules suitable for CLI/utility development
- And align with existing code patterns and style
- And avoid overly restrictive rules that impede productivity

#### Scenario: Ignored files and directories

- When running linting commands
- Then node_modules directory should be excluded
- And test fixtures should be excluded where appropriate
- And generated/build artifacts should be excluded

#### Scenario: Custom rule configuration

- When the project has specific linting requirements
- Then these should be configurable via oxlint.json or package.json
- And overrides should be documented and justified
- And configuration should be version-controlled

### Requirement: Integration with existing toolchain

The linting setup MUST work harmoniously with existing development tools.

#### Scenario: Prettier compatibility

- When both Prettier and OXLint are run on the same files
- Then they should not conflict or contradict each other
- And code formatting should remain consistent
- And linting should focus on logic/quality rather than style

#### Scenario: Vitest compatibility

- When running tests with `npm test`
- Then linting should not interfere with test execution
- And test files should be linted appropriately
- And test-specific patterns should be handled correctly

### Requirement: Clean codebase compliance

The existing codebase MUST pass linting without violations after implementation.

#### Scenario: Zero violations on current code

- When running `npm run lint` on the existing codebase
- Then the command should exit with code 0
- And display no linting violations
- And confirm all files are compliant

#### Scenario: Maintainable linting standards

- When new code is added to the project
- Then linting should catch common issues and anti-patterns
- And provide helpful guidance for resolution
- And maintain code quality standards over time
