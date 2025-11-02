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

### Requirement: Watch mode status bar display

The watch command MUST display a status bar at the bottom of the output showing aggregated project metrics, progress, and idle status warnings.

#### Scenario: Status bar shows project overview

- **GIVEN** watch mode is running with active changes
- **WHEN** the display is rendered
- **THEN** a status bar is displayed at the bottom (after all task lists)
- **AND** the status bar shows the project name derived from the parent folder of `process.cwd()`
- **AND** the status bar shows the number of active changes
- **AND** the status bar shows total task count across all active changes
- **AND** the status bar shows completed task count across all active changes
- **AND** the status bar uses box-drawing characters for visual separation
- **AND** if idle for more than 60 seconds, displays an idle warning indicator

#### Scenario: Status bar shows idle warning after 60 seconds

- **GIVEN** watch mode is running
- **AND** no file system changes have been detected for more than 60 seconds
- **WHEN** the display is rendered
- **THEN** the status bar includes a warning indicator showing "⚠ IDLE" or similar
- **AND** the warning uses yellow/warning color from the `utils/output.ts` palette
- **AND** the warning is positioned prominently in the status line (e.g., after the progress bar)
- **AND** the warning provides context like "No changes detected for 1m 23s"

#### Scenario: Status bar clears idle warning on new change

- **GIVEN** watch mode is showing the idle warning
- **WHEN** a new file system change is detected (e.g., tasks.md is modified)
- **THEN** the display refreshes immediately
- **AND** the idle warning is removed from the status bar
- **AND** the timestamp updates to show the time of the latest change
- **AND** the idle timer resets to zero

### Requirement: Status bar progress visualization

The watch mode status bar MUST display a visual progress bar showing overall task completion percentage.

#### Scenario: Progress bar with visual blocks

- **GIVEN** the status bar is being rendered
- **AND** there are tasks with some completion
- **WHEN** the progress bar is displayed
- **THEN** it uses Unicode block characters (█ for completed, ░ for incomplete)
- **AND** the bar length is proportional to terminal width (or fixed at reasonable width like 20 characters)
- **AND** the visual bar accurately represents the completion percentage

#### Scenario: Progress bar with percentage text

- **GIVEN** the status bar is being rendered
- **WHEN** the progress bar is displayed
- **THEN** it includes a percentage value (e.g., "75%")
- **AND** the percentage is calculated as (completedTasks / totalTasks * 100)
- **AND** the percentage is displayed near or within the progress bar

#### Scenario: All tasks completed

- **GIVEN** all tasks across all changes are checked
- **WHEN** the status bar is displayed
- **THEN** the progress bar shows 100% completion
- **AND** the visual bar is completely filled
- **AND** optionally uses a distinct color (green) to indicate completion

#### Scenario: No tasks present

- **GIVEN** there are active changes but no tasks defined
- **WHEN** the status bar is displayed
- **THEN** the progress bar shows "0%" or "N/A"
- **AND** no visual bar is displayed, or an empty bar is shown

### Requirement: Status bar visual formatting

The status bar MUST use colors and formatting consistent with the existing watch mode display.

#### Scenario: Status bar uses box-drawing characters

- **GIVEN** the status bar is being rendered
- **WHEN** displayed
- **THEN** it uses a top border with box-drawing characters (e.g., ┌─────┐)
- **AND** uses consistent border style matching the change display boxes
- **AND** creates clear visual separation from task lists above

#### Scenario: Status bar uses color scheme

- **GIVEN** the terminal supports ANSI colors
- **WHEN** the status bar is displayed
- **THEN** project name uses cyan color (consistent with section headers)
- **AND** numeric values use gray color (consistent with metadata display)
- **AND** progress bar uses colors from the existing palette in `utils/output.ts`
- **AND** completed progress uses green color
- **AND** incomplete progress uses gray color

#### Scenario: Status bar layout and spacing

- **GIVEN** the status bar is being rendered
- **WHEN** displayed
- **THEN** information is laid out in a single bordered section
- **AND** includes the format: "Project: [name] | [N] changes | [X/Y] tasks | [progress bar] [%]"
- **AND** uses appropriate spacing for readability
- **AND** fits within typical terminal widths (80-120 characters)

### Requirement: Project name extraction

The watch mode MUST extract and display the project name from the current working directory.

#### Scenario: Extract parent folder name

- **GIVEN** the watch command is running in `/Users/dev/my-project`
- **WHEN** the status bar is rendered
- **THEN** the project name displayed is "my-project"
- **AND** the name is derived from the last component of `process.cwd()`

#### Scenario: Handle edge cases for project name

- **GIVEN** the watch command is running in a root directory or unusual path
- **WHEN** extracting the project name
- **THEN** it handles the edge case gracefully (e.g., uses "root" or the full path)
- **AND** does not crash or display undefined/null

### Requirement: Status bar metrics calculation

The watch mode MUST accurately calculate and display aggregated task metrics across all active changes.

#### Scenario: Aggregate tasks from multiple changes

- **GIVEN** watch mode is running
- **AND** there are 3 active changes with 5, 10, and 8 tasks respectively
- **WHEN** the status bar is rendered
- **THEN** it shows "3 changes in progress"
- **AND** shows total tasks as 23 (5 + 10 + 8)
- **AND** completed count is the sum of all checked tasks across all changes

#### Scenario: Handle changes with no tasks

- **GIVEN** some active changes have no tasks.md or empty tasks
- **WHEN** calculating metrics
- **THEN** those changes are counted in "changes in progress"
- **AND** contribute 0 to the total task count
- **AND** do not cause errors in calculation

#### Scenario: Real-time metric updates

- **GIVEN** watch mode is displaying the status bar
- **WHEN** a task is checked in any change
- **THEN** the completed count increments by 1
- **AND** the total count remains the same
- **AND** the percentage updates accordingly
- **WHEN** a new task is added to a tasks.md file
- **THEN** the total count increments
- **AND** metrics update to reflect the new total

### Requirement: Track time since last file system change

The watch command MUST track the time elapsed since the last detected file system change to determine idle state.

#### Scenario: Initialize timer on watch start

- **GIVEN** the developer executes `zap watch`
- **WHEN** watch mode starts
- **THEN** the last change timestamp is set to the current time
- **AND** the idle timer begins counting from zero
- **AND** no idle warning is displayed initially

#### Scenario: Reset timer on file change

- **GIVEN** watch mode is running
- **WHEN** any file change is detected in `openspec/changes/` (excluding archive)
- **THEN** the last change timestamp is updated to the current time
- **AND** the idle timer resets to zero
- **AND** the idle warning (if displayed) is cleared

#### Scenario: Calculate idle duration

- **GIVEN** watch mode is running
- **WHEN** the display is refreshed (either by timer or file change)
- **THEN** the system calculates elapsed time as (current time - last change timestamp)
- **AND** uses this duration to determine whether to show the idle warning
- **AND** formats the duration in human-readable format (e.g., "1m 23s", "2m 5s")

### Requirement: Display idle warning when idle threshold exceeded

The watch command MUST display a visual warning indicator in the status bar when no changes have been detected for more than 60 seconds.

#### Scenario: Display warning after 60 second threshold

- **GIVEN** watch mode is running
- **AND** 60 seconds have elapsed since the last file change
- **WHEN** the display is rendered
- **THEN** an idle warning appears in the status bar
- **AND** the warning uses a warning symbol (⚠) or similar indicator
- **AND** the warning text includes "IDLE" or similar clear label
- **AND** the warning uses yellow color from the existing color palette

#### Scenario: Show idle duration in warning

- **GIVEN** the idle warning is being displayed
- **AND** 90 seconds have elapsed since the last change
- **WHEN** the status bar is rendered
- **THEN** the warning includes the duration like "IDLE for 1m 30s"
- **AND** the duration updates on each display refresh
- **AND** uses human-readable time format (minutes and seconds)

#### Scenario: Warning persists until new change

- **GIVEN** the idle warning is displayed
- **AND** no new file changes occur
- **WHEN** time continues to elapse
- **THEN** the warning remains visible in every status bar refresh
- **AND** the duration counter continues to increment
- **AND** the warning only disappears when a new file change is detected

### Requirement: Update timestamp format for clarity

The watch mode MUST update the timestamp display format to clearly indicate when the last change occurred.

#### Scenario: Display "Last change" timestamp format

- **GIVEN** watch mode is running
- **WHEN** the header is rendered
- **THEN** it displays "Last change: [timestamp]" instead of "Last updated: [timestamp]"
- **AND** the timestamp shows the time when the most recent file change was detected
- **AND** uses 12-hour or 24-hour format based on locale (e.g., "3:45:23 PM")

#### Scenario: Update timestamp only on file change

- **GIVEN** watch mode is running
- **WHEN** a file change is detected
- **THEN** the "Last change: [timestamp]" updates to the current time
- **WHEN** the display refreshes due to idle timer (no file change)
- **THEN** the "Last change: [timestamp]" remains showing the time of the last actual file change
- **AND** does not update to the current refresh time

### Requirement: Periodic display refresh for idle indicator

The watch command MUST periodically refresh the display to update the idle duration counter even when no file changes occur.

#### Scenario: Refresh display every 10 seconds when idle

- **GIVEN** watch mode is running
- **AND** no file changes have occurred for more than 60 seconds
- **WHEN** the idle state is active
- **THEN** the display refreshes automatically every 10 seconds
- **AND** the idle duration counter updates to show current elapsed time
- **AND** no file system events are required to trigger this refresh

#### Scenario: Stop periodic refresh on exit

- **GIVEN** periodic refresh timer is running
- **WHEN** the developer presses Ctrl+C to exit
- **THEN** the periodic refresh timer is cleared
- **AND** timers do not prevent clean process exit
- **AND** cleanup happens before "Stopping watch mode..." message

### Requirement: Idle indicator visual styling

The idle warning indicator MUST use consistent visual styling that integrates with the existing status bar design.

#### Scenario: Use warning color for idle indicator

- **GIVEN** the terminal supports ANSI colors
- **WHEN** the idle warning is displayed
- **THEN** the warning symbol (⚠) uses yellow color
- **AND** the "IDLE" text uses yellow color
- **AND** the duration text uses gray color (consistent with other metadata)
- **AND** colors come from the `utils/output.ts` palette

#### Scenario: Position warning in status bar

- **GIVEN** the idle warning is being displayed
- **WHEN** the status bar is rendered
- **THEN** the warning appears after the progress bar
- **AND** uses "|" separator consistent with other status bar elements
- **AND** follows format: "Project: [name] | [N] changes | [X/Y] tasks | [progress bar] | ⚠ IDLE for [duration]"
- **AND** fits within typical terminal widths without wrapping

#### Scenario: Format idle duration text

- **GIVEN** various idle durations
- **WHEN** formatting the duration for display
- **THEN** durations under 1 minute show as "Xs" (e.g., "IDLE for 45s")
- **THEN** durations 1+ minutes show as "Xm Ys" (e.g., "IDLE for 1m 23s")
- **THEN** durations 10+ minutes show as "Xm" only (e.g., "IDLE for 15m")
- **AND** the format is consistent and easy to read at a glance

