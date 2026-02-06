# stop-hook-command Specification

## Purpose
TBD - created by archiving change add-stop-hook-command. Update Purpose after archive.
## Requirements
### Requirement: Stop Hook Command

The system SHALL provide an `af stop-hook` command that conditionally runs E2E tests based on whether relevant files have changed.

#### Scenario: Source files changed

- **WHEN** git diff shows files changed outside ignored paths
- **THEN** the command SHALL run `af e2e` (or configured command)
- **AND** exit with code 0 if e2e passes
- **AND** exit with code 2 if e2e fails

#### Scenario: Only ignored paths changed

- **WHEN** git diff shows only files within ignored paths changed (e.g., `openspec/`)
- **THEN** the command SHALL skip e2e
- **AND** exit with code 0

#### Scenario: No changes detected

- **WHEN** git diff shows no changed files
- **THEN** the command SHALL skip e2e
- **AND** exit with code 0

#### Scenario: Default ignored paths

- **WHEN** no `af.json` configuration exists
- **THEN** the command SHALL ignore paths: `openspec/`

### Requirement: Configuration File

The system SHALL support an optional `af.json` configuration file in the project root for customizing stop-hook behavior.

#### Scenario: No config file

- **WHEN** `af.json` does not exist
- **THEN** the command SHALL use default values without error

#### Scenario: Custom ignored paths

- **WHEN** `af.json` contains `stopHook.ignoredPaths`
- **THEN** the command SHALL use those paths instead of defaults

#### Scenario: Custom command

- **WHEN** `af.json` contains `stopHook.command`
- **THEN** the command SHALL run that command instead of `af e2e`

#### Scenario: All settings optional

- **WHEN** `af.json` exists
- **THEN** all settings (`stopHook`, `ignoredPaths`, `command`) are optional
- **AND** missing settings use their default values

#### Scenario: Override behavior

- **WHEN** `af.json` specifies `ignoredPaths`
- **THEN** the command SHALL use only those paths (not merged with defaults)

### Requirement: File Change Detection

The system SHALL detect file changes from staged, unstaged, and untracked git states.

#### Scenario: Detect staged changes

- **WHEN** checking for changes
- **THEN** include files from `git diff --name-only --cached`

#### Scenario: Detect unstaged changes

- **WHEN** checking for changes
- **THEN** include files from `git diff --name-only`

#### Scenario: Detect untracked files

- **WHEN** checking for changes
- **THEN** include files from `git ls-files --others --exclude-standard`

#### Scenario: Combine changes

- **WHEN** staged, unstaged, and untracked files exist
- **THEN** combine and deduplicate the list before filtering

### Requirement: Help Integration

The system SHALL include stop-hook in the CLI help system.

#### Scenario: Command help

- **WHEN** user runs `af help stop-hook`
- **THEN** display usage information explaining the conditional e2e behavior

#### Scenario: Main help listing

- **WHEN** user runs `af help`
- **THEN** stop-hook SHALL appear in the command list

