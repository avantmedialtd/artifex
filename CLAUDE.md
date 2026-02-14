## Plan Mode and OpenSpec

For significant changes, Claude MUST scaffold an OpenSpec proposal immediately after the user approves the plan and Plan mode exits.

### When to Create OpenSpec

Create an OpenSpec for:

- New features or capabilities
- Breaking changes (API, schema)
- Architecture changes or new patterns
- Performance or security work

Skip OpenSpec for:

- Bug fixes (restoring intended behavior)
- Typos, formatting, comments
- Non-breaking dependency updates
- Configuration changes
- Tests for existing behavior

### During Plan Mode

While planning, use a Task agent (subagent_type=Explore) to review existing OpenSpecs for context. The agent should:

1. Run `openspec list` to see active changes
2. Read relevant `openspec/changes/*/proposal.md` files
3. Summarize ongoing work and flag potential conflicts or dependencies

### OpenSpec Scaffolding Steps

After Plan mode exits (before starting implementation):

1. Read `openspec/AGENTS.md` for format reference
2. Check `openspec list` for conflicts with existing changes
3. Choose a unique change-id (kebab-case, verb-led: `add-`, `update-`, `remove-`, `refactor-`)
4. Create directory: `openspec/changes/<change-id>/`
5. Write files:
    - `proposal.md` - Why, What Changes, Impact
    - `tasks.md` - Implementation checklist
    - `design.md` - Only if cross-cutting, new patterns, or security/performance
    - `specs/<capability>/spec.md` - Deltas with ADDED/MODIFIED/REMOVED sections
6. Run `openspec validate <change-id> --strict`
7. Then proceed with implementation

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Artifex** is a development utility tool written in TypeScript. The project uses:

- **TypeScript** for type-safe code
- **Bun** for CLI runtime (native TypeScript/JSX execution)
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
├── bun.ts           - bun upgrade command
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

- `bun run format` - Format all files in the project
- `bun run format:check` - Check if files are formatted correctly (fails on violations)
- `bun run format:write` - Explicitly format all files (same as `format`)

**Prettier Configuration:**

- 4-space indentation (`tabWidth: 4`)
- 100-character line width (`printWidth: 100`)
- Single quotes for strings (`singleQuote: true`)
- Trailing commas in all locations (`trailingComma: 'all'`)
- Arrow function parens only when needed (`arrowParens: 'avoid'`)
- LF line endings (`endOfLine: 'lf'`)

**Enforcement:** Formatting is enforced in CI (Jenkinsfile) and pre-push git hooks. All code must pass `bun run format:check` before being pushed.

### Linting

- `bun run lint` - Check code for linting errors
- `bun run lint:fix` - Auto-fix linting errors
- `bun run lint:check` - Check code for linting errors (same as `lint`)

### Spell Checking

The project uses CSpell for automated spell checking:

- `bun run spell:check` - Check spelling in all files

**CSpell Configuration:**

- Configuration is in `.cspell.json`
- Checks TypeScript, JavaScript, Markdown, and JSON files
- Custom dictionary for project-specific terms and proper names
- Ignores `node_modules`, `.git`, and build outputs

**Enforcement:** Spell checking is enforced in CI (Jenkinsfile). All code must pass `bun run spell:check` before being merged.

### Testing

- `bun test` - Run all tests
- `bun run test:watch` - Run tests in watch mode
- `bun run test:coverage` - Run tests with coverage report

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
- **Uses chalk** - Color library from Ink's dependencies
- **Graceful degradation** - Works in terminals without color support

### Ink UI Framework Integration

The project uses **Ink** (https://github.com/vadimdemedes/ink) for building interactive command-line interfaces with React components. Ink enables rich UI features including live progress indicators, interactive forms, real-time dashboards, and complex layouts using React's component model and Flexbox.

#### Component Library

All Ink components are located in the `components/` directory:

```
components/
├── messages.tsx       # Success, Error, Info, Warn components
├── layout.tsx         # Header, Section, ListItem components
├── progress.tsx       # Spinner, ProgressBar components
├── input.tsx          # TextInput component
├── select.tsx         # Select/Choice component with keyboard navigation
├── confirm.tsx        # Confirmation (yes/no) component
├── table.tsx          # Data table with Flexbox layout
└── status-display.tsx # Multi-line live status display
```

#### Rendering Patterns

**Pattern 1: Static Output (Simple Messages)**

For simple, one-off messages, use the backward-compatible wrapper functions in `utils/output.ts`:

```typescript
import { success, error, info, warn, header, section, listItem } from '../utils/output.ts';

success('Operation completed!');
error('Something went wrong');
header('Processing Files');
listItem('file1.txt');
```

These functions use chalk for coloring and are optimized for static content.

**Pattern 2: Interactive Components (Full Control)**

For interactive or live-updating UI, render Ink components directly:

```typescript
import { render } from '../utils/ink-render.tsx';
import { Spinner } from '../components/progress.tsx';

function MyComponent() {
    return <Spinner label="Loading..." />;
}

const { waitUntilExit } = render(<MyComponent />);
await waitUntilExit();
```

#### Available Components

**Message Components** (`components/messages.tsx`)

- `<Success message="..." />` - Green success message
- `<Error message="..." />` - Red error message
- `<Info message="..." />` - Cyan info message
- `<Warn message="..." />` - Yellow warning message

**Layout Components** (`components/layout.tsx`)

- `<Header>text</Header>` - Blue header with spacing
- `<Section>text</Section>` - Cyan section header with spacing
- `<ListItem symbol="•">text</ListItem>` - Indented list item with symbol

**Progress Components** (`components/progress.tsx`)

- `<Spinner label="..." />` - Animated spinner with optional label
- `<ProgressBar value={50} label="..." width={40} />` - Progress bar with percentage

**Input Components** (`components/input.tsx`)

- `<TextInput placeholder="..." onChange={...} onSubmit={...} />` - Text input with keyboard handling

**Selection Components** (`components/select.tsx`)

- `<Select options={[...]} onSelect={...} />` - Single-select menu with keyboard navigation
- `<Select options={[...]} multiSelect onSubmit={...} />` - Multi-select menu

**Confirmation Component** (`components/confirm.tsx`)

- `<Confirm message="..." onConfirm={...} />` - Yes/no prompt

**Table Component** (`components/table.tsx`)

- `<Table data={[...]} columns={[...]} />` - Flexible table with auto-width columns

**Status Display** (`components/status-display.tsx`)

- `<StatusDisplay statuses={[...]} />` - Multi-line status tracker for parallel operations

#### Signal Handling

The `render()` utility in `utils/ink-render.tsx` automatically handles SIGINT (Ctrl+C) and SIGTERM signals for graceful shutdown. Components will unmount cleanly when the user interrupts execution.

#### TypeScript and JSX

- **File extensions**: Use `.tsx` for files with JSX, `.ts` for files without JSX
- **Runtime**: The CLI executables use Bun (`#!/usr/bin/env bun`) for native TypeScript and JSX execution without transpilation
- **Configuration**: `tsconfig.json` is configured with `"jsx": "react-jsx"` and `"allowImportingTsExtensions": true`
- **Imports**: Use `.ts` or `.tsx` extensions in import statements (ES module convention)

#### Demo Command

Run `af demo` to see all Ink components in action with live updates, animations, and interactive features. This serves as a reference implementation showing:

- Static message and layout components
- Animated spinners and progress bars
- Live-updating status displays
- Component lifecycle and state management

Example output:

```
Ink Component Demo

Message Components
  ✓ Operation completed successfully!
  ✗ An error occurred
  ℹ This is an informational message
  ⚠ Warning message

Progress Indicators
  ⠋ Loading...
  Building project ████████░░░░░░░░░░ 45%

Status Tracking
  ✓ Installing dependencies...
  ⟳ Running tests...
  ○ Building project...
```

#### Best Practices

1. **Use static output for simple messages** - The wrapper functions are optimized for fire-and-forget output
2. **Use Ink components for interactive UI** - Leverage React hooks and state management for dynamic interfaces
3. **Handle cleanup properly** - Use `useEffect` cleanup functions for timers and subscriptions
4. **Test in real terminals** - Interactive components should be tested in actual terminal emulators
5. **Add detailed comments** - Explain Ink-specific patterns for future contributors

### OpenSpec Commands with Auto-Commit

The spec commands integrate with OpenSpec for managing specification changes. Two commands automatically commit their changes after successful completion:

#### `af spec propose <text>`

Creates a new OpenSpec proposal and automatically commits it with the message format:

```
Propose: <Title>
```

Where `<Title>` is extracted from the first line of the proposal.md file (stripping `#` and optional "Proposal: " prefix).

#### `af spec archive <spec-id>`

Archives a spec to the specs directory and automatically commits it with the message format:

```
Archive: <Title>
```

Where `<Title>` is extracted from the archived proposal.md file.

#### `af spec apply [change-id]`

Applies an approved OpenSpec change (does not auto-commit, as changes are applied during implementation).

### Stop Hook Command

The `af stop-hook` command conditionally runs E2E tests based on whether relevant source files have changed. It's designed to be used as a Claude Code Stop hook to avoid running slow E2E tests when only non-code files (like OpenSpec proposals) were modified.

#### Usage

```bash
af stop-hook  # Check for changes and run e2e if needed
```

#### Behavior

1. Detects changed files using git (staged, unstaged, and untracked)
2. Filters out ignored paths (default: `openspec/`)
3. If relevant files changed: runs `af e2e`
4. If only ignored paths changed: exits 0 (skips e2e)

#### Exit Codes

- `0` - Success (e2e passed or skipped)
- `2` - E2E tests failed

#### Configuration

Create an optional `af.json` in the project root to customize behavior:

```json
{
    "stopHook": {
        "ignoredPaths": ["openspec/", "docs/", "scripts/"],
        "command": "npm run test:e2e"
    }
}
```

All settings are optional. If `ignoredPaths` is specified, it completely replaces the defaults.

#### Claude Code Hook Setup

Add to your `.claude/settings.json`:

```json
{
    "hooks": {
        "Stop": [
            {
                "matcher": "",
                "hooks": [
                    {
                        "type": "command",
                        "command": "af stop-hook",
                        "timeout": 3600
                    }
                ]
            }
        ]
    }
}
```

### Setup Command

The `af setup` command copies bundled Claude configuration files (commands, skills, settings) to the user's home directory (`~/.claude/`).

#### Usage

```bash
af setup              # Copy files to ~/.claude/
af setup --list       # Preview files without copying
af setup --force      # Overwrite existing files without prompting
```

#### Conflict Resolution

When a target file already exists, the command prompts for resolution:

- `y` - Overwrite this file
- `n` - Skip this file
- `a` - Overwrite all remaining files
- `s` - Skip all remaining files

Use `--force` to automatically overwrite all files without prompting.

#### Build-Time File Discovery

Setup files are discovered dynamically at build time. The `scripts/generate-setup-manifest.ts` script scans the `setup/` directory and generates `generated/setup-manifest.ts` with Bun's `{ type: "file" }` imports. This embeds all files into the compiled binary.

To add new setup files:

1. Add the file to `setup/.claude/` directory
2. Run `bun run generate:manifest` (or it runs automatically during `bun run compile`)
3. The file will be included in the next build

#### Standalone Binary Compatibility

The setup command works identically whether running from source (`./af setup`) or from the compiled binary. In compiled mode, files are read from the embedded bundle. In development mode, files are read from the `setup/` directory.

### Configurable Agent Command

The spec commands use the `ARTIFEX_AGENT` environment variable to determine which AI agent command to invoke. This provides flexibility for:

- Development and testing with alternative agent implementations
- Custom CLI wrappers or agent tools
- Non-standard installation paths

**Implementation:**

- `utils/claude.ts` exports `getAgentCommand()` which returns `process.env.ARTIFEX_AGENT || 'claude'`
- All `spawn()` calls use `getAgentCommand()` instead of hardcoded `'claude'`
- Availability checks use the configured agent command
- Error messages reference "Claude Code CLI" for backward compatibility

**Example usage:**

```bash
# Use default claude command
af spec propose "add feature"

# Use custom agent
ARTIFEX_AGENT=my-agent af spec propose "add feature"
```

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
