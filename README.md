# Artifex

A lightweight CLI development utility that helps you automate common development tasks.

> **Note:** Artifex is in early-stage development. Features and APIs may change as the project evolves.

## What is Artifex?

Artifex is a command-line tool designed to streamline your development workflow by automating repetitive tasks. Currently, it helps you keep your project dependencies up to date with a single command, and it's built to be fast and easy to use.

### Why Artifex?

- **Simple**: One command to upgrade all your npm dependencies
- **Fast**: Built with performance in mind, runs TypeScript directly without build steps
- **Developer-friendly**: Clear output and sensible defaults
- **Lightweight**: Minimal dependencies, maximum efficiency

## Installation

### Prerequisites

- [Node.js](https://nodejs.org) 16 or higher

That's it for running Artifex from npm. The [Bun](https://bun.sh) runtime ships as a bundled dependency and is installed automatically when you `npm install` the package — you do not need to install Bun separately.

### Install from NPM

```bash
npm install -g @avantmedia/af
```

After installation, the `af` command will be available globally.

### Install from Source

This path is intended for contributors working on Artifex itself. Unlike the npm install, building from source requires [Bun](https://bun.sh) installed locally — it is used to run tests and format code.

```bash
git clone https://github.com/avantmedialtd/artifex.git
cd artifex
bun install
bun link
```

### Platform Support

af works on:

- macOS
- Linux
- Windows

## Usage

### Upgrade NPM Dependencies

Upgrade all dependencies in your project to their latest versions:

```bash
af npm upgrade
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
af npm upgrade
```

**Output:**

```
Upgrading dependencies in package.json...
  express: ^4.18.0 → ^4.19.2
  typescript: ^5.0.0 → ^5.4.5
Running npm install...
Done! All dependencies upgraded.
```

### Upgrade Bun Dependencies

Upgrade all dependencies in your project to their latest versions using Bun:

```bash
af bun upgrade
```

This command will:

1. Run `bun outdated` to detect outdated packages
2. Upgrade each package using `bun add <package>@latest`
3. Display a summary of upgraded packages

**Example:**

```bash
cd my-project
af bun upgrade
```

**Output:**

```
Checking for outdated packages...

Found 2 package(s) to upgrade:
  • lodash
  • typescript

Upgrading lodash...
Upgrading typescript...

Upgrade Summary
==================================================
Successfully upgraded: 2 package(s)
  ✓ lodash
  ✓ typescript

All packages upgraded successfully!
```

### View TODO Items

Display all TODO items from active OpenSpec changes:

```bash
af todo
```

This command scans all active changes in `openspec/changes/` and displays their tasks from `tasks.md` files with progress indicators.

**Example:**

```bash
af todo
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
af watch
```

This command starts watch mode, which automatically refreshes the TODO display whenever task files are modified. Perfect for tracking progress during active development.

**Example:**

```bash
af watch
```

**Features:**

- Real-time display updates when `tasks.md` files change
- Debounced refreshes (100ms) to batch rapid changes
- Clear screen with timestamp on each update
- Press Ctrl+C to exit gracefully

**Use case:** Keep `af watch` running in a terminal window while working through implementation tasks to see your progress update automatically.

## VSCode Extension

For VSCode users, Artifex includes a dedicated extension that displays OpenSpec tasks directly in a panel (similar to the Problems panel).

### Features

- **Native Panel Integration**: View all active OpenSpec changes and tasks in a dedicated panel
- **Progress Tracking**: See completion counts for each change at a glance
- **Badge Notifications**: Panel badge shows completion percentage across all active changes (e.g., "75%" with tooltip showing "3 active changes, 75% complete (15/20 tasks)")
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

### Version Worktree Management

af provides commands to manage git worktrees for version branches (branches matching the pattern `v1`, `v2`, `v10`, etc.).

#### Reset Version Worktrees

Reset all version worktrees to the current branch HEAD:

```bash
af versions reset
```

This command will:

1. Find all git worktrees with branch names matching `/v\d+/` (e.g., `v1`, `v2`, `v10`)
2. Check each worktree for uncommitted changes
3. If all worktrees are clean, reset each to the current branch's HEAD commit
4. Display a success summary showing all reset worktrees

**Example:**

```bash
# On the master branch at commit abc123
af versions reset
# Output: Successfully reset 3 worktree(s): v1, v2, v3
```

**Requirements:**

- Must be run from within a git repository
- All matching worktrees must have no uncommitted changes

#### Push Version Worktrees

Force-push all version worktrees to their remote repositories:

```bash
af versions push
```

This command will:

1. Find all git worktrees with branch names matching `/v\d+/` (e.g., `v1`, `v2`, `v10`)
2. Force-push each worktree to its remote repository
3. Stop on first failure with clear error reporting
4. Display a success summary showing all pushed worktrees

**Example:**

```bash
# After resetting version worktrees
af versions push
# Output: Successfully pushed 3 worktree(s): v1, v2, v3
```

**Requirements:**

- Must be run from within a git repository
- Each worktree must have an upstream branch configured

**Note:** This command uses `--force` push. It's designed to work in conjunction with `versions reset` to synchronize version branches after updates.

## Development

Want to contribute or work on Artifex? Here's how to get started.

### Setup

```bash
# Clone the repository
git clone https://github.com/avantmedialtd/artifex.git
cd artifex

# Install dependencies
bun install

# Link for local testing
bun link
```

### Running Tests

```bash
# Run tests once
bun test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage
```

### Code Formatting

```bash
# Format all files
bun run format

# Check formatting without making changes
bun run format:check
```

### Linting

```bash
# Check for linting errors
bun run lint

# Fix linting errors automatically
bun run lint:fix
```

### Git Hooks

Set up a pre-push hook to run both linting and formatting checks before pushing:

```bash
printf '#!/bin/sh\nbun run lint && bun run spell:check && bun run format:check\n' > .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

This ensures code is linted and properly formatted before it gets pushed to the repository.

### Making Changes

1. Make your changes to the code
2. Format your code: `bun run format`
3. Run tests to ensure everything works: `bun test`
4. Run the linter: `bun run lint`
5. Test your changes locally using the linked `af` command
6. Commit your changes and submit a pull request

### Publishing to NPM

The package is published as `@avantmedia/af` on the public NPM registry. It ships TypeScript source directly — Bun executes it natively without a build step.

```bash
# Verify what will be published
npm pack --dry-run

# Publish (requires npm login and @avantmedia org access)
npm publish --access public
```

The `files` field in `package.json` controls what gets included. Test files, OpenSpec artifacts, the VSCode extension, and build outputs are excluded.

### Project Structure

- `main.ts` - Entry point for the CLI
- `router.ts` - Command routing logic
- `commands/` - Command handler modules
- `components/` - Ink React UI components
- `utils/` - Shared utility modules
- `af` - Primary executable file that invokes the CLI
- Tests are colocated with source files (e.g., `*.test.ts`)

For more detailed contributor guidelines, see [CLAUDE.md](CLAUDE.md).

## Bug Reports and Feature Requests

Found a bug or have an idea for a new feature?

- **Report bugs**: [GitHub Issues](https://github.com/avantmedialtd/artifex/issues)
- **Request features**: [GitHub Issues](https://github.com/avantmedialtd/artifex/issues)

When reporting a bug, please include:

- Your operating system and Node.js version
- Steps to reproduce the issue
- Expected vs actual behavior
- Any error messages or logs

## Contributing

Contributions are welcome! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

1. Check existing [issues](https://github.com/avantmedialtd/artifex/issues) or create a new one
2. Fork the repository
3. Create a feature branch (`git checkout -b feature/amazing-feature`)
4. Make your changes and add tests
5. Ensure tests and linting pass
6. Commit your changes
7. Push to your fork and submit a pull request

## License

MIT License. See [LICENSE](LICENSE) for details.

## Author

István Antal <istvan@antal.xyz>

## Links

- [GitHub Repository](https://github.com/avantmedialtd/artifex)
- [Issue Tracker](https://github.com/avantmedialtd/artifex/issues)
