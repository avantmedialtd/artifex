## MODIFIED Requirements

### Requirement: Lazy credential validation

The CLI SHALL validate Atlassian credentials only when jira commands are executed. Credentials are read from `ATLASSIAN_*` environment variables with fallback to legacy `JIRA_*` variables.

#### Scenario: Missing credentials with jira command

- **GIVEN** neither Atlassian nor Jira credentials are set in environment
- **WHEN** the user runs `af jira projects`
- **THEN** an error is displayed indicating missing configuration
- **AND** the error lists both `ATLASSIAN_*` and legacy `JIRA_*` variable names
- **AND** the CLI exits with code 1

#### Scenario: Missing credentials with other commands

- **GIVEN** Atlassian credentials are not set in environment
- **WHEN** the user runs `af help`
- **THEN** the command succeeds without error
- **AND** no credential-related errors are displayed
