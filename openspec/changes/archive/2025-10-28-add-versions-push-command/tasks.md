# Tasks: Add `zap versions push` Command

## Implementation Tasks

### 1. Add git push utility function - [x]

**File**: `git-worktree.ts`

Add a `pushWorktree()` function that executes `git push --force` in a specified worktree directory.

**Validation**: Function properly executes git push command and throws errors on failure.

---

### 2. Update CLI command handler for versions push - [x]

**File**: `main.ts`

Update the `versions` command handler to recognize the `push` subcommand and invoke a new `runVersionsPush()` function.

**Validation**: Running `zap versions push` invokes the correct handler function.

---

### 3. Implement runVersionsPush function - [x]

**File**: `main.ts`

Implement the `runVersionsPush()` async function that:

- Validates git repository
- Enumerates worktrees matching `/v\d+/` pattern
- Displays "No worktrees..." message if none found
- Iterates through matching worktrees
- Displays "Pushing worktree X..." progress messages
- Calls `pushWorktree()` for each
- Stops on first failure
- Displays success summary on completion

**Validation**: Command successfully pushes version worktrees and handles errors appropriately.

---

### 4. Add unit tests for pushWorktree - [x]

**File**: `git-worktree.test.ts`

Add test cases for the new `pushWorktree()` function:

- Successful push operation
- Push failure handling
- Error message formatting

**Validation**: All unit tests pass with `npm test`.

---

### 5. Add integration tests for versions push command - [x]

**File**: `integration.test.ts`

Add integration test cases:

- Successful push of multiple version worktrees
- No matching worktrees found
- Push failure stops subsequent pushes
- Not in git repository error
- Error handling for various git failures

**Validation**: All integration tests pass with `npm test`.

---

### 6. Update README documentation - [x]

**File**: `README.md`

Add documentation for the `zap versions push` command:

- Command syntax
- Description and use case
- Example usage
- Relationship to `versions reset` command

**Validation**: Documentation is clear and accurate.

---

### 7. Run full test suite - [x]

**Command**: `npm test`

Execute all tests to ensure no regressions and new functionality works correctly.

**Validation**: All tests pass.

---

### 8. Run linting and formatting checks - [x]

**Commands**: `npm run lint`, `npm run format:check`, `npm run spell:check`

Ensure code meets quality standards.

**Validation**: All quality checks pass.

---

## Dependencies and Parallelization

**Sequential Dependencies**:

- Task 1 must complete before Task 3 (runVersionsPush depends on pushWorktree)
- Task 2 and Task 3 must complete before Task 5 (integration tests need implementation)
- Tasks 1-5 must complete before Task 7 (need implementation for tests)

**Can be parallelized**:

- Task 2 (CLI handler) and Task 1 (git utility) can be developed in parallel
- Task 4 (unit tests) can be written in parallel with Task 3 (main implementation)
- Task 6 (documentation) can be written in parallel with Tasks 4-5

**Critical Path**: Tasks 1 → 3 → 5 → 7 → 8
