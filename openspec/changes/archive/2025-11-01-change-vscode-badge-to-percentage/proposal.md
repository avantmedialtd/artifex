# Proposal: Change VSCode Extension Badge to Show Completion Percentage

## Why

The VSCode extension panel tab currently displays a badge showing the count of unchecked tasks (e.g., "5 unchecked tasks"). While this provides useful information, it doesn't give developers a quick sense of overall progress across all active changes.

Users want to see at a glance how much work is completed rather than how much remains, making completion percentage a more intuitive metric for tracking progress.

## What Changes

Change the badge in the VSCode extension panel tab to display:

- **Badge value**: Completion percentage (0-100) representing the percentage of completed tasks across all active changes
- **Badge tooltip**: Detailed information including the number of active changes and completion status

### Current Behavior

```
Badge: 5
Tooltip: "5 unchecked tasks"
```

### New Behavior

```
Badge: 75
Tooltip: "3 active changes, 75% complete (15/20 tasks)"
```

## Benefits

1. **Better progress visibility**: Percentage immediately shows how close to completion the work is
2. **Positive framing**: Shows what's done rather than what's left
3. **Intuitive metric**: Percentages are universally understood
4. **Maintains detail**: Tooltip still provides granular information about changes and tasks

## Implementation Scope

This change affects only the badge calculation and display logic in the VSCode extension:

- Modify `extension.ts:updateBadge()` to calculate completion percentage
- Update badge value to show percentage instead of unchecked count
- Update tooltip to show active changes count and completion details

No changes to the tree view or task parsing logic are required.

## Edge Cases

- **Zero total tasks**: Hide badge (no work to track)
- **Zero active changes**: Hide badge (no changes to monitor)
- **Rounding**: Use `Math.round()` to display whole number percentages
