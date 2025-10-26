# Tasks for add-archive-shorthand

## Implementation Tasks

### 1. Add top-level archive command handler in main.ts

**Goal**: Add the `archive` command case to the top-level command routing in main.ts

**Steps**:
- Add `else if (command === 'archive')` branch after the existing `propose` branch
- Extract spec-id from `args.slice(1).join(' ')` (though spec-id should be a single argument)
- Call `await runSpecArchive(specId)` with the extracted spec-id
- Follow the exact same pattern as the existing `propose` shorthand

**Validation**:
- Code compiles without errors
- Run `npm run format` to ensure formatting compliance
- Run `npm run lint` to ensure code quality

**Dependencies**: None

---

### 2. Add unit tests for archive shorthand

**Goal**: Create comprehensive unit tests for the new archive shorthand command

**Steps**:
- Add test cases to `spec-archive.test.ts` for the archive shorthand
- Test: `zap archive` without spec-id should error with proper message
- Test: Error message should match "Error: spec archive requires a spec-id argument"
- Test: Usage message should be displayed: "Usage: zap spec archive <spec-id>"
- Follow the pattern established in `spec-propose.test.ts` for shorthand tests

**Validation**:
- Run `npm test` and verify all tests pass
- Verify new tests cover error cases for the shorthand
- Run `npm run format` to ensure test file formatting

**Dependencies**: Task 1 (implementation must exist to test)

---

### 3. Add integration test for archive shorthand

**Goal**: Add integration test to verify the archive shorthand works end-to-end

**Steps**:
- Add test case to `integration.test.ts` in the "command shortcuts" section
- Test that `zap archive` without spec-id shows proper error
- Verify error message includes "spec archive requires a spec-id argument"
- Verify usage message is displayed
- Follow the pattern of existing shorthand integration tests

**Validation**:
- Run `npm test` and verify all integration tests pass
- Manually test `./zap archive` to see the error (safe to run)
- Manually test `./zap archive test-spec` to verify it attempts to run Claude (will fail if not installed, which is expected)

**Dependencies**: Task 1 (implementation must exist to test)

---

### 4. Verify backward compatibility

**Goal**: Ensure `zap spec archive` continues to work unchanged

**Steps**:
- Review existing `spec-archive.test.ts` tests
- Run all existing tests to verify they still pass
- Manually verify `./zap spec archive test-spec` still works
- Confirm both command paths use the same underlying function

**Validation**:
- All existing unit tests pass
- All existing integration tests pass
- Both command forms produce identical behavior
- No breaking changes to existing command structure

**Dependencies**: Task 1, Task 2, Task 3

---

### 5. Run full test suite and quality checks

**Goal**: Verify all tests pass and code quality standards are met

**Steps**:
- Run `npm test` to execute full test suite
- Run `npm run lint` to verify code quality
- Run `npm run format:check` to verify formatting compliance
- Address any failures in the above commands

**Validation**:
- All tests pass (100% success rate)
- No linting errors
- All files properly formatted
- Ready for code review and merge

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
