# jira-remote-links Specification

## Purpose
Remote link management — list, add, and remove URL-based links from Jira issues to external resources (Confluence pages, documents, websites).
## Requirements
### Requirement: Remote link display

The CLI SHALL display remote links when viewing a single issue with `af jira get`.

#### Scenario: Issue with remote links

- **GIVEN** issue PROJ-123 has remote links to "Design Document" and "External Spec"
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the output includes a "Remote Links" section
- **AND** each link shows its title and URL

#### Scenario: Issue with no remote links

- **GIVEN** issue PROJ-123 has no remote links
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the "Remote Links" section is omitted

#### Scenario: Remote links with JSON output

- **GIVEN** issue PROJ-123 has remote links
- **WHEN** the user runs `af jira get PROJ-123 --json`
- **THEN** the JSON output includes a `remoteLinks` field with the remote link data

### Requirement: List remote links

The CLI SHALL support listing remote links on an issue via `af jira remote-link`.

#### Scenario: List remote links

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 has remote links
- **WHEN** the user runs `af jira remote-link PROJ-123`
- **THEN** all remote links are displayed with their ID, title, and URL

#### Scenario: List remote links as JSON

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira remote-link PROJ-123 --json`
- **THEN** the remote links are output as JSON

#### Scenario: List remote links on issue with none

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 has no remote links
- **WHEN** the user runs `af jira remote-link PROJ-123`
- **THEN** a message indicates no remote links found

### Requirement: Add remote link

The CLI SHALL support adding a remote link to an issue.

#### Scenario: Add remote link with URL and title

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira remote-link PROJ-123 --url "https://example.com/doc" --title "Design Doc"`
- **THEN** a remote link is created on PROJ-123
- **AND** a success message is displayed

#### Scenario: Add remote link missing title

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira remote-link PROJ-123 --url "https://example.com"`
- **THEN** an error is displayed indicating --title is required
- **AND** the CLI exits with code 1

### Requirement: Remove remote link

The CLI SHALL support removing a remote link by its numeric ID.

#### Scenario: Remove remote link by ID

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 has a remote link with ID 10042
- **WHEN** the user runs `af jira remote-link PROJ-123 --remove 10042`
- **THEN** the remote link is deleted
- **AND** a success message is displayed

#### Scenario: Remove remote link missing issue key

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira remote-link --remove 10042`
- **THEN** an error is displayed indicating an issue key is required
- **AND** the CLI exits with code 1
