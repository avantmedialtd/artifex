# Tasks: Enhance CLI UI and Code Structure

This document outlines the implementation tasks in dependency order. Tasks are designed to be small, verifiable, and deliver incremental user-visible value.

## Phase 1: Foundation - Output Utilities (No Breaking Changes)

### Task 1.1: Create output utilities module
**Goal**: Add utils/output.ts with ANSI color codes and basic formatting functions

**Implementation**:
- Create utils/output.ts
- Define ANSI color constants (red, green, yellow, blue, cyan, gray, reset)
- Implement success(), error(), info(), warn() functions
- Implement header(), section(), listItem() functions
- Add basic JSDoc comments

**Validation**:
- Manual test: Import and call each function
- Verify colors appear correctly in terminal
- Ensure no external dependencies added

**User-visible impact**: None yet (utilities not used)

---

### Task 1.2: Create Claude utilities module
**Goal**: Extract Claude Code availability check to utils/claude.ts

**Implementation**:
- Create utils/claude.ts
- Move checkClaudeAvailable() function from main.ts
- Export the function
- Add JSDoc comments

**Validation**:
- Function works identically to original
- Can be imported from utils/claude.ts
- Original function still works in main.ts (not removed yet)

**User-visible impact**: None (internal refactor only)

---

### Task 1.3: Add unit tests for output utilities
**Goal**: Ensure output utilities work correctly

**Implementation**:
- Create utils/output.test.ts
- Test each formatting function
- Verify ANSI codes are correctly applied
- Test edge cases (empty strings, special characters)

**Validation**:
- All tests pass
- npm test succeeds

**User-visible impact**: None (tests only)

---

## Phase 2: Extract Commands (No Breaking Changes)

### Task 2.1: Create NPM command module
**Goal**: Extract npm command logic to commands/npm.ts

**Implementation**:
- Create commands/npm.ts
- Create and export handleNpmUpgrade() function
- Move npm upgrade logic from main.ts to new module
- Import utils/output and use formatting functions
- Import npm-upgrade utilities

**Validation**:
- Function works identically to original
- `zap npm upgrade` produces same behavior
- Existing integration tests pass
- Output now uses formatted utilities (colors, better structure)

**User-visible impact**: Improved output formatting for npm upgrade command

---

### Task 2.2: Create spec command module
**Goal**: Extract spec command logic to commands/spec.ts

**Implementation**:
- Create commands/spec.ts
- Create and export handleSpecArchive(specId: string) function
- Create and export handleSpecPropose(text: string) function
- Move spec archive/propose logic from main.ts
- Import utils/output and utils/claude
- Use output utilities for error messages and status

**Validation**:
- `zap spec archive <id>` works identically
- `zap spec propose <text>` works identically
- `zap archive <id>` shorthand still works
- `zap propose <text>` shorthand still works
- Existing tests pass

**User-visible impact**: Improved error messages and formatting for spec commands

---

### Task 2.3: Create versions command module
**Goal**: Extract versions command logic to commands/versions.ts

**Implementation**:
- Create commands/versions.ts
- Create and export handleVersionsReset() function
- Create and export handleVersionsPush() function
- Move versions reset/push logic from main.ts
- Import utils/output for formatting
- Import git-worktree utilities
- Use output utilities for status messages and errors

**Validation**:
- `zap versions reset` works identically
- `zap versions push` works identically
- Existing tests pass
- Output uses formatted utilities

**User-visible impact**: Improved output formatting for versions commands

---

## Phase 3: Router and Entry Point (Breaking Internal Structure Only)

### Task 3.1: Create command router
**Goal**: Implement router.ts to handle command routing

**Implementation**:
- Create router.ts
- Create route(args: string[]): Promise<number> function
- Implement routing logic for all commands
- Import all command handlers
- Handle unknown commands
- Validate command structure

**Validation**:
- Unit tests for router covering all commands
- Test routing for: npm, spec, propose, archive, versions
- Test unknown command handling
- Test edge cases (no args, invalid args)

**User-visible impact**: None yet (router not used)

---

### Task 3.2: Update main.ts to use router
**Goal**: Replace monolithic routing in main.ts with router delegation

**Implementation**:
- Update main.ts to import router
- Replace all command routing logic with single call to route()
- Exit with status code returned by router
- Remove old runXxx() functions (now in command modules)
- Remove checkClaudeAvailable() (now in utils/claude.ts)

**Validation**:
- All existing commands work identically
- All integration tests pass unchanged
- main.ts is now <80 lines
- Code is cleaner and easier to understand

**User-visible impact**: None (internal refactor, behavior unchanged)

---

## Phase 4: Help System (New User-Facing Feature)

### Task 4.1: Create help content and command module
**Goal**: Implement help command with content for all commands

**Implementation**:
- Create commands/help.ts
- Define help content for each command
- Implement handleHelp(command?: string) function
- Format help output using output utilities
- Include: usage, description, examples for each command
- Handle unknown commands gracefully

**Validation**:
- Manual test: Run handleHelp() and review output
- Verify formatting is clear and consistent
- Check that all commands are documented

**User-visible impact**: None yet (help not wired up)

---

### Task 4.2: Add help command to router
**Goal**: Make help accessible via `zap help`

**Implementation**:
- Update router.ts to handle "help" command
- Route `zap help` to handleHelp()
- Route `zap help <command>` to handleHelp(command)
- Handle empty args (no command) to show default message

**Validation**:
- `zap help` displays general help
- `zap help <command>` displays command-specific help
- `zap help unknown` shows error with suggestion
- Help output is well-formatted and readable

**User-visible impact**: Users can now run `zap help` to discover commands

---

### Task 4.3: Add --help flag support
**Goal**: Support `--help` and `-h` flags for all commands

**Implementation**:
- Update router.ts to detect --help and -h flags
- If --help is first arg, route to help
- If --help is with a command, show command-specific help
- Handle both `zap --help` and `zap <command> --help`

**Validation**:
- `zap --help` works (same as `zap help`)
- `zap -h` works (same as `zap help`)
- `zap npm --help` shows npm help
- `zap versions reset --help` shows versions reset help
- Flag works for all commands

**User-visible impact**: Standard --help flag works across all commands

---

## Phase 5: Polish and Documentation

### Task 5.1: Update all command error messages
**Goal**: Ensure all error messages use improved formatting and provide context

**Implementation**:
- Review all error messages in command modules
- Update to use error() utility consistently
- Add helpful context and suggestions where appropriate
- Ensure errors reference help command when relevant

**Validation**:
- Manually trigger each error condition
- Verify error messages are helpful and well-formatted
- Check that suggestions are accurate

**User-visible impact**: All error messages are clearer and more helpful

---

### Task 5.2: Verify integration tests and update if needed
**Goal**: Ensure all tests pass and cover new functionality

**Implementation**:
- Run full test suite
- Update tests if output formatting has changed
- Add tests for help command
- Add tests for --help flag
- Ensure router is tested

**Validation**:
- npm test passes
- Test coverage is maintained or improved
- All commands tested through integration tests

**User-visible impact**: None (testing only)

---

### Task 5.3: Update CLAUDE.md with new structure
**Goal**: Document the new modular structure for future AI development

**Implementation**:
- Update CLAUDE.md architecture section
- Document commands/ structure
- Document utils/ modules
- Explain router pattern
- Add notes about adding new commands

**Validation**:
- Documentation is clear and accurate
- Reflects current codebase structure

**User-visible impact**: Better documentation for contributors

---

## Testing Strategy

### Unit Tests
- utils/output.test.ts - Test formatting functions
- utils/claude.test.ts - Test Claude availability check
- router.test.ts - Test command routing logic
- commands/help.test.ts - Test help content generation

### Integration Tests
- Existing integration.test.ts should pass without modification
- Commands should work identically to before refactoring
- Output may differ cosmetically (colors, formatting) but functionality is same

### Manual Testing Checklist
- [ ] `zap` - Shows ready message
- [ ] `zap help` - Shows help
- [ ] `zap --help` - Shows help
- [ ] `zap -h` - Shows help
- [ ] `zap help npm` - Shows npm help
- [ ] `zap npm upgrade` - Works with improved output
- [ ] `zap spec propose <text>` - Works with improved output
- [ ] `zap propose <text>` - Shorthand works
- [ ] `zap spec archive <id>` - Works with improved output
- [ ] `zap archive <id>` - Shorthand works
- [ ] `zap versions reset` - Works with improved output
- [ ] `zap versions push` - Works with improved output
- [ ] `zap unknown` - Shows helpful error
- [ ] All error conditions - Show improved error messages

## Dependencies Between Tasks

```
Phase 1: Foundation
1.1 (output utils) ──┬──> 1.3 (output tests)
                     │
1.2 (claude utils) ──┴──> Phase 2

Phase 2: Extract Commands
2.1 (npm cmd) ───┬
2.2 (spec cmd) ──┼──> Phase 3
2.3 (versions) ──┘

Phase 3: Router
3.1 (router) ──> 3.2 (update main) ──> Phase 4

Phase 4: Help System
4.1 (help cmd) ──> 4.2 (add to router) ──> 4.3 (--help flag) ──> Phase 5

Phase 5: Polish
5.1 (polish errors) ──┬
5.2 (verify tests) ───┼──> Done
5.3 (docs) ───────────┘
```

## Parallel Work Opportunities

- Tasks 2.1, 2.2, 2.3 can be done in parallel after Phase 1 completes
- Tasks 5.1, 5.3 can be done in parallel
- Unit tests can be written alongside implementation tasks
