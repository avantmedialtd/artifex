# todo-command Specification Delta

## MODIFIED Requirements

### Requirement: Watch mode status bar display

The watch command MUST display a status bar at the bottom of the output showing aggregated project metrics, progress, and idle status warnings with two-tier color coding.

#### Scenario: Status bar shows yellow idle warning after 60 seconds

- **GIVEN** watch mode is running
- **AND** no file system changes have been detected for more than 60 seconds
- **AND** less than 30 minutes have elapsed since the last change
- **WHEN** the display is rendered
- **THEN** the status bar includes a warning indicator showing "⚠ IDLE" or similar
- **AND** the warning uses yellow color from the `utils/output.ts` palette
- **AND** the warning is positioned prominently in the status line (e.g., after the progress bar)
- **AND** the warning provides context like "IDLE for 1m 23s"

#### Scenario: Status bar shows red idle warning after 30 minutes

- **GIVEN** watch mode is running
- **AND** no file system changes have been detected for more than 30 minutes
- **WHEN** the display is rendered
- **THEN** the status bar includes a warning indicator showing "⚠ IDLE" or similar
- **AND** the warning uses red color from the `utils/output.ts` palette
- **AND** the warning is positioned prominently in the status line (e.g., after the progress bar)
- **AND** the warning provides context like "IDLE for 30m 12s"

### Requirement: Display idle warning when idle threshold exceeded

The watch command MUST display a visual warning indicator in the status bar with appropriate color coding based on idle duration: yellow after 60 seconds, red after 30 minutes.

#### Scenario: Display yellow warning after 60 second threshold

- **GIVEN** watch mode is running
- **AND** 60 seconds have elapsed since the last file change
- **AND** less than 30 minutes have elapsed
- **WHEN** the display is rendered
- **THEN** an idle warning appears in the status bar
- **AND** the warning uses a warning symbol (⚠) or similar indicator
- **AND** the warning text includes "IDLE" or similar clear label
- **AND** the warning uses yellow color from the existing color palette

#### Scenario: Display red warning after 30 minute threshold

- **GIVEN** watch mode is running
- **AND** 30 minutes (1800 seconds) have elapsed since the last file change
- **WHEN** the display is rendered
- **THEN** an idle warning appears in the status bar
- **AND** the warning uses a warning symbol (⚠) or similar indicator
- **AND** the warning text includes "IDLE" or similar clear label
- **AND** the warning uses red color from the existing color palette

#### Scenario: No warning displayed before 60 second threshold

- **GIVEN** watch mode is running
- **AND** less than 60 seconds have elapsed since the last file change
- **WHEN** the display is rendered
- **THEN** no idle warning appears in the status bar
- **AND** the status bar shows normal metrics without the warning indicator

#### Scenario: Warning transitions from yellow to red at 30 minutes

- **GIVEN** watch mode is displaying a yellow idle warning
- **AND** the idle duration crosses the 30-minute threshold
- **WHEN** the display refreshes
- **THEN** the warning symbol color changes from yellow to red
- **AND** the "IDLE" text color changes from yellow to red
- **AND** the warning text and duration format remain the same
- **AND** the transition is visible in the next periodic refresh (within 10 seconds)

#### Scenario: Show idle duration in warning

- **GIVEN** the idle warning is being displayed
- **AND** 35 minutes have elapsed since the last change
- **WHEN** the status bar is rendered
- **THEN** the warning includes the duration like "IDLE for 35m 0s" or "IDLE for 35m"
- **AND** the duration updates on each display refresh
- **AND** uses human-readable time format (minutes and seconds)

### Requirement: Idle indicator visual styling

The idle warning indicator MUST use color-coded warnings: yellow for 60 seconds to 30 minutes, red for 30+ minutes.

#### Scenario: Use yellow color for idle indicator between 60s and 30m

- **GIVEN** the terminal supports ANSI colors
- **WHEN** the idle warning is displayed after 60 seconds but before 30 minutes
- **THEN** the warning symbol (⚠) uses yellow color
- **AND** the "IDLE" text uses yellow color
- **AND** the duration text uses gray color (consistent with other metadata)
- **AND** colors come from the `utils/output.ts` palette

#### Scenario: Use red color for idle indicator after 30 minutes

- **GIVEN** the terminal supports ANSI colors
- **WHEN** the idle warning is displayed after 30 minutes of inactivity
- **THEN** the warning symbol (⚠) uses red color
- **AND** the "IDLE" text uses red color
- **AND** the duration text uses gray color (consistent with other metadata)
- **AND** colors come from the `utils/output.ts` palette

#### Scenario: Position warning in status bar

- **GIVEN** the idle warning is being displayed
- **WHEN** the status bar is rendered
- **THEN** the warning appears after the progress bar
- **AND** uses "|" separator consistent with other status bar elements
- **AND** follows format: "Project: [name] | [N] changes | [X/Y] tasks | [progress bar] | ⚠ IDLE for [duration]"
- **AND** fits within typical terminal widths without wrapping

#### Scenario: Format idle duration text for extended periods

- **GIVEN** various idle durations exceeding 30 minutes
- **WHEN** formatting the duration for display
- **THEN** durations show as "Xm Ys" (e.g., "IDLE for 30m 5s", "IDLE for 45m 23s")
- **OR** durations show as "Xm" when seconds are zero (e.g., "IDLE for 30m", "IDLE for 60m")
- **AND** the format is consistent and easy to read at a glance
