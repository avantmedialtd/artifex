# todo-command Specification

## Purpose
TBD - created by archiving change add-todo-command. Update Purpose after archive.
## Requirements
### Requirement: Top-level todo command

The CLI MUST support `todo` as a top-level command that displays all TODO items from active OpenSpec changes in a one-time execution mode (not watching).

#### Scenario: Developer views all todos

- **GIVEN** the developer has zap installed
- **AND** there are active OpenSpec changes in `openspec/changes/`
- **WHEN** they execute `zap todo`
- **THEN** the CLI displays all tasks from all active changes
- **AND** tasks are organized by change
- **AND** each task shows its checkbox status (checked/unchecked)
- **AND** the output uses visual formatting for readability
- **AND** the command exits after displaying (does not watch for changes)

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

### Requirement: Watch mode for continuous TODO display

The CLI MUST support a `watch` command that continuously monitors and displays TODO items from active OpenSpec changes in real-time.

#### Scenario: Developer starts watch mode

- **GIVEN** the developer has zap installed
- **AND** there are active OpenSpec changes in `openspec/changes/`
- **WHEN** they execute `zap watch`
- **THEN** the CLI clears the screen
- **AND** displays a header showing "Watching for changes..." with a timestamp
- **AND** displays the current TODO items (same format as `zap todo`)
- **AND** the process continues running until interrupted

#### Scenario: File changes trigger refresh

- **GIVEN** watch mode is running
- **WHEN** a `tasks.md` file is modified in any active change directory
- **THEN** the CLI detects the change within 200ms
- **AND** clears the screen
- **AND** refreshes the entire TODO display with updated content
- **AND** updates the timestamp in the header

#### Scenario: Multiple rapid changes are debounced

- **GIVEN** watch mode is running
- **WHEN** multiple file changes occur within 100ms (e.g., editor auto-save)
- **THEN** the CLI batches these events
- **AND** triggers only one screen refresh
- **AND** shows the final state after all changes settle

#### Scenario: New change directory is created

- **GIVEN** watch mode is running
- **WHEN** a new change directory with `tasks.md` is added to `openspec/changes/`
- **THEN** the CLI detects the new directory
- **AND** refreshes the display to include tasks from the new change

#### Scenario: Change directory is removed or archived

- **GIVEN** watch mode is running
- **WHEN** an active change directory is removed or moved to archive
- **THEN** the CLI detects the removal
- **AND** refreshes the display without the removed change's tasks

#### Scenario: Developer exits watch mode

- **GIVEN** watch mode is running
- **WHEN** the developer presses Ctrl+C
- **THEN** the CLI displays "Stopping watch mode..." message
- **AND** cleans up file watchers
- **AND** restores the terminal to normal state
- **AND** exits with status code 0

#### Scenario: No active changes in watch mode

- **GIVEN** watch mode is running
- **AND** there are no active changes (only archive/)
- **WHEN** the display refreshes
- **THEN** the CLI shows the header
- **AND** displays "No active changes found."
- **AND** continues watching for new changes

### Requirement: Watch mode display format

The watch command MUST display TODO items with a header that includes watch status and timing information.

#### Scenario: Display watch status header

- **GIVEN** watch mode is running
- **WHEN** the CLI displays TODO items
- **THEN** the header includes "📋 TODO Items (watching for changes...)"
- **AND** shows the current time or "Last updated: [timestamp]"
- **AND** optionally shows "Press Ctrl+C to exit" hint

#### Scenario: Visual separation from previous output

- **GIVEN** watch mode refreshes the display
- **WHEN** new content is rendered
- **THEN** the CLI clears the entire screen before displaying
- **AND** positions cursor at top-left (0,0)
- **AND** ensures no remnants of previous output remain

### Requirement: Watch mode file system monitoring

The watch command MUST efficiently monitor the `openspec/changes/` directory for relevant file changes.

#### Scenario: Monitor only relevant paths

- **GIVEN** watch mode is running
- **WHEN** the CLI sets up file watching
- **THEN** it monitors `openspec/changes/` and subdirectories
- **AND** it ignores changes in `openspec/changes/archive/`
- **AND** it ignores changes to non-task files (e.g., node_modules, .git)

#### Scenario: Efficient event-driven watching

- **GIVEN** watch mode is running
- **WHEN** no file changes occur
- **THEN** the CLI consumes minimal CPU resources (idle state)
- **AND** uses event-driven file watching (not polling)
- **AND** does not accumulate memory over time

#### Scenario: Handle file system errors gracefully

- **GIVEN** watch mode is running
- **WHEN** a file system error occurs (e.g., permission denied, directory deleted)
- **THEN** the CLI displays a warning message
- **AND** attempts to continue watching if possible
- **OR** exits gracefully with an error message if watching is impossible

### Requirement: Watch command routing and integration

The watch command MUST be properly integrated into the command routing system and help documentation.

#### Scenario: Router recognizes watch command

- **GIVEN** the developer executes `zap watch`
- **WHEN** the router processes the command
- **THEN** the router routes to the watch handler function
- **AND** the command executes without falling through to unknown command error

#### Scenario: Help includes watch command

- **GIVEN** the developer executes `zap help` or `zap --help`
- **WHEN** the help output is displayed
- **THEN** it includes "watch - Continuously show updated TODO items"
- **AND** the command is listed in the commands section

#### Scenario: Watch command help

- **GIVEN** the developer executes `zap help watch` or `zap watch --help`
- **THEN** the help output includes:
  - Description: "Continuously monitor and display TODO items from active changes"
  - Usage: "zap watch"
  - Details about how to exit (Ctrl+C)
  - Note about real-time file watching behavior

### Requirement: Watch mode rejects arguments

The `watch` command MUST NOT accept any arguments and MUST reject any provided arguments.

#### Scenario: Developer runs watch without arguments

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap watch` without any arguments
- **THEN** the command starts watch mode successfully
- **AND** begins monitoring for changes

#### Scenario: Developer provides unexpected arguments

- **GIVEN** the developer executes `zap watch some-argument`
- **WHEN** the command is processed
- **THEN** the CLI displays an error message: "Error: watch command does not accept arguments"
- **AND** shows usage information: "Usage: zap watch"
- **AND** exits with status code 1
- **AND** does not enter watch mode

