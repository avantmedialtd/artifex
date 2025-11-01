# Tasks

- [x] **Remove spec-id validation in `handleSpecArchive()`** - Remove the check that requires spec-id to be provided and the associated error message

- [x] **Update slash command construction** - Modify the command building logic to conditionally include spec-id in the `/openspec:archive` slash command (following the pattern used in `handleSpecApply()`)

- [x] **Update help text** - Modify any help text or usage information to show `[spec-id]` as optional instead of `<spec-id>` as required

- [x] **Test with spec-id provided** - Verify `zap spec archive <spec-id>` continues to work correctly and archives the specified spec

- [x] **Test without spec-id** - Verify `zap spec archive` successfully invokes Claude and allows interactive spec selection

- [x] **Test auto-commit with spec-id** - Verify auto-commit functionality works when spec-id is provided directly

- [x] **Test auto-commit without spec-id** - Verify auto-commit functionality works when spec-id is selected interactively (Claude provides the spec-id)

- [x] **Update test files** - Update any test files that test the archive command to cover both the optional and provided spec-id cases

- [x] **Run test suite** - Verify all tests pass with `npm test`

- [x] **Run linting and formatting** - Verify code quality with `npm run lint` and `npm run format:check`
