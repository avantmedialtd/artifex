# atlassian-shared-config Specification

## Purpose

Shared authentication, ADF conversion, and configuration infrastructure used by both Jira and Confluence CLI commands.

## Requirements

### Requirement: Shared Atlassian authentication

The CLI SHALL provide shared authentication configuration for all Atlassian services.

#### Scenario: Configuration with ATLASSIAN variables

- **GIVEN** environment has `ATLASSIAN_BASE_URL`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_API_TOKEN`
- **WHEN** any Atlassian command is executed
- **THEN** authentication uses the `ATLASSIAN_*` values

#### Scenario: Fallback to JIRA variables

- **GIVEN** environment has `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN`
- **AND** `ATLASSIAN_*` variables are not set
- **WHEN** any Atlassian command is executed
- **THEN** authentication uses the `JIRA_*` values

#### Scenario: ATLASSIAN variables take precedence

- **GIVEN** environment has both `ATLASSIAN_*` and `JIRA_*` variables set
- **WHEN** any Atlassian command is executed
- **THEN** the `ATLASSIAN_*` values are used

#### Scenario: Missing credentials error

- **GIVEN** neither `ATLASSIAN_*` nor `JIRA_*` variables are set
- **WHEN** an Atlassian command is executed
- **THEN** an error is displayed listing the required `ATLASSIAN_*` variables
- **AND** the error mentions all three legacy `JIRA_*` variable names as alternatives

### Requirement: Shared ADF conversion

The CLI SHALL provide shared ADF (Atlassian Document Format) converters used by both Jira and Confluence.

#### Scenario: Markdown to ADF conversion

- **GIVEN** markdown text with headings, lists, bold, italic, code, and links
- **WHEN** `textToAdf()` is called
- **THEN** a valid ADF document is returned with corresponding node types

#### Scenario: ADF to markdown conversion

- **GIVEN** a valid ADF document
- **WHEN** `adfToText()` is called
- **THEN** markdown text is returned preserving headings, lists, and inline formatting

#### Scenario: Null or undefined ADF input

- **GIVEN** null or undefined input
- **WHEN** `adfToText()` is called
- **THEN** an empty string is returned

### Requirement: Trailing slash normalization

The shared configuration SHALL normalize the base URL.

#### Scenario: Trailing slash is stripped

- **GIVEN** `ATLASSIAN_BASE_URL` is set to `https://example.atlassian.net/`
- **WHEN** the configuration is loaded
- **THEN** `baseUrl` is `https://example.atlassian.net` (no trailing slash)
