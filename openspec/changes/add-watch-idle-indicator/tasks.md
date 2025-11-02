# Implementation Tasks

## Core Implementation

- [x] Add `lastChangeTime` variable to track timestamp of last file system event in `handleWatch` function
- [x] Initialize `lastChangeTime` to current time when watch mode starts
- [x] Update `lastChangeTime` in the file watcher callback whenever a file change is detected
- [x] Add `calculateIdleDuration()` utility function to compute elapsed time since last change
- [x] Add `formatIdleDuration()` utility function to format duration as human-readable string (e.g., "1m 23s")

## Display Updates

- [x] Modify `displayTodos()` to accept optional `lastChangeTime` parameter
- [x] Update header timestamp format from "Last updated" to "Last change" in `displayTodos()`
- [x] Pass `lastChangeTime` to `displayStatusBar()` function
- [x] Modify `displayStatusBar()` signature to accept `lastChangeTime` parameter
- [x] Calculate idle duration inside `displayStatusBar()` based on `lastChangeTime`
- [x] Add conditional logic to show idle warning when duration > 60 seconds
- [x] Add warning color (yellow) to `utils/output.ts` if not already present
- [x] Format idle warning message as "⚠ IDLE for [duration]" with appropriate colors
- [x] Position idle warning after progress bar in status line with "|" separator

## Periodic Refresh

- [x] Add periodic refresh timer that triggers every 10 seconds when in idle state
- [x] Ensure periodic timer only runs when idle duration > 60 seconds
- [x] Clear periodic timer when new file changes are detected
- [x] Clear periodic timer on Ctrl+C / SIGINT before cleanup

## Testing

- [x] Test watch mode starts with no idle warning displayed
- [x] Test idle warning appears after 60 seconds of no file changes
- [x] Test idle warning shows correct duration format for various time ranges
- [x] Test idle warning clears immediately when file change is detected
- [x] Test periodic refresh updates idle duration counter every 10 seconds
- [x] Test "Last change" timestamp updates only on file change, not on periodic refresh
- [x] Test exit (Ctrl+C) cleans up timers without hanging
- [x] Verify status bar formatting with and without idle warning fits terminal width
- [x] Test with no active changes (edge case - idle warning should still work)

## Documentation

- [x] Update help content in `commands/help.ts` to mention idle indicator feature
- [x] Update CLAUDE.md if watch mode behavior description needs clarification
