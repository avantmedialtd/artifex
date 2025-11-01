# Tasks

## Implementation

- [x] Add `getActiveChangesCount()` method to `OpenSpecTaskProvider` to count active changes
- [x] Add `getCompletionPercentage()` method to `OpenSpecTaskProvider` to calculate percentage
- [x] Update `updateBadge()` in `extension.ts` to use completion percentage instead of unchecked count
- [x] Update badge tooltip format to show "N active changes, X% complete (Y/Z tasks)"
- [x] Handle edge case: hide badge when total tasks is 0
- [x] Handle edge case: hide badge when active changes count is 0

## Testing

- [x] Test badge with 0% completion (0 completed tasks)
- [x] Test badge with partial completion (e.g., 15/20 tasks = 75%)
- [x] Test badge with 100% completion (all tasks done)
- [x] Test badge rounding (e.g., 2/3 tasks = 67%)
- [x] Test badge hidden when no active changes
- [x] Test badge hidden when no tasks exist
- [x] Test badge updates when tasks.md files change

## Documentation

- [x] Update extension README if it documents badge behavior
- [x] Add code comments explaining percentage calculation logic
