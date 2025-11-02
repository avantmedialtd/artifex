# Proposal: Show Change Count in Extension Panel Header Badge

## Problem

The VSCode extension currently displays the completion percentage (e.g., 75%) in the panel header badge. While this provides useful information about overall progress, it doesn't immediately convey how many changes require attention. Users need to quickly see the number of active changes that still have unchecked tasks.

## Solution

Change the extension panel header badge to display the count of active changes with unchecked tasks instead of the completion percentage. This provides an at-a-glance view of how many changes require work, making it easier to prioritize and manage multiple concurrent changes.

## Success Criteria

- Badge shows the count of active changes that have at least one unchecked task
- Badge tooltip provides detailed information: "X active change(s) with unchecked tasks"
- Badge is hidden when all changes are complete (no unchecked tasks remain)
- Badge is hidden when there are no active changes
- Badge updates in real-time as tasks are checked/unchecked

## Examples

### Before (Current Behavior)
- 3 changes with 15/20 tasks completed → Badge shows `75` (completion percentage)
- Tooltip: "3 active changes, 75% complete (15/20 tasks)"

### After (Proposed Behavior)
- 3 changes, all with unchecked tasks → Badge shows `3`
- 2 changes with unchecked tasks, 1 change fully complete → Badge shows `2`
- All changes complete → Badge hidden
- Tooltip: "3 active change(s) with unchecked tasks"

## Impact

This change improves the user experience by:
- Providing clearer, more actionable information at a glance
- Making it easier to track how many changes are in progress
- Aligning with common task management patterns (count of items requiring attention)
- Reducing cognitive load (simple count vs. percentage calculation)

## Non-Goals

- This change does not modify the tree view content or structure
- This change does not affect how tasks are parsed or displayed
- This change does not add new filtering or sorting capabilities
