# Tasks: add-changes-command

This document outlines the ordered list of tasks to implement the `zap changes` command.

## Implementation Tasks

1. **Create command handler module**
   - Create `commands/changes.ts` with `handleChanges()` function
   - Implement OpenSpec CLI availability check
   - Implement argument validation (reject any arguments)
   - Execute `openspec list --changes` using spawn
   - Handle process output and exit codes
   - Add appropriate error messages with consistent formatting

2. **Add routing logic**
   - Update `router.ts` to recognize `changes` command
   - Route to `handleChanges()` function
   - Ensure placement doesn't interfere with existing command routing

3. **Update help content**
   - Add `changes` entry to `HELP_CONTENT` in `commands/help.ts`
   - Include description: "List all OpenSpec changes"
   - Include usage: "zap changes"
   - Include example showing the command output

4. **Add changes command to general help**
   - Update `showGeneralHelp()` in `commands/help.ts`
   - Add list item: "changes                List all OpenSpec changes"
   - Place in appropriate position (after archive, before versions)

5. **Write tests for command handler**
   - Create `commands/changes.test.ts`
   - Test successful execution with openspec available
   - Test error when openspec is not available
   - Test rejection of unexpected arguments
   - Test exit code propagation

6. **Validate implementation**
   - Run `npm run format:check` to ensure code formatting
   - Run `npm run lint` to check for linting errors
   - Run `npm run spell:check` to verify spelling
   - Run `npm test` to verify all tests pass
   - Manually test `zap changes` command in terminal

7. **Update documentation if needed**
   - Review CLAUDE.md to ensure changes command is covered by existing patterns
   - No updates needed unless new patterns are introduced
