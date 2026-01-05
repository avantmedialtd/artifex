## ADDED Requirements

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
