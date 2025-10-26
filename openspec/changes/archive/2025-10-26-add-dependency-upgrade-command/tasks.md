# Tasks: Add Dependency Upgrade Command

## Implementation Tasks

- [x] **Add command-line argument parsing**
    - **Priority**: High
    - **Dependencies**: None
    - **Validation**: Run `zap` and `zap npm upgrade` - should recognize the command
    - Parse process.argv to detect `npm` subcommand and `upgrade` sub-subcommand
    - Add logic to route to npm upgrade command handler
    - Display helpful error for unknown subcommands
    - Test: `zap` with no args, `zap npm upgrade`, `zap npm`, `zap invalid-command`

- [x] **Implement npm outdated execution and parsing**
    - **Priority**: High
    - **Dependencies**: Task 1
    - **Validation**: Unit tests for parsing npm outdated output
    - Execute `npm outdated --json` via child_process
    - Parse JSON output to extract list of outdated packages
    - Handle empty result (no packages need updating)
    - Handle npm command failures (missing package.json, network errors)
    - Test: Valid output with outdated packages, empty output, error cases

- [x] **Implement package upgrade loop**
    - **Priority**: High
    - **Dependencies**: Task 2
    - **Validation**: Integration test with test project
    - Iterate through list of outdated packages from npm outdated
    - For each package, execute `npm install <package>@latest`
    - Run installations sequentially (not in parallel)
    - Stream npm install output to console
    - Capture exit code for each install command
    - Continue with remaining packages if one fails
    - Test: Multiple packages, single package, failed installation

- [x] **Add error handling and reporting**
    - **Priority**: High
    - **Dependencies**: Tasks 2-3
    - **Validation**: Test various error scenarios
    - Track which packages succeeded and which failed
    - Display clear error messages for npm command failures
    - Exit with non-zero code if critical errors occur (npm outdated fails)
    - Exit with appropriate code based on upgrade results
    - Test: All succeed, all fail, partial success, npm outdated fails

- [x] **Add user-facing output and progress reporting**
    - **Priority**: Medium
    - **Dependencies**: Tasks 2-4
    - **Validation**: Manual testing for output clarity
    - Display message when starting upgrade process
    - Show summary of packages to be upgraded (from npm outdated)
    - Show progress as each package is being installed
    - Display final summary: X packages upgraded, Y failed
    - Handle case where no upgrades are available
    - Test: Multiple packages, no upgrades available, partial failures

- [x] **Set up Vitest test configuration**
    - **Priority**: High
    - **Dependencies**: None (can be done early)
    - **Validation**: `npm test` runs successfully
    - Install Vitest as devDependency
    - Configure vitest.config.ts
    - Update package.json test script to run vitest
    - Create basic smoke test to verify setup works
    - Test: Run `npm test` and verify it executes

- [x] **Add unit tests for core functions**
    - **Priority**: High
    - **Dependencies**: Tasks 2-5, 6
    - **Validation**: `npm test` passes with good coverage
    - Write tests for command argument parsing
    - Write tests for parsing npm outdated JSON output
    - Mock child_process.spawn/exec for testing npm commands
    - Test error handling for various failure scenarios
    - Aim for >80% code coverage on core logic

- [x] **Add integration tests**
    - **Priority**: High
    - **Dependencies**: Tasks 6-7
    - **Validation**: Integration tests pass
    - Create test fixtures: sample projects with outdated dependencies
    - Test full workflow with real npm commands (or mocked in CI)
    - Test error scenarios: missing package.json, network failures
    - Test edge cases: no upgrades needed, all packages fail to upgrade
    - Verify npm updates package.json and package-lock.json correctly

- [x] **Update main.ts entry point**
    - **Priority**: High
    - **Dependencies**: Tasks 1-5
    - **Validation**: End-to-end test with real package.json
    - Import and call npm upgrade command when detected
    - Keep existing "zap CLI ready" output when no subcommand provided
    - Ensure proper error handling and exit codes throughout
    - Test: Run against real project to upgrade its dependencies

- [x] **Manual testing and refinement**
    - **Priority**: Medium
    - **Dependencies**: All above
    - **Validation**: Successfully upgrade dependencies in zap project itself
    - Run `zap npm upgrade` on the zap project itself (once it has dependencies)
    - Verify all dependencies upgrade correctly
    - Check that package.json formatting is preserved by npm
    - Verify package-lock.json is updated correctly
    - Check output messages for clarity and usefulness
    - Test on different projects with various dependency configurations

## Notes

- Tasks 2-5 implement the core upgrade logic and can be developed incrementally
- Task 6 (test setup) can be done early in parallel with implementation
- Tasks 7-8 (testing) should be done alongside implementation tasks
- Task 9 integrates everything into the main CLI entry point
- Task 10 is the final validation before considering the change complete
- This simpler approach means fewer tasks and less code than manual package.json manipulation
