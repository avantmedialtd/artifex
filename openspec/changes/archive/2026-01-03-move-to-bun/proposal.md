# Proposal: Complete the Move to Bun

## Why

The project currently uses a hybrid npm/Bun approach. While Bun is used for TypeScript execution and binary compilation, npm is still used for dependency installation, CI pipeline, and documentation examples. Completing the migration to Bun provides a consistent developer experience and leverages Bun's faster package management.

## What Changes

- Add `af bun upgrade` command for upgrading dependencies using Bun's package manager
- Keep `af npm upgrade` command for projects that still use npm
- Migrate CI pipeline (Jenkinsfile) from npm to Bun commands
- Update all documentation to reference Bun commands as primary
- Remove `package-lock.json` (keep `bun.lock`)
- VSCode extension remains on npm (separate Node.js project)

## Impact

- Affected specs: `dependency-upgrade`
- Affected code: `bun-upgrade.ts`, `commands/bun.ts`, `router.ts`, `commands/help.ts`, `Jenkinsfile`
- Affected docs: `README.md`, `CLAUDE.md`, `openspec/project.md`
