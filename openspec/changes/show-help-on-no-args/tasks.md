# Implementation Tasks

## Task List

1. **Update router to show help on no arguments**
   - Modify `router.ts` line 16-18 to call `handleHelp()` instead of printing "zap CLI ready"
   - Change `return 0` to `return await handleHelp()`
   - **Validation**: Run `./zap` and verify help page is displayed

2. **Add unit tests for no-args behavior**
   - Create or update router tests to verify `route([])` calls help handler
   - Verify exit code is 0
   - Verify output matches `route(['help'])` output
   - **Validation**: Run `npm test` and ensure new tests pass

3. **Verify help output consistency**
   - Manually test `./zap`, `./zap help`, and `./zap --help` produce identical output
   - Verify all commands are listed in the help
   - **Validation**: Visual inspection of terminal output

4. **Run formatting and linting**
   - Run `npm run format` to format code changes
   - Run `npm run lint` to check for linting issues
   - Run `npm run spell:check` to verify spelling
   - **Validation**: All checks pass with no errors

5. **Update CLAUDE.md if needed**
   - Review if documentation needs updating to reflect new behavior
   - Update any examples showing "zap CLI ready" output
   - **Validation**: Documentation accurately describes current behavior

## Dependencies

- Tasks 1 and 2 can be done in parallel
- Task 3 depends on Task 1 being completed
- Task 4 can run after code changes are complete
- Task 5 is final documentation polish

## Success Criteria

- ✅ `./zap` displays help page (not "zap CLI ready")
- ✅ Exit code is 0
- ✅ Output matches `./zap help` exactly
- ✅ All tests pass
- ✅ Code passes formatting and linting checks
- ✅ Documentation is accurate
