# Proposal: Add Idle Indicator to Watch Mode

## Overview

Add an idle indicator to the `zap watch` command that displays a warning in the status line when there has been no file system change detected for more than 60 seconds. This helps developers quickly assess project activity levels and determine whether a project needs more work or is in a stable/complete state.

## Motivation

Currently, `zap watch` provides real-time updates when files change, but when no changes occur for extended periods, developers have no visual signal about project activity level. An idle indicator helps developers quickly assess whether a project needs more work:

- **Project assessment**: Visual feedback showing how long since the last change helps identify projects that may be complete or stable
- **Activity awareness**: At a glance, see if development work is actively happening or if the project is dormant
- **Work prioritization**: Easily identify which projects need attention vs. which are idle

The idle indicator serves as a passive signal that a project may not need immediate development attention when shown for extended periods.

## Scope

This change adds idle detection and visual warning indicators to the watch mode display:

**In scope:**
- Track time since last file system change event
- Display idle warning in status line when idle for >60 seconds
- Update timestamp display to show "Last change: [timestamp]" format
- Clear idle warning when new changes are detected

**Out of scope:**
- Configurable idle timeout (hardcoded to 60 seconds)
- Different warning levels (e.g., 1 minute vs 5 minutes)
- Notifications or sounds for idle state
- Pausing or stopping watch mode when idle

## Related Changes

This change extends the existing `todo-command` specification by adding new requirements for idle detection within watch mode.

## User Impact

- **Developers using watch mode** will see a visual warning indicator when no changes have been detected for more than 60 seconds, helping them quickly identify idle projects
- **No breaking changes** - all existing watch mode functionality remains unchanged
- **Better UX** - clearer feedback about project activity levels and work prioritization

## Success Criteria

- Watch mode displays idle warning after 60 seconds of inactivity
- Idle warning appears in the status line with appropriate visual styling (warning color)
- Idle warning clears immediately when a new file change is detected
- Display updates "Last change: [timestamp]" instead of "Last updated: [timestamp]" to clarify timing
- No performance degradation in watch mode
