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

This is a new project with minimal structure:

- `main.ts` - Entry point for the application
- `package.json` - Project configuration and dependencies

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

## Architecture Notes

This project is in early stages. No architectural patterns have been established yet.
