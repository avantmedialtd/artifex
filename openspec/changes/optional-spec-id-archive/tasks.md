# Tasks

1. **Remove spec-id validation in `handleSpecArchive()`** - Remove the check that requires spec-id to be provided and the associated error message

2. **Update slash command construction** - Modify the command building logic to conditionally include spec-id in the `/openspec:archive` slash command (following the pattern used in `handleSpecApply()`)

3. **Update help text** - Modify any help text or usage information to show `[spec-id]` as optional instead of `<spec-id>` as required

4. **Test with spec-id provided** - Verify `zap spec archive <spec-id>` continues to work correctly and archives the specified spec

5. **Test without spec-id** - Verify `zap spec archive` successfully invokes Claude and allows interactive spec selection

6. **Test auto-commit with spec-id** - Verify auto-commit functionality works when spec-id is provided directly

7. **Test auto-commit without spec-id** - Verify auto-commit functionality works when spec-id is selected interactively (Claude provides the spec-id)

8. **Update test files** - Update any test files that test the archive command to cover both the optional and provided spec-id cases

9. **Run test suite** - Verify all tests pass with `npm test`

10. **Run linting and formatting** - Verify code quality with `npm run lint` and `npm run format:check`
