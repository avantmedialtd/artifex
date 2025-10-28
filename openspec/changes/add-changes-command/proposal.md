# Proposal: add-changes-command

## Why

Developers frequently need to view OpenSpec changes during development but must type the full `openspec list --changes` command. Adding `zap changes` as a shorthand reduces friction and maintains consistency with existing shortcuts like `propose` and `archive`.

## What Changes

- Add new top-level `changes` command to zap CLI
- Command executes `openspec list --changes` directly
- Add routing logic in router.ts
- Update help system with command documentation
- Add tests for the new command handler

## Impact

- Affected specs: cli-command-shortcuts (extends existing shortcut pattern)
- Affected code: router.ts, commands/help.ts, new commands/changes.ts
- No breaking changes
- Minimal surface area - single command addition
