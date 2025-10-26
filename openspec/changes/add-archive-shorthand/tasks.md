# Tasks for add-archive-shorthand

## Implementation Tasks

### 1. Add top-level archive command handler in main.ts

**Goal**: Add the `archive` command case to the top-level command routing in main.ts

**Steps**:

- [x] Add `else if (command === 'archive')` branch after the existing `propose` branch
- [x] Extract spec-id from `args[1]`
- [x] Call `await runSpecArchive(specId)` with the extracted spec-id
- [x] Follow the exact same pattern as the existing `propose` shorthand

**Validation**:

- [x] Code compiles without errors
- [x] Run `npm run format` to ensure formatting compliance
- [x] Run `npm run lint` to ensure code quality

**Dependencies**: None

---

### 2. Add unit tests for archive shorthand

**Goal**: Create comprehensive unit tests for the new archive shorthand command

**Steps**:

- [x] Add test cases to `spec-archive.test.ts` for the archive shorthand
- [x] Test: `zap archive` without spec-id should error with proper message
- [x] Test: Error message should match "Error: spec archive requires a spec-id argument"
- [x] Test: Usage message should be displayed: "Usage: zap spec archive <spec-id>"
- [x] Follow the pattern established in `spec-propose.test.ts` for shorthand tests

**Validation**:

- [x] Run `npm test` and verify all tests pass
- [x] Verify new tests cover error cases for the shorthand
- [x] Run `npm run format` to ensure test file formatting

**Dependencies**: Task 1 (implementation must exist to test)

---

### 3. Add integration test for archive shorthand

**Goal**: Add integration test to verify the archive shorthand works end-to-end

**Steps**:

- [x] Add test case to `integration.test.ts` in the "command shortcuts" section
- [x] Test that `zap archive` without spec-id shows proper error
- [x] Verify error message includes "spec archive requires a spec-id argument"
- [x] Verify usage message is displayed
- [x] Follow the pattern of existing shorthand integration tests

**Validation**:

- [x] Run `npm test` and verify all integration tests pass
- [x] Manually test `./zap archive` to see the error (safe to run)
- [x] Manually test `./zap archive test-spec` to verify it attempts to run Claude (will fail if not installed, which is expected)

**Dependencies**: Task 1 (implementation must exist to test)

---

### 4. Verify backward compatibility

**Goal**: Ensure `zap spec archive` continues to work unchanged

**Steps**:

- [x] Review existing `spec-archive.test.ts` tests
- [x] Run all existing tests to verify they still pass
- [x] Manually verify `./zap spec archive test-spec` still works
- [x] Confirm both command paths use the same underlying function

**Validation**:

- [x] All existing unit tests pass
- [x] All existing integration tests pass
- [x] Both command forms produce identical behavior
- [x] No breaking changes to existing command structure

**Dependencies**: Task 1, Task 2, Task 3

---

### 5. Run full test suite and quality checks

**Goal**: Verify all tests pass and code quality standards are met

**Steps**:

- [x] Run `npm test` to execute full test suite
- [x] Run `npm run lint` to verify code quality
- [x] Run `npm run format:check` to verify formatting compliance
- [x] Address any failures in the above commands

**Validation**:

- [x] All tests pass (100% success rate)
- [x] No linting errors
- [x] All files properly formatted
- [x] Ready for code review and merge

**Dependencies**: All previous tasks

---

## Parallel Work Opportunities

Tasks 2 and 3 can be implemented in parallel after Task 1 is complete, as they are independent test suites.

## Testing Strategy

### Unit Tests

- Error handling for missing spec-id
- Validation of error messages
- Verification of command routing

### Integration Tests

- End-to-end command execution
- Verification of error output format
- Testing with actual zap executable

### Manual Testing

- Test `./zap archive` (expect error about missing spec-id)
- Test `./zap archive test-spec` (expect Claude Code invocation or error if not installed)
- Test `./zap spec archive test-spec` (verify backward compatibility)
- Compare output of both forms to ensure they're identical
