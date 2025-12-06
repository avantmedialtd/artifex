# Interactive Change Selection for Archive Command

## Summary

When `zap spec archive` is invoked without a spec-id and there are multiple ongoing changes, present an interactive selection menu instead of auto-selecting the first one. This brings archive in line with the apply command behavior and provides a safer developer experience.

## Problem

Currently, when a developer runs `zap spec archive` without specifying a spec-id:
- The CLI auto-selects the first change from `openspec list --changes`
- If multiple changes exist, the developer might accidentally archive the wrong one
- This is inconsistent with the apply command which shows interactive selection for multiple changes

The apply command was recently updated to show an interactive selection menu when multiple ongoing changes exist (see add-apply-interactive-select). Archive should follow the same pattern for consistency and safety.

## Solution

Add interactive selection using the existing Ink Select component when:
1. No spec-id is provided as argument
2. Multiple ongoing changes exist (more than 1)

Selection logic (matching apply command):
- **0 changes**: Show error message "No ongoing changes found"
- **1 change**: Auto-select it with info message
- **Multiple changes**: Show interactive selection menu

## Benefits

- Consistency: Archive behavior matches apply command
- Safety: Explicit selection prevents accidentally archiving the wrong change
- Visibility: User sees all available changes before selecting
- Reuse: Leverages existing ApplyChangeSelect component (renamed for generic use)

## Implementation Notes

The existing `ApplyChangeSelect` component and `renderApplyChangeSelect` utility can be reused. Consider renaming them to be more generic (e.g., `ChangeSelect` and `renderChangeSelect`) since they're now used by both apply and archive commands.
