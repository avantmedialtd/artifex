# Proposal: Add Setup Command

## Why

Users need an easy way to install Claude Code configuration files (commands, skills, settings) to their home directory. Currently, users must manually copy files from the repository, which is error-prone and tedious. The setup files should be bundled into the standalone binary so users can run `af setup` without needing the source repository.

## What Changes

- Add `af setup` command that copies configuration files to `~/.claude/`
- Implement dynamic file discovery at build time using a manifest generator script
- Bundle setup files into the compiled binary using Bun's `with { type: "file" }` import attribute
- Provide interactive conflict resolution when files already exist (overwrite/skip per file or all)
- Support both development mode (files on disk) and compiled mode (embedded in binary)

## Impact

- Affected specs: None (new capability)
- Affected code:
  - `commands/setup.tsx` (new)
  - `utils/setup-files.ts` (new)
  - `components/file-conflict.tsx` (new)
  - `scripts/generate-setup-manifest.ts` (new)
  - `generated/setup-manifest.ts` (auto-generated, not committed)
  - `router.ts` (add routing)
  - `commands/help.ts` (add help entry)
  - `package.json` (add precompile hook)
  - `.gitignore` (ignore generated/)
