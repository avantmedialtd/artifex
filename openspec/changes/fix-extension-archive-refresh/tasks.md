# Tasks

## Implementation

- [x] Add directory watcher for `openspec/changes` to detect when change directories are added or removed
- [x] Connect directory watcher events to refresh handler
- [x] Dispose directory watcher in deactivate function
- [ ] Test archiving a change and verify extension refreshes immediately

## Validation

- [ ] Run extension in debug mode and verify it activates correctly
- [ ] Archive a change using `zap spec archive` and confirm it disappears from extension panel
- [ ] Create a new change and confirm it appears in extension panel
- [ ] Verify no errors in extension host output
