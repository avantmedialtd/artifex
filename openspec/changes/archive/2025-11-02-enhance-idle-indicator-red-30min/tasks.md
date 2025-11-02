# Implementation Tasks

## Code Changes

- [x] Add red color threshold constant in `commands/watch.ts` for 30 minutes (1800 seconds)
- [x] Keep existing yellow warning threshold at 60 seconds (no change needed)
- [x] Update `displayStatusBar()` function to determine warning color based on idle duration
- [x] Add conditional logic: use `colors.yellow` for 60s-30m, `colors.red` for 30m+
- [x] Apply color to both warning symbol (⚠) and "IDLE" text consistently
- [x] Verify periodic refresh timer interval (10 seconds) works with both thresholds
- [x] Ensure idle duration formatting works correctly for all durations

## Validation

- [x] Run watch mode and verify no idle warning appears before 60 seconds
- [x] Wait 60+ seconds (but less than 30 minutes) and verify yellow idle warning appears
- [x] Verify idle duration formatting displays correctly in yellow (e.g., "1m 23s", "5m 0s")
- [x] Wait 30+ minutes and verify idle warning transitions to red color
- [x] Verify idle duration formatting displays correctly in red (e.g., "30m 5s", "45m 12s")
- [x] Make a file change and verify idle warning clears immediately (resets to no warning)
- [x] Verify periodic refresh updates both duration counter and color appropriately
- [x] Run existing tests with `npm test` to ensure no regressions
- [x] Run linting with `npm run lint` to ensure code quality
- [x] Run formatting check with `npm run format:check` to ensure code formatting
