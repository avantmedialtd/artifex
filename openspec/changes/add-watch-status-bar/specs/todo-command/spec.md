# todo-command Specification Deltas

## ADDED Requirements

### Requirement: Watch mode status bar display

The watch command MUST display a status bar at the bottom of the output showing aggregated project metrics and progress.

#### Scenario: Status bar shows project overview

- **GIVEN** watch mode is running with active changes
- **WHEN** the display is rendered
- **THEN** a status bar is displayed at the bottom (after all task lists)
- **AND** the status bar shows the project name derived from the parent folder of `process.cwd()`
- **AND** the status bar shows the number of active changes
- **AND** the status bar shows total task count across all active changes
- **AND** the status bar shows completed task count across all active changes
- **AND** the status bar uses box-drawing characters for visual separation

#### Scenario: Status bar with no active changes

- **GIVEN** watch mode is running but no active changes exist
- **WHEN** the display is rendered
- **THEN** the status bar shows project name
- **AND** shows "0 changes in progress"
- **AND** shows "0/0 tasks" or similar to indicate no tasks

#### Scenario: Status bar updates in real-time

- **GIVEN** watch mode is running with the status bar displayed
- **WHEN** a task is checked or unchecked in any tasks.md file
- **THEN** the display refreshes
- **AND** the status bar updates to reflect the new completed count
- **AND** the progress bar updates accordingly

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
