# Tasks: Add TODO Command

## Implementation Tasks

- [x] Create commands/todo.ts module
    - Create new file `commands/todo.ts`
    - Export async `handleTodo` function that accepts `hasArgs: boolean` parameter
    - Follow the command handler pattern from other commands
    - **Validation:** File exists and exports handleTodo function

- [x] Implement argument validation in handleTodo
    - Check if `hasArgs` is true and reject with error message
    - Display error: "Error: todo command does not accept arguments"
    - Display usage: "Usage: zap todo"
    - Return exit code 1 if arguments provided
    - **Validation:** Command rejects arguments with proper error message

- [x] Implement change directory scanning
    - Read contents of `openspec/changes/` directory
    - Filter out `archive/` subdirectory
    - Identify all active change directories
    - Handle case when directory doesn't exist or is empty
    - **Validation:** Function returns list of active change directory names

- [x] Create task parsing utility function
    - Create function `parseTasksFile(filePath: string)` that reads and parses tasks.md
    - Extract markdown checkbox items (both `- [ ]` and `- [x]` patterns)
    - Extract section headers (lines starting with `##`)
    - Preserve task descriptions and nesting levels
    - Return structured data: sections with tasks and completion status
    - **Validation:** Function correctly parses sample tasks.md file

- [x] Implement task completion counting
    - Create function to count total tasks vs completed tasks
    - Count all checkbox items in a parsed task list
    - Return object with `completed` and `total` counts
    - **Validation:** Function returns accurate counts for test data

- [x] Create visual output formatter
    - Add function to format change header with border (using `┌─`, `│`, `└─` characters)
    - Display change ID and completion count in header
    - Use `☐` symbol for unchecked tasks, `☑` for checked tasks
    - Apply colors using existing `utils/output.ts` functions
    - **Validation:** Output matches the visual design in proposal

- [x] Implement main todo command logic
    - Scan for active changes
    - For each change, check if tasks.md exists
    - Parse tasks.md if it exists
    - Calculate completion statistics
    - Format and display each change's tasks
    - Handle edge cases: no changes, missing files, empty files
    - **Validation:** Command successfully displays tasks from multiple changes

- [x] Handle edge cases and errors
    - Display "No active changes found." when no changes exist
    - Display "No tasks.md found" for changes without tasks.md
    - Display "No tasks found" for empty tasks.md files
    - Handle filesystem errors gracefully (permissions, etc.)
    - Ensure command doesn't crash on malformed markdown
    - **Validation:** All edge cases handled without crashes

- [x] Add command routing to router.ts
    - Import `handleTodo` from `./commands/todo.ts`
    - Add routing logic for `todo` command after help command
    - Pass `hasArgs` parameter based on args.length
    - **Validation:** `zap todo` routes correctly to handleTodo function

- [x] Add help content for todo command
    - Update `commands/help.ts` with todo command documentation
    - Add to command list: "todo                   Show all TODO items from active changes"
    - Add command-specific help section with description, usage, and example
    - **Validation:** `zap help` shows todo command, `zap help todo` shows detailed help

- [x] Add unit tests for task parsing
    - Create `commands/todo.test.ts`
    - Test parseTasksFile with various markdown formats
    - Test checkbox parsing (checked and unchecked)
    - Test section header extraction
    - Test nested task parsing
    - **Validation:** All parsing tests pass

- [x] Add unit tests for todo command
    - Test command rejects arguments
    - Test handling of no active changes
    - Test handling of missing tasks.md
    - Test handling of empty tasks.md
    - Test completion counting
    - **Validation:** All command tests pass

- [x] Test with real OpenSpec changes
    - Create test change directories in openspec/changes/
    - Add sample tasks.md files with various formats
    - Run `zap todo` and verify output matches expectations
    - Test visual formatting in terminal
    - **Validation:** Command produces visually appealing output

## Validation Tasks

- [x] Run all tests to ensure no breakage
    - Execute `npm test`
    - Verify all existing tests still pass
    - Verify new todo command tests pass
    - **Validation:** All tests pass

- [x] Test command integration
    - Test `zap todo` with no arguments (should work)
    - Test `zap todo arg` with arguments (should fail)
    - Test `zap help todo` shows help content
    - Test `zap todo --help` shows help content
    - **Validation:** All command variations work correctly

- [x] Test error handling
    - Test with no openspec/changes/ directory
    - Test with empty openspec/changes/ directory
    - Test with changes that have no tasks.md
    - Test with malformed tasks.md files
    - **Validation:** All error cases handled gracefully

- [x] Test visual output quality
    - Run command in various terminal emulators
    - Verify colors display correctly
    - Verify Unicode symbols (☐, ☑, ┌, │, └) render properly
    - Verify output is readable and visually appealing
    - **Validation:** Output looks good in common terminals

- [x] Verify performance
    - Create 10 test changes with tasks.md files
    - Time execution of `zap todo`
    - Ensure completion time is under 100ms
    - **Validation:** Command executes quickly

- [x] Run linting and formatting checks
    - Execute `npm run lint` to check for linting errors
    - Execute `npm run format:check` to verify formatting
    - Fix any issues found
    - **Validation:** All code quality checks pass

## Documentation Tasks

- [x] Update CLAUDE.md if needed
    - Review CLAUDE.md for any necessary updates
    - Add todo command to project overview if appropriate
    - Ensure documentation reflects new capability
    - **Validation:** Documentation is accurate and complete

- [x] Verify README.md mentions command (if applicable)
    - Check if README.md has a commands section
    - Add todo command to list if section exists
    - **Validation:** README is up to date
