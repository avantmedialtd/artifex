# Project Context

## Purpose

**Artifex** is a CLI development utility tool designed to streamline and automate common development workflows. It helps developers be more productive by providing fast, reliable command-line utilities for everyday tasks.

> **Note**: The `zap` command is available as an alias for backwards compatibility.

## Tech Stack

- **TypeScript** - Primary development language
- **Bun** - Runtime environment for CLI execution (native TypeScript support)
- **Node.js** - Runtime environment for npm scripts and Vitest tests
- **Vitest** - Testing framework
- **OXLint** - Fast Rust-based linter for code quality
- **Prettier** - Code formatting
- **CSpell** - Automated spell checking for code and documentation

## Project Conventions

### Code Style

- **Formatting**: Prettier with custom configuration (4-space indentation, 100-char line width, single quotes, trailing commas)
- **Linting**: OXLint for static code analysis and quality checks
- **Module system**: ES modules (type: "module" in package.json)
- **File naming**: lowercase with hyphens for multi-word files (e.g., `my-utility.ts`)
- **Imports**: Use `.js` extensions in TypeScript imports for ES module compatibility

### Architecture Patterns

- CLI-first design: prioritize command-line interface and developer experience
- Single responsibility: each command/utility should do one thing well
- Composable: utilities should be able to work together
- Fast execution: optimize for speed and minimal overhead

### Testing Strategy

- **Framework**: Vitest for unit and integration tests
- **Coverage**: Aim for high test coverage on core utilities
- **Test files**: Co-locate test files with source files using `.test.ts` suffix
- Run tests with `npm test` (once configured)

### Code Formatting

- **Formatter**: Prettier - Industry-standard code formatter
- **Configuration**: See `.prettierrc.json` for custom configuration (4-space indent, 100-char width, single quotes, trailing commas)
- **Commands**:
    - `npm run format` - Format all files
    - `npm run format:check` - Check formatting without making changes
    - `npm run format:write` - Explicitly format all files
- **Performance**: Formatting completes in <2 seconds
- **Integration**: Format checking runs automatically in CI/CD pipeline and pre-push hooks

### Linting and Code Quality

- **Linter**: OXLint - Fast, Rust-based linter with TypeScript support
- **Configuration**: See `.oxlintrc.json` for rule configuration
- **Commands**:
    - `npm run lint` - Check code for issues
    - `npm run lint:fix` - Auto-fix issues where possible
    - `npm run lint:check` - Run comprehensive lint check
- **Performance**: Linting completes in <1 second for fast feedback
- **Rules**: Comprehensive set including correctness, suspicious patterns, and TypeScript-specific checks
- **Integration**: Linting runs automatically in CI/CD pipeline and pre-push hooks

### Spell Checking

- **Tool**: CSpell - Automated spell checker for code, comments, and documentation
- **Configuration**: See `.cspell.json` for custom dictionary and ignore patterns
- **Commands**:
    - `npm run spell:check` - Check spelling in all files
- **Scope**: Checks TypeScript, JavaScript, Markdown, and JSON files
- **Custom Dictionary**: Project-specific terms, technical names, and proper nouns
- **Performance**: Spell checking completes quickly by ignoring node_modules and build outputs
- **Integration**: Spell checking runs automatically in CI/CD pipeline to catch typos before merge

### Git Workflow

- **Branch**: Currently working on `master` branch
- **Commits**: Descriptive commit messages that explain the "why" not just the "what"
- **No force pushes** to main/master branch
- Keep commits focused and atomic
- **Pre-commit hooks**: Not currently used - linting runs in CI (Jenkinsfile), allowing developers flexibility in local workflow while ensuring quality gates before merge

## Domain Context

This is a developer-focused tool, so the target audience is software engineers who work in the command line regularly. The tool should prioritize:

- Speed and performance
- Clear, helpful error messages
- Intuitive command structure
- Minimal dependencies

## Important Constraints

- **License**: UNLICENSED (proprietary/private)
- **Bun runtime**: CLI executables use Bun for native TypeScript execution without transpilation
- **Node.js compatibility**: npm scripts and tests run on Node.js; must work with modern versions that support ES modules
- **Zero-config goal**: Utilities should work with minimal or no configuration where possible

## External Dependencies

Currently no external dependencies are configured. As the project grows, prefer:

- Well-maintained, popular packages
- Minimal dependency trees
- TypeScript-compatible libraries
