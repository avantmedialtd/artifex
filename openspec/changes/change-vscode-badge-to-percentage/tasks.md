# Tasks

## Implementation

- [ ] Add `getActiveChangesCount()` method to `OpenSpecTaskProvider` to count active changes
- [ ] Add `getCompletionPercentage()` method to `OpenSpecTaskProvider` to calculate percentage
- [ ] Update `updateBadge()` in `extension.ts` to use completion percentage instead of unchecked count
- [ ] Update badge tooltip format to show "N active changes, X% complete (Y/Z tasks)"
- [ ] Handle edge case: hide badge when total tasks is 0
- [ ] Handle edge case: hide badge when active changes count is 0

## Testing

- [ ] Test badge with 0% completion (0 completed tasks)
- [ ] Test badge with partial completion (e.g., 15/20 tasks = 75%)
- [ ] Test badge with 100% completion (all tasks done)
- [ ] Test badge rounding (e.g., 2/3 tasks = 67%)
- [ ] Test badge hidden when no active changes
- [ ] Test badge hidden when no tasks exist
- [ ] Test badge updates when tasks.md files change

## Documentation

- [ ] Update extension README if it documents badge behavior
- [ ] Add code comments explaining percentage calculation logic
