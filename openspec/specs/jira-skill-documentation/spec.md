# jira-skill-documentation Specification

## Purpose
TBD - created by archiving change update-jira-skill-cli-path. Update Purpose after archive.
## Requirements
### Requirement: Jira skill references af command

The jira skill documentation SHALL reference `af jira` as the CLI command for all Jira operations.

#### Scenario: Command invocation format

- **GIVEN** a user reads the jira skill documentation
- **WHEN** they follow the documented command syntax
- **THEN** all commands use the format `af jira <subcommand> [options]`
- **AND** no references to `./scripts/jira/jira.ts` exist

### Requirement: Environment setup instructions

The jira skill documentation SHALL provide correct environment variable setup instructions.

#### Scenario: Environment variable configuration

- **GIVEN** a user wants to configure Jira credentials
- **WHEN** they follow the setup instructions
- **THEN** they are instructed to set environment variables in their project's `.env` file
- **AND** the preferred variables are `ATLASSIAN_BASE_URL`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_API_TOKEN`
- **AND** legacy variables `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` are also supported

