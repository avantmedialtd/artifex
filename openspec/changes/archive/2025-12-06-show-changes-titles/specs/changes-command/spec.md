## ADDED Requirements

### Requirement: Display proposal titles in changes output

The `zap changes` command MUST display proposal titles alongside change IDs to improve readability and help developers quickly identify what each change is about.

#### Scenario: Change with valid proposal title is displayed

- **GIVEN** a change directory `openspec/changes/add-feature` exists
- **AND** the file `openspec/changes/add-feature/proposal.md` contains a first line `# Add New Feature`
- **AND** the change has 3 completed tasks out of 5 total tasks
- **WHEN** the developer executes `zap changes`
- **THEN** the output displays: `Add New Feature (add-feature)     3/5 tasks`

#### Scenario: Change with "Proposal:" prefix in title

- **GIVEN** a change directory `openspec/changes/fix-bug` exists
- **AND** the file `openspec/changes/fix-bug/proposal.md` contains a first line `# Proposal: Fix Authentication Bug`
- **AND** the change has 1 completed task out of 3 total tasks
- **WHEN** the developer executes `zap changes`
- **THEN** the output displays: `Fix Authentication Bug (fix-bug)     1/3 tasks`
- **AND** the "Proposal: " prefix is stripped from the title

#### Scenario: Change without proposal.md falls back to ID only

- **GIVEN** a change directory `openspec/changes/legacy-change` exists
- **AND** no `proposal.md` file exists in the directory
- **AND** the change has 0 completed tasks out of 2 total tasks
- **WHEN** the developer executes `zap changes`
- **THEN** the output displays: `legacy-change     0/2 tasks`

#### Scenario: Change with empty proposal.md first line falls back to ID only

- **GIVEN** a change directory `openspec/changes/broken-change` exists
- **AND** the file `openspec/changes/broken-change/proposal.md` has an empty first line
- **AND** the change has 1 completed task out of 1 total task
- **WHEN** the developer executes `zap changes`
- **THEN** the output displays: `broken-change     1/1 tasks`

### Requirement: Changes output header

The `zap changes` command MUST display a header before the list of changes for consistency with `openspec list` output.

#### Scenario: Output includes Changes header

- **GIVEN** at least one active change exists
- **WHEN** the developer executes `zap changes`
- **THEN** the first line of output is `Changes:`
- **AND** each change is indented with two spaces below the header

### Requirement: No active changes message

The `zap changes` command MUST display a helpful message when no active changes exist.

#### Scenario: No active changes exist

- **GIVEN** the `openspec/changes` directory contains no change subdirectories (or only contains `archive/`)
- **WHEN** the developer executes `zap changes`
- **THEN** the output displays: `No active changes`
