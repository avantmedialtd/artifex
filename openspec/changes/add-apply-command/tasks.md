# Tasks

## Implementation

- [ ] Add `handleSpecApply()` function to [commands/spec.ts](../../../commands/spec.ts) following the pattern of `handleSpecArchive()` and `handleSpecPropose()`
  - Accept optional `changeId` parameter
  - Check Claude Code availability using `checkClaudeAvailable()`
  - Build claude command: `claude --permission-mode acceptEdits "/openspec:apply [change-id]"` (omit change-id if not provided)
  - Spawn claude process with `stdio: 'inherit'`
  - Return exit code from Claude process

- [ ] Add routing for `spec apply` in [router.ts](../../../router.ts)
  - Extract optional change-id from `args[2]`
  - Call `handleSpecApply(changeId)` when subcommand is 'apply'

- [ ] Add routing for shorthand `apply` command in [router.ts](../../../router.ts)
  - Extract optional change-id from `args[1]`
  - Call `handleSpecApply(changeId)` when top-level command is 'apply'

- [ ] Add help content for `apply` command to [commands/help.ts](../../../commands/help.ts)
  - Add entry to `HELP_CONTENT` for 'apply' shorthand
  - Update 'spec' entry to include apply example
  - Update `showGeneralHelp()` to include apply commands in output

## Testing

- [ ] Add unit tests for `handleSpecApply()` in a new test file [spec-apply.test.ts](../../../spec-apply.test.ts)
  - Test with change-id provided
  - Test without change-id
  - Test Claude Code availability check
  - Test error handling
  - Test exit code propagation

- [ ] Update [integration.test.ts](../../../integration.test.ts) to include apply command tests
  - Test `zap spec apply [change-id]`
  - Test `zap apply [change-id]`
  - Test help output includes apply command

## Validation

- [ ] Run `npm run format` to ensure code formatting
- [ ] Run `npm run lint` to check for linting issues
- [ ] Run `npm run spell:check` to verify spelling
- [ ] Run `npm test` to ensure all tests pass
- [ ] Manually test `zap apply` and `zap spec apply` commands
- [ ] Validate with `openspec validate add-apply-command --strict`
