# Proposal: Fix Extension to Refresh When Changes Are Archived

## Problem

The VSCode extension continues to display changes in the "OpenSpec Tasks" panel even after they have been archived. When a change is moved from `openspec/changes/<change-id>/` to `openspec/changes/archive/<date>-<change-id>/`, the extension should immediately refresh and remove the archived change from the view.

## Root Cause

The current file watcher pattern `openspec/changes/**/tasks.md` watches for changes to task files, but it has two issues:

1. **Directory moves are not detected**: When archiving, the entire change directory is moved, but the file watcher only monitors file changes (create/change/delete), not directory moves. VSCode's FileSystemWatcher doesn't reliably detect when a parent directory is moved.

2. **File watcher pattern includes archive directory**: The pattern `openspec/changes/**/tasks.md` matches files in both active changes and the archive subdirectory, which can cause unnecessary refresh triggers from archived files.

## Proposed Solution

Add a directory-level file watcher that monitors the `openspec/changes` directory itself for structural changes. When any directory is added or removed from `openspec/changes`, trigger a refresh of the extension.

This ensures that:
- When a change directory is moved to archive (which appears as a deletion from the `changes` directory), the extension refreshes
- When a new change is created, the extension refreshes
- The extension stays in sync with the actual state of active changes

## Benefits

- Users see immediate feedback when archiving changes
- Extension state stays synchronized with file system state
- No manual refresh needed after archive operations
- Cleaner architecture by watching the right level of the file system

## Alternatives Considered

1. **Poll for changes periodically**: Rejected because it wastes resources and has delayed feedback
2. **Watch archive directory and refresh on creates**: Rejected because it's indirect and doesn't handle all edge cases
3. **Manual refresh command**: Already exists but requires user action, which is poor UX

## Implementation Notes

The fix requires adding a third FileSystemWatcher in `vscode-extension/src/extension.ts` that watches for directory changes in `openspec/changes/`.
