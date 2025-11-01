<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**zap** is a development utility tool written in TypeScript. The project uses:

- **TypeScript** for type-safe code
- **Prettier** for automated code formatting
- **OXLint** for fast JavaScript/TypeScript linting
- **CSpell** for automated spell checking
- **Vitest** for testing

## Project Structure

The project follows a modular command-based architecture:

```
main.ts              - Entry point (~8 lines, delegates to router)
router.ts            - Command routing logic
commands/            - Command handler modules
├── npm.ts           - npm upgrade command
├── spec.ts          - spec archive/propose commands
├── versions.ts      - versions push/reset commands
└── help.ts          - help command
utils/               - Utility modules
├── output.ts        - Terminal output formatting with ANSI colors
└── claude.ts        - Claude Code CLI availability check
```

### Key Files

- `main.ts` - Minimal entry point that delegates to the router
- `router.ts` - Parses command-line arguments and routes to appropriate command handler
- `commands/*.ts` - Each command in its own module for maintainability and testability
- `utils/output.ts` - Consistent output formatting using ANSI color codes (no external dependencies)

## Development Commands

### Code Formatting

The project uses Prettier with custom configuration for automated code formatting:

- `npm run format` - Format all files in the project
- `npm run format:check` - Check if files are formatted correctly (fails on violations)
- `npm run format:write` - Explicitly format all files (same as `format`)

**Prettier Configuration:**

- 4-space indentation (`tabWidth: 4`)
- 100-character line width (`printWidth: 100`)
- Single quotes for strings (`singleQuote: true`)
- Trailing commas in all locations (`trailingComma: 'all'`)
- Arrow function parens only when needed (`arrowParens: 'avoid'`)
- LF line endings (`endOfLine: 'lf'`)

**Enforcement:** Formatting is enforced in CI (Jenkinsfile) and pre-push git hooks. All code must pass `npm run format:check` before being pushed.

### Linting

- `npm run lint` - Check code for linting errors
- `npm run lint:fix` - Auto-fix linting errors
- `npm run lint:check` - Check code for linting errors (same as `lint`)

### Spell Checking

The project uses CSpell for automated spell checking:

- `npm run spell:check` - Check spelling in all files

**CSpell Configuration:**

- Configuration is in `.cspell.json`
- Checks TypeScript, JavaScript, Markdown, and JSON files
- Custom dictionary for project-specific terms and proper names
- Ignores `node_modules`, `.git`, and build outputs

**Enforcement:** Spell checking is enforced in CI (Jenkinsfile). All code must pass `npm run spell:check` before being merged.

### Testing

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Architecture

### Command-Based Architecture

The CLI follows a modular command-based architecture where each command is implemented in its own module. This provides:

- **Separation of concerns** - Each command module is self-contained
- **Easy testing** - Command handlers can be tested in isolation
- **Maintainability** - Adding new commands doesn't require modifying existing code
- **Consistent error handling** - All commands use shared output utilities

### Command Handler Pattern

All command handlers follow this pattern:

```typescript
export async function handleCommandName(args...): Promise<number> {
    // 1. Validate inputs
    // 2. Perform command logic
    // 3. Return exit code (0 = success, 1 = error)
}
```

### Output Utilities

The `utils/output.ts` module provides consistent terminal output:

- **Color functions**: `success()`, `error()`, `info()`, `warn()`
- **Formatting functions**: `header()`, `section()`, `listItem()`
- **Built-in ANSI colors** - No external dependencies
- **Graceful degradation** - Works in terminals without color support

### OpenSpec Commands with Auto-Commit

The spec commands integrate with OpenSpec for managing specification changes. Two commands automatically commit their changes after successful completion:

#### `zap spec propose <text>`

Creates a new OpenSpec proposal and automatically commits it with the message format:

```
Propose: <Title>
```

Where `<Title>` is extracted from the first line of the proposal.md file (stripping `#` and optional "Proposal: " prefix).

#### `zap spec archive <spec-id>`

Archives a spec to the specs directory and automatically commits it with the message format:

```
Archive: <Title>
```

Where `<Title>` is extracted from the archived proposal.md file.

#### `zap spec apply [change-id]`

Applies an approved OpenSpec change (does not auto-commit, as changes are applied during implementation).

**Auto-Commit Behavior:**

- Only commits files in the affected directory (changes or specs)
- Shows warning messages if commit fails, but command still succeeds (exit code 0)
- Uses the `stageAndCommit` utility from `utils/git.ts`
- Title extraction uses `extractProposalTitle` from `utils/proposal.ts`
- Provides consistent developer experience across spec workflow

### Adding New Commands

To add a new command:

1. Create a command handler in `commands/your-command.ts`
2. Export an async handler function that returns exit code
3. Add routing logic to `router.ts`
4. Update help content in `commands/help.ts`
5. Add tests for the new command

Example:

```typescript
// commands/your-command.ts
import { success, error } from '../utils/output.ts';

export async function handleYourCommand(arg: string): Promise<number> {
    if (!arg) {
        error('Error: argument required');
        return 1;
    }
    // ... command logic
    success('Command completed!');
    return 0;
}

// router.ts
import { handleYourCommand } from './commands/your-command.ts';

// Add routing:
if (command === 'your-command') {
    return await handleYourCommand(subcommand);
}
```
