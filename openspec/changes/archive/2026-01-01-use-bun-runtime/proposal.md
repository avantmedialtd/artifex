# Proposal: Use Bun Runtime for CLI Execution

## Summary

Replace the current `npx tsx` shebang with `bun` to eliminate npx resolution overhead and improve CLI startup performance.

## Motivation

The current CLI uses `#!/usr/bin/env -S npx tsx` which incurs:

1. **npx resolution overhead** - Every invocation checks npm registry/cache
2. **tsx dependency** - Requires tsx package in devDependencies
3. **Slower startup** - Combined overhead adds noticeable delay

Bun provides:

1. **Native TypeScript execution** - No transpilation setup needed
2. **Fast startup** - Optimized for CLI use cases
3. **Node.js compatible** - Works with existing Node.js APIs and npm packages

## Scope

- Update shebang in `af` and `zap` executable files
- Update project documentation (project.md, CLAUDE.md) to reflect Bun runtime
- Remove tsx from dependencies (if no longer needed elsewhere)
- Update CI/development workflows to use Bun where appropriate

## Out of Scope

- Migrating from npm to bun for package management
- Replacing Vitest with Bun's test runner
- Changing the build/development workflow beyond runtime execution
