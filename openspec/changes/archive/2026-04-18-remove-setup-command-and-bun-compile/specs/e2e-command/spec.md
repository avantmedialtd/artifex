## MODIFIED Requirements

### Requirement: E2E-CMD-003 Copy Reporter to Container

The E2E test script SHALL copy the `copy-prompt-reporter.ts` file from the project's `resources/` directory to the Docker container before running tests.

#### Scenario: Reporter copied from filesystem

- **Given** the user runs `af e2e`
- **When** Docker services are started
- **Then** the reporter is copied from `resources/copy-prompt-reporter.ts` to `e2e:/workspace/copy-prompt-reporter.ts`
- **And** tests use the reporter for output formatting

#### Scenario: Copy failure handling

- **Given** the reporter copy operation fails
- **When** the script attempts to run tests
- **Then** the script exits with error code 1
- **And** displays an error message indicating the copy failure
