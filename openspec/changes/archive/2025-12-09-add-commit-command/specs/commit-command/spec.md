## ADDED Requirements

### Requirement: Commit command namespace exists

The zap CLI MUST support a `commit` command that serves as a namespace for commit-related utilities.

#### Scenario: Developer runs commit command without subcommand

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap commit` without a subcommand
- **THEN** the CLI treats it as `zap commit apply` (default subcommand)
- **AND** proceeds with the apply workflow

### Requirement: Commit apply subcommand exists

The `commit` command MUST support an `apply` subcommand that commits all changes with a message referencing the change title.

#### Scenario: Developer runs commit apply with valid change-id

- **GIVEN** a valid change-id exists (e.g., "add-user-auth")
- **AND** the change has a proposal.md with title "Add User Authentication"
- **WHEN** they execute `zap commit apply add-user-auth`
- **THEN** the CLI stages all changes with `git add -A`
- **AND** creates a commit with message "Apply: Add User Authentication"
- **AND** displays success message "Committed: Apply: Add User Authentication"
- **AND** exits with status code 0

#### Scenario: Developer runs commit apply without change-id (single change)

- **GIVEN** there is exactly one ongoing change "add-feature"
- **AND** the change has a proposal.md with title "Add New Feature"
- **WHEN** they execute `zap commit apply` without a change-id
- **THEN** the CLI auto-selects the single change
- **AND** displays "Auto-selected change: add-feature"
- **AND** creates a commit with message "Apply: Add New Feature"
- **AND** exits with status code 0

### Requirement: Change-id argument is optional

The `commit apply` subcommand MUST accept an optional change-id argument and handle multiple scenarios based on the number of ongoing changes.

#### Scenario: Change-id provided

- **GIVEN** the developer executes `zap commit apply my-change-id`
- **WHEN** the command is processed
- **THEN** the CLI uses the specified change-id to extract the proposal title
- **AND** commits with message "Apply: <title>"

#### Scenario: Change-id omitted with zero ongoing changes

- **GIVEN** the developer executes `zap commit apply` without providing a change-id
- **AND** there are no ongoing changes in `openspec/changes/`
- **WHEN** the command is processed
- **THEN** the CLI displays an error message: "No ongoing changes found"
- **AND** exits with status code 1

#### Scenario: Change-id omitted with exactly one ongoing change

- **GIVEN** the developer executes `zap commit apply` without providing a change-id
- **AND** there is exactly one ongoing change (e.g., "add-user-auth")
- **WHEN** the command is processed
- **THEN** the CLI auto-selects the single change
- **AND** displays a message: "Auto-selected change: add-user-auth"
- **AND** proceeds to commit with the selected change's title

#### Scenario: Change-id omitted with multiple ongoing changes

- **GIVEN** the developer executes `zap commit apply` without providing a change-id
- **AND** there are multiple ongoing changes (more than one)
- **WHEN** the command is processed
- **THEN** the CLI displays an interactive selection menu listing all ongoing changes
- **AND** the user can navigate with arrow keys and select with Enter
- **AND** after selection, the CLI commits with the selected change's title

### Requirement: Interactive change selection for commit

The commit apply command MUST provide an interactive selection interface when multiple ongoing changes exist and no change-id is specified.

#### Scenario: Navigating the selection menu

- **GIVEN** the developer executes `zap commit apply` with multiple ongoing changes
- **WHEN** the interactive selection menu is displayed
- **THEN** each change is shown as a selectable option with its ID and title
- **AND** the user can use up/down arrow keys to navigate
- **AND** the currently highlighted option is visually distinct
- **AND** the prompt reads "Select a change for commit message:"

#### Scenario: Selecting a change

- **GIVEN** the developer is viewing the interactive selection menu
- **WHEN** they press Enter on a highlighted change
- **THEN** the CLI proceeds with the selected change-id
- **AND** extracts the title and creates the commit

#### Scenario: Cancelling selection

- **GIVEN** the developer is viewing the interactive selection menu
- **WHEN** they press Ctrl+C or Escape
- **THEN** the CLI exits gracefully with status code 0
- **AND** no commit is created

### Requirement: Commit message format

The commit apply command MUST create commits with a standardized message format.

#### Scenario: Standard commit message format

- **GIVEN** a change with proposal.md first line "# Proposal: Add Dark Mode"
- **WHEN** the commit is created
- **THEN** the commit message is "Apply: Add Dark Mode"
- **AND** the "Proposal: " prefix is stripped from the title

#### Scenario: Commit message without Proposal prefix

- **GIVEN** a change with proposal.md first line "# Fix Authentication Bug"
- **WHEN** the commit is created
- **THEN** the commit message is "Apply: Fix Authentication Bug"

### Requirement: Shorthand commit command

The CLI MUST support `commit` as a shorthand for `commit apply`.

#### Scenario: Using shorthand commit command with change-id

- **GIVEN** the developer executes `zap commit my-change-id`
- **WHEN** the command is processed
- **THEN** it is treated as `zap commit apply my-change-id`
- **AND** the commit is created with the change's title

#### Scenario: Using shorthand commit command without change-id

- **GIVEN** the developer executes `zap commit`
- **WHEN** the command is processed
- **THEN** it is treated as `zap commit apply`
- **AND** follows the same change selection logic

### Requirement: Git commit failure handling

The commit apply command MUST handle git failures gracefully.

#### Scenario: Nothing to commit

- **GIVEN** there are no staged or unstaged changes in the repository
- **WHEN** the developer executes `zap commit apply my-change`
- **THEN** the CLI displays a message: "Nothing to commit"
- **AND** exits with status code 0

#### Scenario: Git commit fails

- **GIVEN** there are changes to commit
- **AND** the git commit command fails (e.g., due to git configuration issues)
- **WHEN** the commit fails
- **THEN** the CLI displays an error message: "Error: Failed to create commit: <error details>"
- **AND** exits with status code 1

### Requirement: Title extraction failure handling

The commit apply command MUST handle cases where the proposal title cannot be extracted.

#### Scenario: Change directory does not exist

- **GIVEN** the developer executes `zap commit apply non-existent-change`
- **AND** no directory exists at `openspec/changes/non-existent-change/`
- **WHEN** the command is processed
- **THEN** the CLI displays an error message: "Error: Change not found: non-existent-change"
- **AND** exits with status code 1

#### Scenario: Proposal.md does not exist

- **GIVEN** the change directory exists but has no proposal.md
- **WHEN** the commit is attempted
- **THEN** the CLI displays an error message: "Error: Could not extract title from proposal.md"
- **AND** exits with status code 1

### Requirement: Help content for commit command

The help system MUST include documentation for the commit command.

#### Scenario: Developer views general help

- **GIVEN** the commit command has been added
- **WHEN** the developer executes `zap help` or `zap --help`
- **THEN** the help output includes lines for both:
  - "commit apply [id]       Commit changes with change title"
  - "commit [id]             Shorthand for 'commit apply'"

#### Scenario: Developer views command-specific help

- **GIVEN** the commit command has been added
- **WHEN** the developer executes `zap help commit`
- **THEN** the help output includes:
  - Description: "Commit changes with the change title as message"
  - Usage: "zap commit [apply] [change-id]"
  - Examples showing both explicit and shorthand usage
