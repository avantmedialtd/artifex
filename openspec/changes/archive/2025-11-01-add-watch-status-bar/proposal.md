# Add Status Bar to Watch Command

## Why

The `zap watch` command currently displays individual change progress but lacks a high-level overview. Developers working across multiple changes need to see aggregated metrics (project name, total changes, overall task completion) at a glance to quickly assess overall project status.

## What Changes

- Add a status bar at the bottom of the watch display showing:
  - Project name (derived from parent folder)
  - Number of active changes in progress
  - Total task count across all changes
  - Completed task count across all changes
  - Visual progress bar with percentage
- Display status bar in a visually distinct format using box-drawing characters and colors
- Update status bar in real-time when tasks.md files change

## Impact

- Affected specs: `todo-command` (adds status bar requirements for watch mode)
- Affected code:
  - `commands/watch.ts` (modify displayTodos function to add status bar)
  - No new dependencies required (uses existing Node.js path and ANSI color utilities)
