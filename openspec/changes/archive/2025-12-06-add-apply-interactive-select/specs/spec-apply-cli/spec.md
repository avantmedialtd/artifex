# spec-apply-cli Specification Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
