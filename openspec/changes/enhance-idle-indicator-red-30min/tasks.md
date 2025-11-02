# Implementation Tasks

## Code Changes

- [ ] Add red color threshold constant in `commands/watch.ts` for 30 minutes (1800 seconds)
- [ ] Keep existing yellow warning threshold at 60 seconds (no change needed)
- [ ] Update `displayStatusBar()` function to determine warning color based on idle duration
- [ ] Add conditional logic: use `colors.yellow` for 60s-30m, `colors.red` for 30m+
- [ ] Apply color to both warning symbol (⚠) and "IDLE" text consistently
- [ ] Verify periodic refresh timer interval (10 seconds) works with both thresholds
- [ ] Ensure idle duration formatting works correctly for all durations

## Validation

- [ ] Run watch mode and verify no idle warning appears before 60 seconds
- [ ] Wait 60+ seconds (but less than 30 minutes) and verify yellow idle warning appears
- [ ] Verify idle duration formatting displays correctly in yellow (e.g., "1m 23s", "5m 0s")
- [ ] Wait 30+ minutes and verify idle warning transitions to red color
- [ ] Verify idle duration formatting displays correctly in red (e.g., "30m 5s", "45m 12s")
- [ ] Make a file change and verify idle warning clears immediately (resets to no warning)
- [ ] Verify periodic refresh updates both duration counter and color appropriately
- [ ] Run existing tests with `npm test` to ensure no regressions
- [ ] Run linting with `npm run lint` to ensure code quality
- [ ] Run formatting check with `npm run format:check` to ensure code formatting
