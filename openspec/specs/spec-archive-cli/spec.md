# spec-archive-cli Specification

## Purpose

TBD - created by archiving change add-spec-archive-command. Update Purpose after archive.
## Requirements
### Requirement: Spec command namespace exists

The zap CLI MUST support a `spec` command that serves as a namespace for OpenSpec-related utilities.

#### Scenario: Developer runs spec command without subcommand

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap spec` without a subcommand
- **THEN** the CLI displays an error message indicating a subcommand is required
- **AND** exits with a non-zero status code

### Requirement: Archive subcommand exists

The `spec` command MUST support an `archive` subcommand that archives a deployed OpenSpec change.

#### Scenario: Developer runs archive command with valid spec-id

- **GIVEN** the developer has Claude Code installed and in their PATH
- **AND** a valid spec-id exists (e.g., "add-user-auth")
- **WHEN** they execute `zap spec archive add-user-auth`
- **THEN** the CLI invokes `claude --permission-mode acceptEdits "/openspec:archive add-user-auth"`
- **AND** the Claude Code process executes the archive workflow
- **AND** the zap command exits with the same status code as the Claude process

### Requirement: Claude Code availability check

The archive command MUST verify that Claude Code is available before attempting to execute it.

#### Scenario: Claude Code is not installed

- **GIVEN** the `claude` command is not available in the user's PATH
- **WHEN** the developer executes `zap spec archive <spec-id>`
- **THEN** the CLI displays an error message: "Error: Claude Code CLI not found. Please install it first."
- **AND** exits with status code 1

#### Scenario: Claude Code is installed

- **GIVEN** the `claude` command is available in the user's PATH
- **WHEN** the developer executes `zap spec archive <spec-id>`
- **THEN** the CLI successfully invokes the claude command
- **AND** passes through all output from the Claude process

### Requirement: Command execution with correct arguments

The archive command MUST invoke Claude Code with the exact required flags and slash command syntax.

#### Scenario: Executing claude with proper arguments

- **GIVEN** the developer executes `zap spec archive my-change-id`
- **WHEN** the command is processed
- **THEN** the CLI executes: `claude --permission-mode acceptEdits "/openspec:archive my-change-id"`
- **AND** the permission-mode flag is set to "acceptEdits"
- **AND** the slash command includes the spec-id

### Requirement: Process output and exit code handling

The archive command MUST pass through the output from Claude Code and preserve its exit status.

#### Scenario: Claude Code succeeds

- **GIVEN** the Claude Code archive process completes successfully (exit code 0)
- **WHEN** the zap command finishes
- **THEN** all output from Claude is displayed to the user
- **AND** the zap command exits with status code 0

#### Scenario: Claude Code fails

- **GIVEN** the Claude Code archive process fails (non-zero exit code)
- **WHEN** the zap command finishes
- **THEN** all output and error messages from Claude are displayed to the user
- **AND** the zap command exits with the same non-zero status code

### Requirement: Error handling for unknown subcommands

The `spec` command MUST handle unknown subcommands gracefully.

#### Scenario: Developer uses unknown spec subcommand

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap spec unknown-command`
- **THEN** the CLI displays an error message: "Error: Unknown spec subcommand: unknown-command"
- **AND** exits with status code 1

### Requirement: Auto-commit after archive operation

The archive command MUST automatically commit the archived spec files after the `/openspec:archive` command completes successfully.

#### Scenario: Archive operation is committed automatically

- **GIVEN** the developer executes `zap spec archive add-cli-executable`
- **AND** the `/openspec:archive` command successfully archives the spec
- **AND** the archived proposal.md file's first line is "# Proposal: Add CLI executable"
- **WHEN** the Claude Code process completes successfully
- **THEN** the CLI stages all files in `openspec/specs/add-cli-executable/`
- **AND** creates a git commit with message "Archive: Add CLI executable"
- **AND** displays a success message: "Archive committed: Archive: Add CLI executable"
- **AND** the zap command exits with status code 0

#### Scenario: Commit message title extraction with "Proposal:" prefix

- **GIVEN** an archived proposal.md with first line "# Proposal: Add dependency upgrade command"
- **WHEN** the commit message is generated
- **THEN** the title "Add dependency upgrade command" is extracted
- **AND** the "Proposal: " prefix is stripped
- **AND** the commit message is "Archive: Add dependency upgrade command"

#### Scenario: Commit message title extraction without "Proposal:" prefix

- **GIVEN** an archived proposal.md with first line "# Show help on no args"
- **WHEN** the commit message is generated
- **THEN** the title "Show help on no args" is extracted
- **AND** the commit message is "Archive: Show help on no args"

### Requirement: Git commit failure handling for archive

The archive command MUST handle git commit failures gracefully and report clear warning messages without failing the overall operation.

#### Scenario: Archive git commit fails

- **GIVEN** the archive operation completes successfully
- **AND** the git commit command fails (e.g., due to git configuration issues)
- **WHEN** the commit fails
- **THEN** the CLI displays a warning message: "Warning: Failed to auto-commit archive: <error details>"
- **AND** displays guidance: "Archive completed but not committed. Please commit manually."
- **AND** the archive files remain uncommitted for manual intervention
- **AND** the zap command exits with status code 0 (archive succeeded even though commit failed)

#### Scenario: Archive title extraction fails

- **GIVEN** the archive operation completes successfully
- **AND** the proposal.md file cannot be found or has an unexpected format
- **WHEN** generating the commit message
- **THEN** the CLI displays a warning: "Warning: Could not extract archive title for auto-commit"
- **AND** displays guidance: "Archive completed but not committed. Please commit manually."
- **AND** the zap command exits with status code 0

### Requirement: Archive commit scope limitation

The automatic commit MUST only include files in the archived spec directory, not other uncommitted changes in the repository.

#### Scenario: Only archived spec files are committed

- **GIVEN** the developer has other uncommitted changes in the repository
- **AND** they execute `zap spec archive add-feature`
- **WHEN** the automatic commit is created
- **THEN** only files in `openspec/specs/add-feature/` are staged and committed
- **AND** other uncommitted changes remain unstaged
- **AND** the working directory state for non-archive files is unchanged

### Requirement: Spec-id argument is optional

The `archive` subcommand MUST accept an optional spec-id argument and handle multiple scenarios based on the number of ongoing changes.

#### Scenario: Spec-id provided

- **GIVEN** the developer executes `zap spec archive my-spec-id`
- **WHEN** the command is processed
- **THEN** the CLI passes the spec-id to the Claude slash command
- **AND** executes: `claude --permission-mode acceptEdits "/openspec:archive my-spec-id"`

#### Scenario: Spec-id omitted with zero ongoing changes

- **GIVEN** the developer executes `zap spec archive` without providing a spec-id
- **AND** there are no ongoing changes in `openspec/changes/`
- **WHEN** the command is processed
- **THEN** the CLI displays an error message: "No ongoing changes found"
- **AND** exits with status code 1

#### Scenario: Spec-id omitted with exactly one ongoing change

- **GIVEN** the developer executes `zap spec archive` without providing a spec-id
- **AND** there is exactly one ongoing change (e.g., "add-user-auth")
- **WHEN** the command is processed
- **THEN** the CLI auto-selects the single change
- **AND** displays a message: "Auto-selected change: add-user-auth"
- **AND** proceeds to invoke Claude with the selected spec-id

#### Scenario: Spec-id omitted with multiple ongoing changes

- **GIVEN** the developer executes `zap spec archive` without providing a spec-id
- **AND** there are multiple ongoing changes (more than one)
- **WHEN** the command is processed
- **THEN** the CLI displays an interactive selection menu listing all ongoing changes
- **AND** the user can navigate with arrow keys and select with Enter
- **AND** after selection, the CLI invokes Claude with the selected spec-id

### Requirement: Interactive change selection for archive

The archive command MUST provide an interactive selection interface when multiple ongoing changes exist and no spec-id is specified.

#### Scenario: Navigating the selection menu

- **GIVEN** the developer executes `zap spec archive` with multiple ongoing changes
- **WHEN** the interactive selection menu is displayed
- **THEN** each change is shown as a selectable option with its ID and status
- **AND** the user can use up/down arrow keys to navigate
- **AND** the currently highlighted option is visually distinct
- **AND** the prompt reads "Select a change to archive:"

#### Scenario: Selecting a change

- **GIVEN** the developer is viewing the interactive selection menu
- **WHEN** they press Enter on a highlighted change
- **THEN** the CLI proceeds with the selected spec-id
- **AND** invokes: `claude --permission-mode acceptEdits "/openspec:archive <selected-spec-id>"`

#### Scenario: Cancelling selection

- **GIVEN** the developer is viewing the interactive selection menu
- **WHEN** they press Ctrl+C or Escape
- **THEN** the CLI exits gracefully with status code 0
- **AND** no Claude process is spawned

