# Proposal: Add E2E Command

## Summary

Add an `e2e` subcommand to the CLI that wraps the existing `e2e_tests.ts` script, providing a consistent interface for running end-to-end tests through the standard `af` command structure.

## Motivation

The project has a standalone `e2e_tests.ts` script in the root directory that runs Playwright E2E tests in a fresh Docker environment. Making this a subcommand of `af` provides:

1. **Consistency** - All CLI operations accessible through `af <command>`
2. **Discoverability** - Users can find E2E functionality via `af help`
3. **Integration** - Standard error handling and output formatting

## What Changes

### New Command

- `af e2e` - Run all E2E tests with defaults
- `af e2e [args...]` - Pass arguments through to the test runner

### Files Added

- `commands/e2e.ts` - Command handler that spawns the e2e_tests.ts script

### Files Modified

- `router.ts` - Add routing for `e2e` command
- `commands/help.ts` - Add help content for `e2e` command

### Files Removed

- `e2e_tests.ts` - Move from root to `scripts/` directory (cleaner project structure)

## Impact

- **Low risk** - Wraps existing, tested functionality
- **No breaking changes** - New command only
- **Backwards compatible** - Script can still be run directly from `scripts/e2e_tests.ts`
