# Proposal: Enhance Idle Indicator with Red Color at 30 Minutes

## Overview

Add a second-level idle indicator to `zap watch` that shows in red color when the idle duration exceeds 30 minutes, while keeping the existing yellow warning at 60 seconds. This creates a two-tier warning system that provides clearer visual signals for different levels of inactivity.

## Motivation

Currently, the idle indicator displays a yellow warning after 60 seconds of inactivity, which is useful for normal development awareness. However, there's no visual distinction for extended idle periods that may indicate a project has been forgotten or needs urgent attention. Adding a red warning at 30 minutes provides:

- **Two-tier warning system**: Yellow (60s) for brief pauses, red (30m) for extended inactivity
- **Stronger visual signal**: Red color provides urgency for truly extended idle periods
- **Better project prioritization**: Quickly identify which projects have been dormant for significant periods

This change enhances the idle indicator by adding an escalation level while preserving the existing behavior that developers are already familiar with.

## Scope

This change adds a second-level idle warning to watch mode:

**In scope:**
- Add red color idle warning when idle duration exceeds 30 minutes (1800000ms)
- Keep existing yellow warning at 60 seconds (current behavior)
- Determine warning color based on idle duration: yellow for 60s-30m, red for 30m+
- Keep existing idle duration formatting and display logic
- Keep existing periodic refresh mechanism (10 second intervals)

**Out of scope:**
- Additional warning levels beyond two (e.g., orange at 5 minutes, red at 30 minutes)
- Configurable idle timeout via command-line arguments or config files
- Different threshold values for different types of projects
- Audio or desktop notifications for idle state
- Different warning messages for different levels (text remains the same, only color changes)

## Related Changes

This change modifies the existing `todo-command` specification by updating requirements related to the idle indicator's threshold and visual styling in watch mode.

## User Impact

- **Developers using watch mode** will see existing yellow warning at 60 seconds (no change)
- **Extended idle periods** (30+ minutes) will now show in red color for increased urgency
- **No breaking changes** - all existing watch mode functionality remains unchanged
- **Better visual hierarchy** - two-tier color system helps distinguish normal pauses from extended inactivity
- **Improved project awareness** - red warning makes forgotten or stalled projects more obvious

## Success Criteria

- Watch mode displays yellow idle warning after 60 seconds (existing behavior preserved)
- Watch mode displays red idle warning after 30 minutes of inactivity
- Idle warning transitions from yellow to red when crossing the 30-minute threshold
- Idle duration formatting continues to work correctly for all durations
- Periodic refresh continues to update idle duration and color every 10 seconds
- No performance degradation in watch mode
