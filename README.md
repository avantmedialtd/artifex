# Zap ⚡

A lightweight CLI development utility that helps you automate common development tasks.

> **Note:** Zap is in early-stage development. Features and APIs may change as the project evolves.

## What is Zap?

Zap is a command-line tool designed to streamline your development workflow by automating repetitive tasks. Currently, it helps you keep your project dependencies up to date with a single command, and it's built to be fast and easy to use.

### Why Zap?

- **Simple**: One command to upgrade all your npm dependencies
- **Fast**: Built with performance in mind, runs TypeScript directly without build steps
- **Developer-friendly**: Clear output and sensible defaults
- **Lightweight**: Minimal dependencies, maximum efficiency

## Installation

### Prerequisites

- Node.js 22.6.0 or higher

### Install Locally

Since Zap is not yet published to npm, you can install it locally using npm link:

```bash
# Clone the repository
git clone https://github.com/avantmedialtd/zap.git
cd zap

# Install dependencies
npm install

# Link the package globally
npm link
```

After linking, the `zap` command will be available globally in your terminal.

### Platform Support

Zap works on:

- macOS
- Linux
- Windows

## Usage

### Upgrade NPM Dependencies

Upgrade all dependencies in your project to their latest versions:

```bash
zap npm upgrade
```

This command will:

1. Read your `package.json` file
2. Check the npm registry for the latest version of each dependency
3. Update both `dependencies` and `devDependencies` to the latest versions
4. Preserve your existing version range symbols (^, ~, etc.)
5. Automatically run `npm install` to apply the changes

**Example:**

```bash
cd my-project
zap npm upgrade
```

**Output:**

```
Upgrading dependencies in package.json...
  express: ^4.18.0 → ^4.19.2
  typescript: ^5.0.0 → ^5.4.5
Running npm install...
Done! All dependencies upgraded.
```

### Propose OpenSpec Changes

Create a new OpenSpec change proposal using Claude Code:

```bash
zap spec propose <proposal-text>
```

This command provides a convenient wrapper for initiating an OpenSpec proposal workflow. It automatically executes `claude --permission-mode acceptEdits "/openspec:proposal <proposal-text>"` for you.

**Prerequisites:**

- [Claude Code CLI](https://claude.com/claude-code) must be installed and available in your PATH
- Your project must have OpenSpec configured

**Examples:**

```bash
# Create a proposal with single-word text
zap spec propose "Add user authentication"

# Create a proposal with multi-word text (quotes optional)
zap spec propose Add new API endpoints for user management
```

This will:

1. Check if Claude Code CLI is available
2. Invoke the OpenSpec proposal workflow
3. Create a new change proposal with AI assistance
4. Automatically commit the proposal files with message format: "Propose: <Title>"

### Archive OpenSpec Changes

Archive a deployed OpenSpec change using Claude Code:

```bash
zap spec archive <spec-id>
```

This command provides a convenient wrapper for invoking Claude Code's OpenSpec archive workflow. It automatically executes `claude --permission-mode acceptEdits "/openspec:archive <spec-id>"` for you.

**Prerequisites:**

- [Claude Code CLI](https://claude.com/claude-code) must be installed and available in your PATH
- The OpenSpec change must exist in your project's `openspec/changes` directory

**Example:**

```bash
# Archive a completed OpenSpec change
zap spec archive add-user-authentication
```

This will:

1. Check if Claude Code CLI is available
2. Invoke the OpenSpec archive workflow
3. Archive the change and update related specifications

### Apply OpenSpec Changes

Apply an approved OpenSpec change using Claude Code:

```bash
zap spec apply [change-id]
```

This command provides a convenient wrapper for invoking Claude Code's OpenSpec apply workflow. It automatically executes `claude --permission-mode acceptEdits "/openspec:apply [change-id]"` for you.

**Prerequisites:**

- [Claude Code CLI](https://claude.com/claude-code) must be installed and available in your PATH
- The OpenSpec change must exist in your project's `openspec/changes` directory

**Example:**

```bash
# Apply a specific change
zap spec apply add-user-authentication

# Let Claude prompt for which change to apply
zap spec apply
```

### View TODO Items

Display all TODO items from active OpenSpec changes:

```bash
zap todo
```

This command scans all active changes in `openspec/changes/` and displays their tasks from `tasks.md` files with progress indicators.

**Example:**

```bash
zap todo
```

**Output:**

```
📋 TODO Items

┌─ add-user-authentication (2/5 tasks completed)
│
│  Implementation
│  ☑ 1.1 Create database schema
│  ☑ 1.2 Implement API endpoint
│  ☐ 1.3 Add frontend component
│  ☐ 1.4 Write tests
│  ☐ 1.5 Update documentation
│
└────────────────────────────────────────
```

### Watch TODO Items

Continuously monitor and display TODO items with real-time updates:

```bash
zap watch
```

This command starts watch mode, which automatically refreshes the TODO display whenever task files are modified. Perfect for tracking progress during active development.

**Example:**

```bash
zap watch
```

**Features:**

- Real-time display updates when `tasks.md` files change
- Debounced refreshes (100ms) to batch rapid changes
- Clear screen with timestamp on each update
- Press Ctrl+C to exit gracefully

**Use case:** Keep `zap watch` running in a terminal window while working through implementation tasks to see your progress update automatically.

## VSCode Extension

For VSCode users, Zap includes a dedicated extension that displays OpenSpec tasks directly in a panel (similar to the Problems panel).

### Features

- **Native Panel Integration**: View all active OpenSpec changes and tasks in a dedicated panel
- **Progress Tracking**: See completion counts for each change at a glance
- **Badge Notifications**: Panel badge shows total unchecked task count
- **Real-time Updates**: Automatically refreshes when `tasks.md` files change
- **Hierarchical Display**: Tasks organized by change → section → individual task

### Installation

1. Navigate to the extension directory:

    ```bash
    cd vscode-extension
    ```

2. Install dependencies and compile:

    ```bash
    npm install
    npm run compile
    ```

3. Install the extension:
    - Press `F5` in VSCode to open an Extension Development Host, or
    - Package and install: `vsce package` then install the `.vsix` file

### Usage

Once installed, the "OpenSpec Tasks" panel appears automatically when you open a workspace containing an `openspec/changes/` directory. The panel shows all active changes with their task completion status.

For detailed documentation, see [vscode-extension/README.md](vscode-extension/README.md).

## Configuration

### ZAP_AGENT Environment Variable

By default, Zap uses the `claude` command when invoking AI agents for OpenSpec operations. You can customize this behavior by setting the `ZAP_AGENT` environment variable.

**Use cases:**

- Testing with alternative agent implementations
- Using custom CLI wrappers
- Running with agent commands installed at non-standard paths

**Examples:**

```bash
# Use default claude command
zap spec propose "add feature X"

# Use a custom agent command
ZAP_AGENT=my-agent zap spec propose "add feature X"

# Use an absolute path to the agent
ZAP_AGENT=/usr/local/bin/custom-claude zap spec apply

# Set for your entire session
export ZAP_AGENT=my-custom-agent
zap spec propose "add feature Y"
```

When `ZAP_AGENT` is set, Zap will use that command name for:

- Checking agent availability
- Executing `spec propose` commands
- Executing `spec archive` commands
- Executing `spec apply` commands

**Note:** The custom agent command must support the same CLI interface as Claude Code (e.g., `--permission-mode acceptEdits` and slash command syntax).

### Version Worktree Management

Zap provides commands to manage git worktrees for version branches (branches matching the pattern `v1`, `v2`, `v10`, etc.).

#### Reset Version Worktrees

Reset all version worktrees to the current branch HEAD:

```bash
zap versions reset
```

This command will:

1. Find all git worktrees with branch names matching `/v\d+/` (e.g., `v1`, `v2`, `v10`)
2. Check each worktree for uncommitted changes
3. If all worktrees are clean, reset each to the current branch's HEAD commit
4. Display a success summary showing all reset worktrees

**Example:**

```bash
# On the master branch at commit abc123
zap versions reset
# Output: Successfully reset 3 worktree(s): v1, v2, v3
```

**Requirements:**

- Must be run from within a git repository
- All matching worktrees must have no uncommitted changes

#### Push Version Worktrees

Force-push all version worktrees to their remote repositories:

```bash
zap versions push
```

This command will:

1. Find all git worktrees with branch names matching `/v\d+/` (e.g., `v1`, `v2`, `v10`)
2. Force-push each worktree to its remote repository
3. Stop on first failure with clear error reporting
4. Display a success summary showing all pushed worktrees

**Example:**

```bash
# After resetting version worktrees
zap versions push
# Output: Successfully pushed 3 worktree(s): v1, v2, v3
```

**Requirements:**

- Must be run from within a git repository
- Each worktree must have an upstream branch configured

**Note:** This command uses `--force` push. It's designed to work in conjunction with `versions reset` to synchronize version branches after updates.

## Development

Want to contribute or work on Zap? Here's how to get started.

### Setup

```bash
# Clone the repository
git clone https://github.com/avantmedialtd/zap.git
cd zap

# Install dependencies
npm install

# Link for local testing
npm link
```

### Running Tests

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Formatting

```bash
# Format all files
npm run format

# Check formatting without making changes
npm run format:check
```

### Linting

```bash
# Check for linting errors
npm run lint

# Fix linting errors automatically
npm run lint:fix
```

### Git Hooks

Set up a pre-push hook to run both linting and formatting checks before pushing:

```bash
printf '#!/bin/sh\nnpm run lint && npm run spell:check && npm run format:check\n' > .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

This ensures code is linted and properly formatted before it gets pushed to the repository.

### Making Changes

1. Make your changes to the code
2. Format your code: `npm run format`
3. Run tests to ensure everything works: `npm test`
4. Run the linter: `npm run lint`
5. Test your changes locally using the linked `zap` command
6. Commit your changes and submit a pull request

### Project Structure

- `main.ts` - Entry point for the CLI
- `npm-upgrade.ts` - Implementation of the npm upgrade command
- `zap` - Executable file that invokes the CLI
- Tests are colocated with source files (e.g., `npm-upgrade.test.ts`)

For more detailed contributor guidelines, see [CLAUDE.md](CLAUDE.md).

## Bug Reports and Feature Requests

Found a bug or have an idea for a new feature?

- **Report bugs**: [GitHub Issues](https://github.com/avantmedialtd/zap/issues)
- **Request features**: [GitHub Issues](https://github.com/avantmedialtd/zap/issues)

When reporting a bug, please include:

- Your operating system and Node.js version
- Steps to reproduce the issue
- Expected vs actual behavior
- Any error messages or logs

## Contributing

Contributions are welcome! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

1. Check existing [issues](https://github.com/avantmedialtd/zap/issues) or create a new one
2. Fork the repository
3. Create a feature branch (`git checkout -b feature/amazing-feature`)
4. Make your changes and add tests
5. Ensure tests and linting pass
6. Commit your changes
7. Push to your fork and submit a pull request

## License

UNLICENSED - This project is not currently licensed for public use or distribution.

## Author

István Antal <istvan@antal.xyz>

## Links

- [GitHub Repository](https://github.com/avantmedialtd/zap)
- [Issue Tracker](https://github.com/avantmedialtd/zap/issues)
