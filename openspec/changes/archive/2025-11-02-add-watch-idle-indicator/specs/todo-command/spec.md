# todo-command Specification Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
