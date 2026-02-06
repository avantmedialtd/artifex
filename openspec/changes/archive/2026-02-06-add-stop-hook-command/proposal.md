# Add Stop Hook Command

## Why

When using Claude Code's Stop hook to run `af e2e` after tasks complete, the tests run every time - even when only non-code files like OpenSpec proposals were changed. E2E tests can take a long time, so we want to skip them when only documentation or spec files were modified.

## What Changes

- Add `af stop-hook` command that conditionally runs `af e2e` based on changed files
- The command checks git diff for changed files and skips e2e if only ignored paths changed
- Introduce optional `af.json` configuration file for customizing ignored paths
- Default ignored paths: `openspec/`
- Exit codes: 0 (success/skipped), 2 (e2e failed)

## Impact

- Affected specs: New `stop-hook-command` capability
- Affected code: `commands/stop-hook.ts`, `router.ts`, `commands/help.ts`
- New optional config file: `af.json` in project root
