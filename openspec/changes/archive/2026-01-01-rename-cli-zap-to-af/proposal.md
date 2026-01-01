# Proposal: Rename CLI from 'zap' to 'af'

## Why

The project is rebranding from "zap" to "af" as the primary CLI name. To ensure backwards compatibility for existing users, scripts, and documentation references, "zap" will remain as an alias that works identically to "af".

## What Changes

- **Primary CLI name**: "af" becomes the main command name
- **Backwards compatibility**: "zap" continues to work as an alias
- **Package name**: Rename from "zap" to "af" in package.json
- **Executable files**: Create `af` executable, keep `zap` as alias
- **Documentation**: Update README, CLAUDE.md, project.md to reference "af" as primary
- **Help system**: Update help messages to show "af" as the primary command
- **Code references**: Update error messages and usage strings to use "af"
- **Specs**: Update spec files to reference "af" as primary while noting "zap" alias

## Impact

- **Affected specs**: cli-executable, cli-help-system, cli-command-shortcuts, cli-modular-structure, no-args-help, and all command-specific specs
- **Affected code**: 
  - `zap` executable (keep as alias)
  - `af` executable (new primary)
  - `package.json` (name, bin)
  - `router.ts` (help messages)
  - `commands/help.ts` (all usage strings)
  - `commands/*.ts` (usage error messages)
  - `integration.test.ts` (test expectations)
  - `README.md`, `CLAUDE.md`, `openspec/project.md`, `openspec/AGENTS.md`
  - `vscode-extension/src/extension.ts` (zap commands)

## Scope

This is a naming/branding change only. No functional changes to CLI behavior.
