## MODIFIED Requirements

### Requirement: Environment loading is early in startup

The CLI SHALL load environment variables before command routing.

#### Scenario: Environment is available to all commands

- **GIVEN** a `.env` file sets `ATLASSIAN_BASE_URL=https://example.atlassian.net` (or legacy `JIRA_BASE_URL`)
- **WHEN** the user runs `af jira projects` or `af confluence spaces`
- **THEN** the command has access to the Atlassian configuration
