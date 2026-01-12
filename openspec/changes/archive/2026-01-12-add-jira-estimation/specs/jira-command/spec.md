# jira-command Specification Delta

## ADDED Requirements

### Requirement: Jira time tracking display

The CLI SHALL display time tracking information when viewing issues.

#### Scenario: Get issue with estimation

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 has time tracking configured
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the output includes Original Estimate, Remaining Estimate, and Time Spent fields
- **AND** values display in human-readable format (e.g., "2h 30m")

#### Scenario: Get issue without estimation

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 has no time tracking configured
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the output omits the estimation fields

#### Scenario: List issues with estimation column

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira list PROJ`
- **THEN** the table includes an Estimate column showing remaining estimate
- **AND** issues without estimates show "-" in the column

### Requirement: Jira time tracking on create

The CLI SHALL support setting initial time estimates when creating issues.

#### Scenario: Create issue with estimate

- **GIVEN** valid Jira credentials in environment
- **AND** time tracking is enabled for the project
- **WHEN** the user runs `af jira create --project PROJ --type Task --summary "Title" --estimate "4h"`
- **THEN** the issue is created with originalEstimate set to "4h"

#### Scenario: Create issue without estimate

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira create --project PROJ --type Task --summary "Title"`
- **THEN** the issue is created without time tracking values

### Requirement: Jira time tracking updates

The CLI SHALL support updating time tracking fields on existing issues.

#### Scenario: Update original estimate

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 exists
- **WHEN** the user runs `af jira update PROJ-123 --estimate "8h"`
- **THEN** the issue originalEstimate is updated to "8h"

#### Scenario: Update remaining estimate

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 exists
- **WHEN** the user runs `af jira update PROJ-123 --remaining "2h"`
- **THEN** the issue remainingEstimate is updated to "2h"

#### Scenario: Update both estimates

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 exists
- **WHEN** the user runs `af jira update PROJ-123 --estimate "8h" --remaining "4h"`
- **THEN** the issue originalEstimate is updated to "8h"
- **AND** the issue remainingEstimate is updated to "4h"

## MODIFIED Requirements

### Requirement: Help documentation

The CLI SHALL include jira commands in help output.

#### Scenario: General help includes jira

- **GIVEN** the user runs `af help`
- **THEN** jira commands are listed in the available commands

#### Scenario: Jira-specific help

- **GIVEN** the user runs `af help jira`
- **THEN** detailed jira command help is displayed
- **AND** all subcommands and options are documented
- **AND** the `--estimate` and `--remaining` options are documented for create and update commands
