# todo-command Specification Delta

## ADDED Requirements

### Requirement: Top-level todo command

The CLI MUST support `todo` as a top-level command that displays all TODO items from active OpenSpec changes.

#### Scenario: Developer views all todos

- **GIVEN** the developer has zap installed
- **AND** there are active OpenSpec changes in `openspec/changes/`
- **WHEN** they execute `zap todo`
- **THEN** the CLI displays all tasks from all active changes
- **AND** tasks are organized by change
- **AND** each task shows its checkbox status (checked/unchecked)
- **AND** the output uses visual formatting for readability

#### Scenario: No active changes exist

- **GIVEN** the `openspec/changes/` directory exists but has no active changes (only archive/)
- **WHEN** the developer executes `zap todo`
- **THEN** the CLI displays: "No active changes found."
- **AND** exits with status code 0

### Requirement: Task parsing from tasks.md files

The todo command MUST parse tasks from `tasks.md` files in each active change directory.

#### Scenario: Parse standard markdown checkboxes

- **GIVEN** a `tasks.md` file contains markdown checkbox items like `- [ ] Task name` and `- [x] Completed task`
- **WHEN** the todo command reads the file
- **THEN** it identifies all checkbox items
- **AND** tracks which items are checked vs unchecked
- **AND** preserves the task description text

#### Scenario: Handle nested task lists

- **GIVEN** a `tasks.md` file contains nested tasks with sub-items
- **WHEN** the todo command parses the file
- **THEN** it displays all checkbox items at all nesting levels
- **AND** preserves indentation to show hierarchy

#### Scenario: Parse section headers

- **GIVEN** a `tasks.md` file contains markdown headers like `## Implementation Tasks`
- **WHEN** the todo command parses the file
- **THEN** it identifies section headers
- **AND** displays them to group related tasks

### Requirement: Visual formatting with checkboxes and colors

The todo command MUST display tasks with visually appealing formatting using ANSI colors and Unicode symbols.

#### Scenario: Display task checkboxes with symbols

- **GIVEN** tasks have different completion states
- **WHEN** the todo command displays them
- **THEN** unchecked tasks show with `☐` (empty box) symbol
- **AND** checked tasks show with `☑` (checked box) symbol
- **AND** symbols are easily distinguishable

#### Scenario: Display change headers with borders

- **GIVEN** multiple changes have tasks
- **WHEN** the todo command displays them
- **THEN** each change is displayed in a bordered section
- **AND** the change ID is shown in the header
- **AND** task completion count is shown (e.g., "3/10 tasks completed")
- **AND** borders use box-drawing characters for visual separation

#### Scenario: Use colors for visual hierarchy

- **GIVEN** the terminal supports ANSI colors
- **WHEN** the todo command displays tasks
- **THEN** section headers are displayed in a distinct color (cyan)
- **AND** change names are displayed in blue
- **AND** task completion counts are displayed in gray
- **AND** colors use the existing `utils/output.ts` color palette

### Requirement: Task completion counting

The todo command MUST calculate and display task completion statistics for each change.

#### Scenario: Count completed vs total tasks

- **GIVEN** a change has 5 total tasks with 3 checked and 2 unchecked
- **WHEN** the todo command displays the change
- **THEN** it shows "3/5 tasks completed" in the change header
- **AND** the count includes all checkbox items in the tasks.md file

#### Scenario: All tasks completed

- **GIVEN** a change has all tasks checked
- **WHEN** the todo command displays the change
- **THEN** it shows "X/X tasks completed" where X is the total count
- **AND** optionally displays a visual indicator of completion (like a checkmark)

### Requirement: Error handling for missing or invalid files

The todo command MUST handle missing, empty, or malformed `tasks.md` files gracefully.

#### Scenario: Change directory missing tasks.md

- **GIVEN** an active change directory exists but has no `tasks.md` file
- **WHEN** the todo command processes that change
- **THEN** it displays the change name
- **AND** shows a message: "No tasks.md found"
- **AND** continues processing other changes

#### Scenario: Empty tasks.md file

- **GIVEN** a `tasks.md` file exists but contains no content or no checkbox items
- **WHEN** the todo command parses it
- **THEN** it displays the change name
- **AND** shows a message: "No tasks found"
- **AND** continues processing other changes

#### Scenario: Malformed markdown content

- **GIVEN** a `tasks.md` file contains invalid markdown or unexpected format
- **WHEN** the todo command parses it
- **THEN** it attempts to extract any recognizable checkbox items
- **AND** displays whatever tasks it can identify
- **AND** does not crash or exit with error

### Requirement: Command requires no arguments

The `todo` command MUST NOT require any arguments and MUST reject any provided arguments.

#### Scenario: Developer runs todo without arguments

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap todo` without any arguments
- **THEN** the command executes successfully
- **AND** displays all todos from active changes
- **AND** exits with status code 0

#### Scenario: Developer provides unexpected arguments

- **GIVEN** the developer executes `zap todo some-argument`
- **WHEN** the command is processed
- **THEN** the CLI displays an error message: "Error: todo command does not accept arguments"
- **AND** shows usage information: "Usage: zap todo"
- **AND** exits with status code 1

### Requirement: Help content for todo command

The help system MUST include documentation for the todo command.

#### Scenario: Developer views general help

- **GIVEN** the todo command has been added
- **WHEN** the developer executes `zap help` or `zap --help`
- **THEN** the help output includes: "todo                   Show all TODO items from active changes"
- **AND** the command is listed in the commands section

#### Scenario: Developer views command-specific help

- **GIVEN** the todo command has been added
- **WHEN** the developer executes `zap help todo` or `zap todo --help`
- **THEN** the help output includes:
  - Description: "Show all TODO items from active OpenSpec changes"
  - Usage: "zap todo"
  - Details: "Displays all tasks from tasks.md files in openspec/changes/"
  - Example: "zap todo  # Show all pending tasks across all changes"

### Requirement: Performance for typical projects

The todo command MUST execute quickly for typical project sizes.

#### Scenario: Fast execution with multiple changes

- **GIVEN** a project has 5-10 active changes
- **AND** each change has a tasks.md file with 10-20 tasks
- **WHEN** the developer executes `zap todo`
- **THEN** the command completes in under 100 milliseconds
- **AND** displays all tasks without noticeable delay

### Requirement: Command routing and integration

The todo command MUST be properly integrated into the command routing system.

#### Scenario: Router recognizes todo command

- **GIVEN** the developer executes `zap todo`
- **WHEN** the router processes the command
- **THEN** the router routes to the handleTodo function
- **AND** the command executes without falling through to unknown command error
