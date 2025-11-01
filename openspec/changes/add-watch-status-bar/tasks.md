# Implementation Tasks

## 1. Core Status Bar Implementation

- [x] 1.1 Add `getProjectName()` function to extract project name from `process.cwd()` using `path.basename()`
- [x] 1.2 Add `calculateAggregateMetrics()` function that takes array of `ChangeTaskData` and returns total changes, total tasks, and completed tasks
- [x] 1.3 Add `renderProgressBar()` function that takes completed/total counts and returns formatted progress bar string with visual blocks and percentage
- [x] 1.4 Add `displayStatusBar()` function that renders the complete status bar with project name, metrics, and progress bar using box-drawing characters and colors

## 2. Integration with Watch Display

- [x] 2.1 Modify `displayTodos()` function to collect all `ChangeTaskData` into an array
- [x] 2.2 After displaying all changes, call `displayStatusBar()` with the collected change data
- [x] 2.3 Ensure status bar is displayed at the bottom after all task lists

## 3. Visual Formatting and Colors

- [x] 3.1 Use cyan color for project name (matching section headers)
- [x] 3.2 Use gray color for numeric metadata (changes count, task counts)
- [x] 3.3 Use green color for completed portion of progress bar (█ blocks)
- [x] 3.4 Use gray color for incomplete portion of progress bar (░ blocks)
- [x] 3.5 Design box-drawing border that matches the style of change display boxes
- [x] 3.6 Ensure status bar layout fits within 100 characters for typical terminal widths

## 4. Progress Bar Implementation

- [x] 4.1 Calculate completion percentage as (completed / total * 100)
- [x] 4.2 Render visual progress bar with fixed width of 20 characters using █ and ░ Unicode blocks
- [x] 4.3 Display percentage text next to visual bar (e.g., "75%")
- [x] 4.4 Handle edge cases: 0 tasks (show "N/A" or "0%"), 100% completion (full green bar)

## 5. Testing and Edge Cases

- [x] 5.1 Test with 0 active changes (status bar shows "0 changes")
- [x] 5.2 Test with changes that have no tasks.md files (counted as 0 tasks)
- [x] 5.3 Test with multiple changes having various task counts
- [x] 5.4 Test real-time updates when tasks are checked/unchecked
- [x] 5.5 Test project name extraction with typical and edge-case paths
- [x] 5.6 Verify status bar updates correctly when new changes are added or removed

## 6. Code Quality

- [x] 6.1 Add TypeScript type definitions for new functions
- [x] 6.2 Add unit tests for `getProjectName()`, `calculateAggregateMetrics()`, and `renderProgressBar()` in `commands/watch.test.ts`
- [x] 6.3 Run `npm run format` to ensure code formatting
- [x] 6.4 Run `npm run lint` to check for linting errors
- [x] 6.5 Run `npm run spell:check` to verify no spelling errors
