## MODIFIED Requirements

### Requirement: E2E-CMD-001 Run E2E tests

The `af e2e` command SHALL execute the E2E test suite in a fresh Docker environment with full isolation, and SHALL return an exit code derived from the run verdict (E2E-CMD-005) rather than the raw child process exit code.

#### Scenario: Run all tests with defaults

- **Given** Docker is available
- **When** the user runs `af e2e`
- **Then** the command spawns `scripts/e2e_tests.ts`
- **And** streams output to the terminal
- **And** returns an exit code derived from the run verdict (E2E-CMD-005)

#### Scenario: Pass arguments to test runner

- **Given** Docker is available
- **When** the user runs `af e2e npm run e2e -- --grep "booking"`
- **Then** the arguments are passed through to the test script
- **And** only matching tests are executed

## ADDED Requirements

### Requirement: E2E-CMD-004 Reporter emits a result summary

The bundled reporter (`resources/copy-prompt-reporter.ts`) SHALL persist its accumulated test tally to a machine-readable `e2e-summary.json` file in the container workspace when the run ends, and the E2E test script SHALL copy that file out of the container alongside the HTML report.

#### Scenario: Summary written on run completion

- **Given** the suite has run to completion inside the container
- **When** the reporter's end-of-run hook fires
- **Then** it writes `e2e-summary.json` containing the counts `{ passed, failed, timedOut, skipped }`

#### Scenario: Summary copied out of the container

- **Given** a run has produced `e2e-summary.json` in the container workspace
- **When** the script copies test artifacts back to the host
- **Then** it removes any stale `./e2e-summary.json` before copying
- **And** copies the container's `e2e-summary.json` to the host

#### Scenario: Reporter write failure does not abort the run

- **Given** writing `e2e-summary.json` fails (e.g. a read-only workspace)
- **When** the reporter's end-of-run hook fires
- **Then** the Playwright process still terminates normally
- **And** the absent summary is handled by the verdict's fail-closed rule (E2E-CMD-005)

### Requirement: E2E-CMD-005 Verdict cross-checks the reporter summary

The E2E test script SHALL determine the run verdict from a pure function of the child exit code and the parsed summary, reporting success only when both signals agree, and SHALL drive both the printed summary banner and the returned exit code from that verdict.

#### Scenario: Pass requires agreement

- **Given** the child exit code is `0`
- **And** a summary is present with `failed + timedOut === 0`
- **Then** the verdict is PASS
- **And** the banner shows success and the command returns `0`

#### Scenario: Reporter failures override a zero exit code

- **Given** the child exit code is `0`
- **And** the summary reports one or more failed or timed-out tests
- **Then** the verdict is FAIL
- **And** the banner shows failure and the command returns a non-zero exit code

#### Scenario: Non-zero exit code always fails

- **Given** the child exit code is non-zero
- **When** the verdict is computed
- **Then** the verdict is FAIL regardless of the summary contents

#### Scenario: Missing summary fails closed

- **Given** no `e2e-summary.json` could be read (missing, unreadable, or unparseable)
- **When** the verdict is computed
- **Then** the verdict is FAIL
- **And** the output states that the result cross-check could not be performed
