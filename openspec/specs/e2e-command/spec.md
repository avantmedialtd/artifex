# e2e-command Specification

## Purpose
TBD - created by archiving change add-e2e-command. Update Purpose after archive.
## Requirements
### Requirement: E2E-CMD-001 Run E2E tests

The `af e2e` command SHALL execute the E2E test suite in a fresh Docker environment with full isolation.

#### Scenario: Run all tests with defaults

- **Given** Docker is available
- **When** the user runs `af e2e`
- **Then** the command spawns `scripts/e2e_tests.ts`
- **And** streams output to the terminal
- **And** returns the exit code from the test runner

#### Scenario: Pass arguments to test runner

- **Given** Docker is available
- **When** the user runs `af e2e npm run e2e -- --grep "booking"`
- **Then** the arguments are passed through to the test script
- **And** only matching tests are executed

### Requirement: E2E-CMD-002 Help integration

The `e2e` command SHALL be discoverable through the CLI help system.

#### Scenario: Show command in general help

- **Given** the user runs `af help`
- **Then** the output includes `e2e` in the COMMANDS section
- **And** shows a brief description of the command

#### Scenario: Show command-specific help

- **Given** the user runs `af help e2e` or `af e2e --help`
- **Then** the output shows the command description, usage, and examples

### Requirement: E2E-CMD-003 Copy Reporter to Container

The E2E test script SHALL copy the embedded `copy-prompt-reporter.ts` file to the Docker container before running tests.

#### Scenario: Reporter copied in development mode

- **Given** the user runs `af e2e` from source
- **When** Docker services are started
- **Then** the reporter is copied from `resources/copy-prompt-reporter.ts` to `e2e:/workspace/copy-prompt-reporter.ts`
- **And** tests use the reporter for output formatting

#### Scenario: Reporter copied in compiled mode

- **Given** the user runs `af e2e` from compiled binary
- **When** Docker services are started
- **Then** the reporter is extracted from the embedded bundle to a temp file
- **And** the temp file is copied to `e2e:/workspace/copy-prompt-reporter.ts`
- **And** tests use the reporter for output formatting

#### Scenario: Copy failure handling

- **Given** the reporter copy operation fails
- **When** the script attempts to run tests
- **Then** the script exits with error code 1
- **And** displays an error message indicating the copy failure

