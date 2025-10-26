# Tasks: Add 'zap propose' as a shorthand for 'zap spec propose'

## Implementation Tasks

1. **Add top-level propose command routing in main.ts**
    - Add `else if (command === 'propose')` branch in main command router (main.ts:12)
    - Extract proposal text from args.slice(1)
    - Call `runSpecPropose(proposalText)` with the extracted text
    - **Validation**: Run `zap propose test` and verify it invokes the Claude workflow

2. **Update error message in runSpecPropose for shorthand**
    - Modify error message from "Error: spec propose requires proposal text" to "Error: propose requires proposal text"
    - Update usage message from "Usage: zap spec propose <proposal-text>" to "Usage: zap propose <proposal-text>"
    - **Validation**: Run `zap propose` (without args) and verify new error messages appear

3. **Add integration tests for propose shorthand**
    - Add test case in integration.test.ts for `zap propose` with valid proposal text
    - Add test case for `zap propose` without proposal text
    - Add test case to verify both `zap propose` and `zap spec propose` call the same underlying function
    - **Validation**: Run `npm test` and verify all tests pass

4. **Update README.md to document the shorthand**
    - Add `zap propose <proposal-text>` to the Available Commands section
    - Include note that it's equivalent to `zap spec propose`
    - Present the shorthand as the recommended form
    - **Validation**: Review README and verify both command forms are documented

5. **Verify backward compatibility**
    - Run existing tests for `zap spec propose`
    - Verify `zap spec propose <text>` still works identically
    - **Validation**: Run `npm test` and verify all spec-propose tests pass

## Validation Tasks

6. **Run integration test suite**
    - Execute `npm test` to ensure all tests pass
    - Verify both `zap propose` and `zap spec propose` are tested
    - **Success**: All tests pass with no regressions

7. **Manual smoke testing**
    - Test `zap propose Add new feature` successfully invokes Claude
    - Test `zap propose` (no args) shows proper error
    - Test `zap spec propose Add feature` still works
    - Test multi-word proposals work with shorthand
    - **Success**: All manual test cases work as expected

## Dependencies

None. All tasks can proceed sequentially in order.

## Parallel Work Opportunities

Tasks 1-2 must be done sequentially. After task 2, tasks 3 and 4 can be done in parallel.
