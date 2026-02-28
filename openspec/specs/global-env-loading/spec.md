# global-env-loading Specification

## Purpose
TBD - created by archiving change integrate-jira-cli. Update Purpose after archive.
## Requirements
### Requirement: Load environment from current working directory

The CLI SHALL load environment variables from a `.env` file in the current working directory at startup.

#### Scenario: .env file exists in working directory

- **GIVEN** a `.env` file exists in the current working directory
- **WHEN** the CLI starts
- **THEN** environment variables from the file are loaded into `process.env`
- **AND** existing environment variables are not overwritten

#### Scenario: .env file does not exist

- **GIVEN** no `.env` file exists in the current working directory
- **WHEN** the CLI starts
- **THEN** the CLI continues without error
- **AND** no environment variables are modified

### Requirement: Parse standard .env format

The CLI SHALL parse `.env` files using standard format conventions.

#### Scenario: Key-value pairs are parsed

- **GIVEN** a `.env` file contains `KEY=value`
- **WHEN** the file is loaded
- **THEN** `process.env.KEY` is set to `value`

#### Scenario: Quoted values are handled

- **GIVEN** a `.env` file contains `KEY="value with spaces"`
- **WHEN** the file is loaded
- **THEN** `process.env.KEY` is set to `value with spaces` (quotes removed)

#### Scenario: Comments are ignored

- **GIVEN** a `.env` file contains lines starting with `#`
- **WHEN** the file is loaded
- **THEN** those lines are skipped

#### Scenario: Empty lines are ignored

- **GIVEN** a `.env` file contains empty lines
- **WHEN** the file is loaded
- **THEN** those lines are skipped without error

### Requirement: Environment loading is early in startup

The CLI SHALL load environment variables before command routing.

#### Scenario: Environment is available to all commands

- **GIVEN** a `.env` file sets `ATLASSIAN_BASE_URL=https://example.atlassian.net` (or legacy `JIRA_BASE_URL`)
- **WHEN** the user runs `af jira projects` or `af confluence spaces`
- **THEN** the command has access to the Atlassian configuration

