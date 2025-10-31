# Implementation Tasks

## Task 1: Add auto-commit logic to handleSpecArchive function

**Deliverable**: Modify `commands/spec.ts` to add auto-commit after archive succeeds

**Steps**:
1. Update the `handleSpecArchive` function to wrap the promise resolution with auto-commit logic
2. After Claude process completes with code 0, determine the archived spec directory
3. Extract the title from the archived `proposal.md` using `extractProposalTitle`
4. Generate commit message in format "Archive: <Title>"
5. Call `stageAndCommit` to commit the archived spec directory
6. Display success message or warning if commit fails

**Validation**:
- Archive operation commits automatically when successful
- Commit message follows "Archive: <Title>" format
- Warning displayed if commit fails but archive succeeds
- Exit code remains 0 even if commit fails

**Dependencies**: None

## Task 2: Determine archived spec location

**Deliverable**: Add logic to find the archived spec directory after archive operation

**Steps**:
1. The spec-id passed to `handleSpecArchive` is the change-id from `openspec/changes/<change-id>/`
2. After successful archive, the spec is located at `openspec/specs/<spec-id>/`
3. The proposal.md file is at `openspec/specs/<spec-id>/proposal.md`
4. Handle case where proposal.md might not exist (show warning)

**Validation**:
- Correct spec directory is identified and committed
- Warning shown if proposal.md not found
- Only spec directory files are staged, not other changes

**Dependencies**: Task 1

## Task 3: Add tests for archive auto-commit

**Deliverable**: Unit tests for the auto-commit functionality in archive command

**Steps**:
1. Add tests to `commands/spec.test.ts` (or create if doesn't exist)
2. Test successful archive with auto-commit
3. Test archive when commit fails (should warn but succeed)
4. Test archive when title extraction fails
5. Mock git utilities and file system operations

**Validation**:
- All tests pass with `npm test`
- Test coverage includes success and failure scenarios
- Tests verify only spec directory is committed

**Dependencies**: Task 1, Task 2

## Task 4: Update documentation

**Deliverable**: Update CLAUDE.md to document auto-commit behavior for archive

**Steps**:
1. Update the spec command section in CLAUDE.md
2. Document that both `propose` and `archive` auto-commit
3. Document commit message formats: "Propose: <Title>" and "Archive: <Title>"
4. Note that commit failures show warnings but don't fail the operation

**Validation**:
- Documentation clearly explains auto-commit behavior
- Examples provided for both commands
- Spell check passes: `npm run spell:check`

**Dependencies**: Task 1, Task 2

## Task 5: Manual testing

**Deliverable**: Verify auto-commit works in real usage scenarios

**Steps**:
1. Build the project: `npm run build` (if build script exists)
2. Test archive with clean git state
3. Test archive with other uncommitted changes (verify they're not included)
4. Test archive when git commit would fail (verify warning shown)
5. Verify commit messages have correct format

**Validation**:
- Archive auto-commits successfully in normal case
- Only spec directory files are committed
- Clear warnings shown on commit failures
- Commit message format matches spec

**Dependencies**: Task 1, Task 2
