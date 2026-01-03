# Tasks: Add Setup Command

## 1. Build Infrastructure

- [x] 1.1 Create `scripts/generate-setup-manifest.ts` to scan `setup/` and generate manifest
- [x] 1.2 Add `generated/` to `.gitignore`
- [x] 1.3 Add `generate:manifest` and `precompile` scripts to `package.json`
- [x] 1.4 Test manifest generation produces valid TypeScript

## 2. Core Utilities

- [x] 2.1 Create `utils/setup-files.ts` with file listing and copying logic
- [x] 2.2 Implement `isCompiled()` detection for dev vs compiled mode
- [x] 2.3 Implement `listSetupFiles()` to enumerate files with target paths
- [x] 2.4 Implement `copySetupFile()` with directory creation
- [x] 2.5 Implement `performSetup()` with conflict resolution callback

## 3. UI Components

- [x] 3.1 Create `components/file-conflict.tsx` for interactive conflict prompts
- [x] 3.2 Add keyboard handling for y/n/a/s options

## 4. Command Handler

- [x] 4.1 Create `commands/setup.tsx` with flag parsing
- [x] 4.2 Implement `--list` mode to preview files
- [x] 4.3 Implement `--force` mode to skip prompts
- [x] 4.4 Integrate conflict resolution with UI component
- [x] 4.5 Display results summary (copied/skipped/errors)

## 5. Integration

- [x] 5.1 Add `setup` command routing to `router.ts`
- [x] 5.2 Add help entry in `commands/help.ts`

## 6. Testing

- [x] 6.1 Test `af setup --list` shows correct files
- [x] 6.2 Test `af setup --force` overwrites without prompting
- [x] 6.3 Test conflict resolution with existing files
- [x] 6.4 Test compiled binary has embedded files (requires compilation)

## 7. Documentation

- [x] 7.1 Update CLAUDE.md with setup command documentation
