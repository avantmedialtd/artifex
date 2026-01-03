# jira-command Specification

## Purpose
TBD - created by archiving change integrate-jira-cli. Update Purpose after archive.
## Requirements
### Requirement: Jira command routing

The CLI SHALL route `af jira <subcommand>` to appropriate Jira handlers.

#### Scenario: Jira command with subcommand

- **GIVEN** the user runs `af jira get PROJ-123`
- **WHEN** the router processes the command
- **THEN** it delegates to the jira command handler
- **AND** passes `get` as the subcommand and `PROJ-123` as an argument

#### Scenario: Jira command without subcommand shows help

- **GIVEN** the user runs `af jira`
- **WHEN** the router processes the command
- **THEN** it displays jira-specific help information

### Requirement: Jira issue operations

The CLI SHALL support core issue operations via subcommands.

#### Scenario: Get issue details

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the issue details are displayed in markdown format

#### Scenario: List project issues

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira list PROJ`
- **THEN** issues from the project are displayed as a table

#### Scenario: Search with JQL

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira search "assignee = currentUser()"`
- **THEN** matching issues are displayed

#### Scenario: Create issue

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira create --project PROJ --type Bug --summary "Title"`
- **THEN** a new issue is created and the key is displayed

#### Scenario: Update issue

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira update PROJ-123 --summary "New title"`
- **THEN** the issue is updated

#### Scenario: Delete issue

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira delete PROJ-123`
- **THEN** the issue is deleted

### Requirement: Jira comment operations

The CLI SHALL support comment operations on issues.

#### Scenario: List comments

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment PROJ-123`
- **THEN** comments on the issue are displayed

#### Scenario: Add comment

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment PROJ-123 --add "Comment text"`
- **THEN** the comment is added to the issue

### Requirement: Jira workflow operations

The CLI SHALL support workflow transition operations.

#### Scenario: List available transitions

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira transitions PROJ-123`
- **THEN** available status transitions are displayed

#### Scenario: Transition issue status

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira transition PROJ-123 --to "In Progress"`
- **THEN** the issue status is changed

### Requirement: Jira assignment operations

The CLI SHALL support issue assignment operations.

#### Scenario: Assign issue to user

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira assign PROJ-123 --to user@example.com`
- **THEN** the issue is assigned to the specified user

#### Scenario: Unassign issue

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira assign PROJ-123 --to none`
- **THEN** the issue is unassigned

### Requirement: Jira project information

The CLI SHALL support project discovery operations.

#### Scenario: List projects

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira projects`
- **THEN** available projects are displayed

#### Scenario: List issue types

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira types PROJ`
- **THEN** issue types for the project are displayed

### Requirement: Jira file attachments

The CLI SHALL support attaching files to issues.

#### Scenario: Attach file to issue

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira attach PROJ-123 ./file.pdf`
- **THEN** the file is attached to the issue

### Requirement: JSON output option

The CLI SHALL support JSON output for programmatic use.

#### Scenario: JSON output for issue

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira get PROJ-123 --json`
- **THEN** the issue is output as JSON instead of markdown

### Requirement: Lazy credential validation

The CLI SHALL validate Jira credentials only when jira commands are executed.

#### Scenario: Missing credentials with jira command

- **GIVEN** Jira credentials are not set in environment
- **WHEN** the user runs `af jira projects`
- **THEN** an error is displayed indicating missing configuration
- **AND** the CLI exits with code 1

#### Scenario: Missing credentials with other commands

- **GIVEN** Jira credentials are not set in environment
- **WHEN** the user runs `af help`
- **THEN** the command succeeds without error
- **AND** no Jira-related errors are displayed

### Requirement: Help documentation

The CLI SHALL include jira commands in help output.

#### Scenario: General help includes jira

- **GIVEN** the user runs `af help`
- **THEN** jira commands are listed in the available commands

#### Scenario: Jira-specific help

- **GIVEN** the user runs `af help jira`
- **THEN** detailed jira command help is displayed
- **AND** all subcommands and options are documented

