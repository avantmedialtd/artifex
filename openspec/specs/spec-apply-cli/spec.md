# spec-apply-cli Specification

## Purpose
TBD - created by archiving change add-apply-command. Update Purpose after archive.
## Requirements
### Requirement: Apply subcommand exists

The `spec` command MUST support an `apply` subcommand that applies an approved OpenSpec change.

#### Scenario: Developer runs apply command with change-id

- **GIVEN** the developer has Claude Code installed and in their PATH
- **AND** a valid change-id exists (e.g., "add-user-auth")
- **WHEN** they execute `zap spec apply add-user-auth`
- **THEN** the CLI invokes `claude --permission-mode acceptEdits "/openspec:apply add-user-auth"`
- **AND** the Claude Code process executes the apply workflow
- **AND** the zap command exits with the same status code as the Claude process

#### Scenario: Developer runs apply command without change-id

- **GIVEN** the developer has Claude Code installed and in their PATH
- **WHEN** they execute `zap spec apply` without providing a change-id
- **THEN** the CLI invokes `claude --permission-mode acceptEdits "/openspec:apply"`
- **AND** Claude Code prompts the user to select a change interactively
- **AND** the zap command exits with the same status code as the Claude process

### Requirement: Change-id argument is optional

The `apply` subcommand MUST accept an optional change-id argument and handle multiple scenarios based on the number of ongoing changes.

#### Scenario: Change-id provided

- **GIVEN** the developer executes `zap spec apply my-change-id`
- **WHEN** the command is processed
- **THEN** the CLI passes the change-id to the Claude slash command
- **AND** executes: `claude --permission-mode acceptEdits "/openspec:apply my-change-id"`

#### Scenario: Change-id omitted with zero ongoing changes

- **GIVEN** the developer executes `zap spec apply` without providing a change-id
- **AND** there are no ongoing changes in `openspec/changes/`
- **WHEN** the command is processed
- **THEN** the CLI displays an error message: "No ongoing changes found"
- **AND** exits with status code 1

#### Scenario: Change-id omitted with exactly one ongoing change

- **GIVEN** the developer executes `zap spec apply` without providing a change-id
- **AND** there is exactly one ongoing change (e.g., "add-user-auth")
- **WHEN** the command is processed
- **THEN** the CLI auto-selects the single change
- **AND** displays a message: "Auto-selected change: add-user-auth"
- **AND** proceeds to invoke Claude with the selected change-id

#### Scenario: Change-id omitted with multiple ongoing changes

- **GIVEN** the developer executes `zap spec apply` without providing a change-id
- **AND** there are multiple ongoing changes (more than one)
- **WHEN** the command is processed
- **THEN** the CLI displays an interactive selection menu listing all ongoing changes
- **AND** the user can navigate with arrow keys and select with Enter
- **AND** after selection, the CLI invokes Claude with the selected change-id

### Requirement: Claude Code availability check

The apply command MUST verify that Claude Code is available before attempting to execute it.

#### Scenario: Claude Code is not installed

- **GIVEN** the `claude` command is not available in the user's PATH
- **WHEN** the developer executes `zap spec apply [change-id]`
- **THEN** the CLI displays an error message: "Error: Claude Code CLI is not installed or not in PATH"
- **AND** displays help text: "Please install Claude Code from: https://claude.com/claude-code"
- **AND** exits with status code 1

#### Scenario: Claude Code is installed

- **GIVEN** the `claude` command is available in the user's PATH
- **WHEN** the developer executes `zap spec apply [change-id]`
- **THEN** the CLI successfully invokes the claude command
- **AND** passes through all output from the Claude process

### Requirement: Command execution with correct arguments

The apply command MUST invoke Claude Code with the exact required flags and slash command syntax.

#### Scenario: Executing claude with change-id

- **GIVEN** the developer executes `zap spec apply my-change-id`
- **WHEN** the command is processed
- **THEN** the CLI executes: `claude --permission-mode acceptEdits "/openspec:apply my-change-id"`
- **AND** the permission-mode flag is set to "acceptEdits"
- **AND** the slash command includes the change-id

#### Scenario: Executing claude without change-id

- **GIVEN** the developer executes `zap spec apply`
- **WHEN** the command is processed
- **THEN** the CLI executes: `claude --permission-mode acceptEdits "/openspec:apply"`
- **AND** the permission-mode flag is set to "acceptEdits"
- **AND** the slash command does not include a change-id

### Requirement: Process output and exit code handling

The apply command MUST pass through the output from Claude Code and preserve its exit status.

#### Scenario: Claude Code succeeds

- **GIVEN** the Claude Code apply process completes successfully (exit code 0)
- **WHEN** the zap command finishes
- **THEN** all output from Claude is displayed to the user
- **AND** the zap command exits with status code 0

#### Scenario: Claude Code fails

- **GIVEN** the Claude Code apply process fails (non-zero exit code)
- **WHEN** the zap command finishes
- **THEN** all output and error messages from Claude are displayed to the user
- **AND** the zap command exits with the same non-zero status code

### Requirement: Integration with existing spec command

The apply subcommand MUST integrate seamlessly with the existing spec command structure.

#### Scenario: Unknown spec subcommand handling still works

- **GIVEN** the apply subcommand has been added
- **WHEN** a developer executes `zap spec unknown-command`
- **THEN** the CLI displays an error message: "Error: Unknown spec subcommand: unknown-command"
- **AND** exits with status code 1

#### Scenario: Spec command without subcommand shows error

- **GIVEN** the apply subcommand has been added
- **WHEN** a developer executes `zap spec`
- **THEN** the CLI displays an error message: "Error: spec command requires a subcommand"
- **AND** suggests running 'zap help spec' for more information
- **AND** exits with status code 1

### Requirement: Interactive change selection

The apply command MUST provide an interactive selection interface when multiple ongoing changes exist and no change-id is specified.

#### Scenario: Navigating the selection menu

- **GIVEN** the developer executes `zap spec apply` with multiple ongoing changes
- **WHEN** the interactive selection menu is displayed
- **THEN** each change is shown as a selectable option with its ID and status
- **AND** the user can use up/down arrow keys to navigate
- **AND** the currently highlighted option is visually distinct

#### Scenario: Selecting a change

- **GIVEN** the developer is viewing the interactive selection menu
- **WHEN** they press Enter on a highlighted change
- **THEN** the CLI proceeds with the selected change-id
- **AND** invokes: `claude --permission-mode acceptEdits "/openspec:apply <selected-change-id>"`

#### Scenario: Cancelling selection

- **GIVEN** the developer is viewing the interactive selection menu
- **WHEN** they press Ctrl+C or Escape
- **THEN** the CLI exits gracefully with status code 0
- **AND** no Claude process is spawned

