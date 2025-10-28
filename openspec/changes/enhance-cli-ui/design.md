# Design: Enhance CLI UI and Code Structure

## Architecture Overview

The enhancement involves refactoring the CLI from a monolithic structure to a modular command-based architecture while adding UI utilities for consistent output.

### Current Architecture

```
main.ts (370 lines)
├── Command routing (if/else chain)
├── runNpmUpgrade()
├── runSpecArchive()
├── runSpecPropose()
├── runVersionsPush()
├── runVersionsReset()
└── checkClaudeAvailable()
```

### Proposed Architecture

```
main.ts (entry point, ~50 lines)
├── commands/
│   ├── npm.ts (runNpmUpgrade)
│   ├── spec.ts (runSpecArchive, runSpecPropose)
│   ├── versions.ts (runVersionsPush, runVersionsReset)
│   └── help.ts (new - help command)
├── utils/
│   ├── output.ts (formatting utilities)
│   └── claude.ts (checkClaudeAvailable, moved)
└── router.ts (command routing logic)
```

## Component Design

### 1. Command Router (router.ts)

**Responsibility**: Parse arguments and route to appropriate command handler

**Interface**:
```typescript
export async function route(args: string[]): Promise<number>
```

**Implementation Notes**:
- Returns exit code (0 = success, 1 = error)
- Handles unknown commands
- Validates command structure
- Delegates to command modules

### 2. Command Modules (commands/*.ts)

**Responsibility**: Implement specific command logic

**Pattern**:
```typescript
// Each command module exports handler functions
export async function handleNpmUpgrade(): Promise<number>
export async function handleSpecArchive(specId: string): Promise<number>
export async function handleSpecPropose(text: string): Promise<number>
export async function handleVersionsPush(): Promise<number>
export async function handleVersionsReset(): Promise<number>
export async function handleHelp(command?: string): Promise<number>
```

**Benefits**:
- Each command in its own file
- Easier to test in isolation
- Clear separation of concerns
- Easier to add new commands

### 3. Output Utilities (utils/output.ts)

**Responsibility**: Provide consistent formatting and colors

**Interface**:
```typescript
// ANSI color codes (no external dependencies)
export const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
}

// Output functions
export function success(message: string): void
export function error(message: string): void
export function info(message: string): void
export function warn(message: string): void
export function header(message: string): void
export function section(message: string): void
export function listItem(message: string, symbol?: string): void
```

**Benefits**:
- Consistent visual hierarchy
- Easy to change styling globally
- No external dependencies (uses ANSI codes)
- Terminal-friendly (degrades gracefully)

### 4. Help System (commands/help.ts)

**Responsibility**: Display help information

**Design**:
- `zap help` - Show all commands
- `zap help <command>` - Show command-specific help
- `zap <command> --help` - Alias for command help

**Help Content**:
```
zap - Development utility CLI

USAGE
  zap <command> [options]

COMMANDS
  npm upgrade            Upgrade all outdated npm packages
  spec propose <text>    Create a new OpenSpec proposal
  spec archive <id>      Archive an OpenSpec change
  propose <text>         Shorthand for 'spec propose'
  archive <id>           Shorthand for 'spec archive'
  versions reset         Reset version worktrees to HEAD
  versions push          Force push version worktrees
  help [command]         Show help for a command

OPTIONS
  --help, -h            Show help information

Run 'zap help <command>' for more information on a command.
```

## Migration Strategy

### Phase 1: Add Utilities (Non-Breaking)
1. Create utils/output.ts
2. Create utils/claude.ts (move checkClaudeAvailable)
3. No changes to main.ts yet

### Phase 2: Extract Commands (Non-Breaking)
1. Create commands/*.ts files with command handlers
2. Keep existing functions in main.ts as wrappers
3. Test each extraction

### Phase 3: Create Router (Non-Breaking)
1. Create router.ts
2. Update main.ts to use router
3. Remove old routing logic

### Phase 4: Add Help System
1. Create commands/help.ts
2. Add help command to router
3. Add --help flag support

### Testing Strategy

- Unit tests for each command module
- Integration tests remain unchanged (test CLI as black box)
- Existing tests should pass throughout migration

## Trade-offs

### Chosen: Multiple Small Modules
**Pro**: Clear organization, easy to find code, better testability
**Con**: More files to navigate

### Rejected: Single commands.ts File
**Pro**: Fewer files
**Con**: Would still be large (~300 lines), defeats purpose of refactoring

### Chosen: Built-in ANSI Colors
**Pro**: No dependencies, fast, simple
**Con**: More verbose than a library, no advanced features

### Rejected: External Color Library (chalk, picocolors)
**Pro**: More features, cleaner API
**Con**: External dependency (conflicts with project goal of minimal dependencies)

## Implementation Checklist

- [ ] Create utils/output.ts with ANSI color utilities
- [ ] Create utils/claude.ts and move checkClaudeAvailable
- [ ] Create commands/npm.ts with handleNpmUpgrade
- [ ] Create commands/spec.ts with handleSpecArchive and handleSpecPropose
- [ ] Create commands/versions.ts with handleVersionsPush and handleVersionsReset
- [ ] Create router.ts with route function
- [ ] Create commands/help.ts with handleHelp
- [ ] Update main.ts to use router
- [ ] Update all commands to use output utilities
- [ ] Add --help flag support to router
- [ ] Update tests to verify new structure
- [ ] Ensure all existing integration tests pass
