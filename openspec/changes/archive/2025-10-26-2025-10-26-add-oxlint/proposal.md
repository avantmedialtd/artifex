# Add OXLint for Fast TypeScript/JavaScript Linting

## Summary

Add OXLint as the project's primary linting tool to provide fast, comprehensive static analysis for TypeScript and JavaScript code. OXLint is a Rust-based linter that offers significant performance improvements over traditional tools while providing extensive rule coverage.

## Why

The project currently has code formatting via Prettier but lacks static analysis for code quality, potential bugs, and best practices enforcement. This gap means:

- **Code quality issues go undetected** until runtime or manual review
- **Inconsistent patterns** can emerge across the codebase without automated enforcement
- **Developer productivity suffers** from lack of immediate feedback on common mistakes
- **Technical debt accumulates** without proactive detection of anti-patterns

Adding linting addresses these issues while maintaining the project's emphasis on fast, efficient tooling.

## Motivation

The project currently has code formatting via Prettier but lacks linting for code quality, potential bugs, and best practices enforcement. Adding a linter will:

1. **Catch potential bugs early** - Identify issues like unused variables, unreachable code, and type errors
2. **Enforce code quality standards** - Maintain consistent coding patterns across the codebase
3. **Improve developer experience** - Fast feedback in editors and CI/CD
4. **Performance benefits** - OXLint is significantly faster than ESLint, particularly important for CLI tools where startup time matters

## Rationale for OXLint

- **Performance**: Written in Rust, orders of magnitude faster than ESLint
- **TypeScript-first**: Native TypeScript support without requiring separate parsers
- **Modern rules**: Includes many rules inspired by ESLint, TypeScript-ESLint, and other popular tools
- **Zero configuration**: Works out of the box with sensible defaults
- **CLI-friendly**: Minimal startup overhead, perfect for CLI development workflows

## Implementation Approach

1. Install OXLint as a development dependency
2. Configure basic linting rules appropriate for the project's TypeScript/ES modules setup
3. Add lint commands to package.json scripts
4. Integrate linting into the development workflow (pre-commit checks, CI validation)
5. Address any existing linting violations in the codebase

## What Changes

**New Capability**: `code-linting`

- Adds OXLint package as development dependency
- Introduces npm scripts for linting operations (lint, lint:fix, lint:check)
- Establishes linting configuration compatible with TypeScript/ES modules
- Ensures existing codebase passes linting without violations

**No Breaking Changes**: This addition does not modify existing runtime behavior or public APIs.

## Scope and Dependencies

This change introduces a new development tool but does not affect runtime behavior or API contracts. It will run alongside existing tools (Prettier, Vitest) and complement rather than replace them.

## Success Criteria

- OXLint successfully analyzes all TypeScript files in the project
- Lint command runs quickly (< 1 second for current codebase size)
- Integration with package.json scripts for easy developer access
- Clean lint output with zero violations after initial cleanup
- Documentation for developers on using the linting tools

## Alternative Considered

**ESLint**: The traditional choice but significantly slower and requires more configuration overhead for TypeScript projects. While more mature, the performance benefits of OXLint align better with the project's CLI-focused, fast-execution goals.
