# Proposal: Add Prettier for Code Formatting

## Summary
Add Prettier as a dev dependency with custom configuration to provide automated code formatting for TypeScript, JavaScript, JSON, and Markdown files in the zap project.

## Problem
While the project documentation (`openspec/project.md`) mentions "Prettier with default settings" as the formatting standard, Prettier is not actually installed or configured in the project. Developers have no automated way to format code consistently.

## Proposed Solution
Install Prettier as a dev dependency and add npm scripts for formatting code. Configure Prettier with project-specific settings:
- 4-space indentation (tabWidth: 4)
- 100-character line width (printWidth: 100)
- Single quotes for strings
- Trailing commas in all locations (ES5+ compatible)
- Arrow function parens only when needed
- LF line endings for consistency

Additionally:
- Add Prettier VSCode extension to recommended extensions for better developer experience
- Integrate format checking into CI pipeline (Jenkinsfile) to fail builds on formatting violations
- Update pre-push git hook to run format checking alongside linting
- Update CLAUDE.md and README.md to document formatting workflow

## Scope
- **In scope:**
  - Install `prettier` package as dev dependency
  - Add npm scripts: `format`, `format:check`, and `format:write`
  - Create `.prettierrc.json` with custom configuration
  - Create `.prettierignore` to exclude generated/external files
  - Add `.vscode/extensions.json` with Prettier extension recommendation
  - Add format check stage to Jenkinsfile CI pipeline
  - Update pre-push git hook to include format checking
  - Update CLAUDE.md to document Prettier configuration and formatting workflow
  - Update README.md to document pre-push hook with format checking
  - Verify formatting works on existing TypeScript codebase

- **Out of scope:**
  - Auto-save formatting configuration (developer preference)
  - Reformatting existing codebase (can be done in separate change)

## Capabilities Modified
- **code-formatting** (NEW) - Adds automated code formatting capability

## Dependencies
- None - This is a standalone addition that complements the existing code-linting capability

## Risks and Mitigations
- **Risk:** Custom configuration adds complexity
  - **Mitigation:** Configuration is minimal and focuses on improving readability (wider lines, 4-space tabs)

- **Risk:** Large formatting changes when first run on codebase
  - **Mitigation:** Initial formatting will be done carefully; developers can review diffs before committing

- **Risk:** Configuration might need updates over time
  - **Mitigation:** Configuration will be documented in the spec and can be updated through OpenSpec if needed

## Alternatives Considered
1. **Use Prettier defaults** - Defaults use 2-space indentation and 80-char lines, which are too restrictive for this project's preference.
2. **Use OXLint formatting** - OXLint is primarily a linter, not a formatter. Prettier is the industry standard for formatting.
3. **Manual formatting** - Not scalable and leads to inconsistent style across the codebase.
