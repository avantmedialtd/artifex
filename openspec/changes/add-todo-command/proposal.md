# Proposal: Add TODO Command

## Overview

Add a `zap todo` command that displays all TODO items from pending OpenSpec changes in a visually appealing format. The command will parse `tasks.md` files from all active changes in `openspec/changes/` and display them organized by change, showing task checkboxes and progress.

## Motivation

Developers working with multiple OpenSpec changes need a quick way to see all pending tasks across all active changes without manually checking each `tasks.md` file. The existing `zap changes` command shows change summaries, but doesn't display the detailed task lists. A dedicated `todo` command provides:

- **Visibility**: See all pending work at a glance
- **Progress tracking**: Visual checkboxes show completion status
- **Organization**: Tasks grouped by change for context
- **Developer experience**: Attractive formatting makes task lists easy to scan

## User Experience

When a developer runs `zap todo`, they see:

```
📋 TODO Items

┌─ add-new-feature (3/10 tasks completed)
│
│  Implementation Tasks
│  ☐ Set up database schema
│  ☐ Create API endpoints
│  ☑ Write unit tests
│
│  Validation Tasks
│  ☐ Test API integration
│  ☐ Run performance benchmarks
│
└─────────────────────────────────

┌─ refactor-auth (5/8 tasks completed)
│
│  Refactoring Tasks
│  ☑ Extract authentication logic
│  ☑ Update test suite
│  ☐ Update documentation
│
└─────────────────────────────────
```

If no active changes exist:
```
No active changes found.
```

## Scope

### In Scope

- Parse `tasks.md` files from all directories in `openspec/changes/` (excluding `archive/`)
- Display tasks organized by change with visual hierarchy
- Show checkbox status (checked vs unchecked)
- Count completed vs total tasks per change
- Use colors and symbols for visual appeal
- Handle missing or malformed `tasks.md` files gracefully
- Support command help via `zap help todo` or `zap todo --help`

### Out of Scope

- Modifying or updating task status (read-only command)
- Filtering or searching specific tasks
- Interactive task selection or completion
- Integration with external task management tools
- Showing archived changes (only active changes)

## Dependencies

- Requires access to filesystem to read `tasks.md` files
- Uses existing `utils/output.ts` for consistent terminal formatting
- No new external dependencies required

## Alternatives Considered

1. **Extend `zap changes` command**: Decided against this to keep commands focused and avoid overloading `changes` with too much output
2. **Use OpenSpec CLI**: Could use `openspec show <change> --json` but would require multiple calls and parsing; direct file reading is simpler
3. **Interactive UI**: Considered using prompts/inquirer for task selection, but decided to keep it simple as a read-only command first

## Success Criteria

- Command successfully parses and displays tasks from all active changes
- Output is visually appealing and easy to scan
- Performance is fast (<100ms for typical projects with 5-10 active changes)
- Error handling works for missing files, empty directories, malformed markdown
- Command integrates seamlessly with existing help system
