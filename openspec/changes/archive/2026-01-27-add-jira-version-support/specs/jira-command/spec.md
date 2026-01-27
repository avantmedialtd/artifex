## ADDED Requirements

### Requirement: Jira version listing

The CLI SHALL support listing project versions (releases).

#### Scenario: List project versions

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira versions PROJ`
- **THEN** all versions for the project are displayed in a table
- **AND** the table shows version name, status (released/unreleased), release date, and description

#### Scenario: List versions as JSON

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira versions PROJ --json`
- **THEN** the versions are output as JSON array

#### Scenario: Project has no versions

- **GIVEN** valid Jira credentials in environment
- **AND** project PROJ has no versions configured
- **WHEN** the user runs `af jira versions PROJ`
- **THEN** a message indicates no versions found

### Requirement: Jira version details

The CLI SHALL support viewing detailed version information.

#### Scenario: Get version details by ID

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira version 12345`
- **THEN** the version details are displayed in markdown format
- **AND** the output includes name, description, release status, start date, and release date

#### Scenario: Get version as JSON

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira version 12345 --json`
- **THEN** the version is output as JSON

### Requirement: Jira version creation

The CLI SHALL support creating new project versions.

#### Scenario: Create version with required fields

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira version-create --project PROJ --name "v1.0.0"`
- **THEN** a new version is created in the project
- **AND** the version ID is displayed

#### Scenario: Create version with all options

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira version-create --project PROJ --name "v2.0.0" --description "Major release" --start-date 2024-01-01 --release-date 2024-06-01 --released`
- **THEN** a new version is created with all specified properties

#### Scenario: Create version missing required fields

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira version-create --project PROJ`
- **THEN** an error is displayed indicating --name is required
- **AND** the CLI exits with code 1

### Requirement: Jira version updates

The CLI SHALL support updating existing versions.

#### Scenario: Update version name

- **GIVEN** valid Jira credentials in environment
- **AND** version 12345 exists
- **WHEN** the user runs `af jira version-update 12345 --name "v1.0.1"`
- **THEN** the version name is updated

#### Scenario: Mark version as released

- **GIVEN** valid Jira credentials in environment
- **AND** version 12345 exists and is unreleased
- **WHEN** the user runs `af jira version-update 12345 --released`
- **THEN** the version is marked as released

#### Scenario: Mark version as unreleased

- **GIVEN** valid Jira credentials in environment
- **AND** version 12345 exists and is released
- **WHEN** the user runs `af jira version-update 12345 --unreleased`
- **THEN** the version is marked as unreleased

#### Scenario: Update version release date

- **GIVEN** valid Jira credentials in environment
- **AND** version 12345 exists
- **WHEN** the user runs `af jira version-update 12345 --release-date 2024-12-01`
- **THEN** the version release date is updated

### Requirement: Jira version deletion

The CLI SHALL support deleting versions.

#### Scenario: Delete version

- **GIVEN** valid Jira credentials in environment
- **AND** version 12345 exists
- **WHEN** the user runs `af jira version-delete 12345`
- **THEN** the version is deleted

#### Scenario: Delete version with move options

- **GIVEN** valid Jira credentials in environment
- **AND** version 12345 exists with associated issues
- **WHEN** the user runs `af jira version-delete 12345 --move-fix-issues-to 67890 --move-affected-issues-to 67890`
- **THEN** the version is deleted
- **AND** fix version issues are moved to version 67890
- **AND** affected version issues are moved to version 67890

### Requirement: Jira issue fix versions

The CLI SHALL support setting fix versions on issues.

#### Scenario: Create issue with fix version

- **GIVEN** valid Jira credentials in environment
- **AND** version "v1.0.0" exists in project PROJ
- **WHEN** the user runs `af jira create --project PROJ --type Bug --summary "Fix bug" --fix-version "v1.0.0"`
- **THEN** the issue is created with fixVersions set to ["v1.0.0"]

#### Scenario: Create issue with multiple fix versions

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira create --project PROJ --type Bug --summary "Fix bug" --fix-version "v1.0.0,v1.1.0"`
- **THEN** the issue is created with fixVersions set to ["v1.0.0", "v1.1.0"]

#### Scenario: Update issue fix versions

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 exists
- **WHEN** the user runs `af jira update PROJ-123 --fix-version "v2.0.0"`
- **THEN** the issue fixVersions is updated to ["v2.0.0"]

#### Scenario: Clear issue fix versions

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 has fix versions set
- **WHEN** the user runs `af jira update PROJ-123 --fix-version ""`
- **THEN** the issue fixVersions is cleared

### Requirement: Jira issue affected versions

The CLI SHALL support setting affected versions on issues.

#### Scenario: Create issue with affected version

- **GIVEN** valid Jira credentials in environment
- **AND** version "v0.9.0" exists in project PROJ
- **WHEN** the user runs `af jira create --project PROJ --type Bug --summary "Bug found" --affected-version "v0.9.0"`
- **THEN** the issue is created with affectedVersions set to ["v0.9.0"]

#### Scenario: Update issue affected versions

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 exists
- **WHEN** the user runs `af jira update PROJ-123 --affected-version "v0.8.0,v0.9.0"`
- **THEN** the issue affectedVersions is updated to ["v0.8.0", "v0.9.0"]

### Requirement: Jira version display in issues

The CLI SHALL display version information when viewing issues.

#### Scenario: Get issue with fix versions

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 has fixVersions set to ["v1.0.0", "v1.1.0"]
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the output includes "Fix Versions: v1.0.0, v1.1.0"

#### Scenario: Get issue with affected versions

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 has affectedVersions set to ["v0.9.0"]
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the output includes "Affected Versions: v0.9.0"

#### Scenario: Get issue without versions

- **GIVEN** valid Jira credentials in environment
- **AND** issue PROJ-123 has no fix or affected versions
- **WHEN** the user runs `af jira get PROJ-123`
- **THEN** the version fields are omitted from output

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
- **AND** the version management commands are documented (versions, version, version-create, version-update, version-delete)
- **AND** the `--fix-version` and `--affected-version` options are documented for create and update commands
