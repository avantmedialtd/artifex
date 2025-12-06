# Interactive Change Selection for Apply Command

## Summary

When `zap spec apply` is invoked without a change-id and there are multiple ongoing changes, present an interactive selection menu instead of delegating selection to Claude. This reduces friction and provides a better developer experience by handling the selection in the zap CLI directly.

## Problem

Currently, when a developer runs `zap spec apply` without specifying a change-id:
- The CLI delegates to Claude Code with `/openspec:apply` (no change-id)
- Claude Code must then prompt the user to select a change interactively
- This adds unnecessary latency and indirection

The archive command already auto-selects the first change when spec-id is omitted, but apply should be more explicit since applying the wrong change could have unintended consequences.

## Solution

Add interactive selection using the existing Ink Select component when:
1. No change-id is provided as argument
2. Multiple ongoing changes exist (more than 1)

When exactly 0 changes exist, show an error message.
When exactly 1 change exists, auto-select it (similar to archive behavior).
When more than 1 change exists, show an interactive selection menu.

## Benefits

- Faster UX: Selection happens locally without spawning Claude first
- Consistency: Uses existing Ink Select component
- Safety: Explicit selection prevents accidentally applying the wrong change
- Visibility: User sees all available changes before selecting
