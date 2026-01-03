# Proposal: Add OpenCode Support to Setup Command

## Why

Users who work with both Claude Code and OpenCode need their custom commands available in both agents. Currently, the setup command only copies files to `~/.claude/`, requiring manual setup for OpenCode.

## What Changes

- Setup command copies custom commands to both Claude (`~/.claude/commands/`) and OpenCode (`~/.config/opencode/command/`) directories
- Skills are NOT duplicated since OpenCode already reads from `~/.claude/skills/`
- Path transformation handles the naming difference: `commands/` (Claude) vs `command/` (OpenCode singular)
- Default behavior sets up both agents; no additional flags required

## Impact

- Affected specs: `setup-command`
- Affected code: `utils/setup-files.ts`, `commands/setup.tsx`, `commands/help.ts`
