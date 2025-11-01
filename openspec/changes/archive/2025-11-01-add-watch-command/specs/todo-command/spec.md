## ADDED Requirements

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

## MODIFIED Requirements

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
