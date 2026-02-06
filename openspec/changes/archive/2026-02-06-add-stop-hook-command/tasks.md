## 1. Implementation

- [x] 1.1 Create `utils/config.ts` for loading optional `af.json` configuration
- [x] 1.2 Create `commands/stop-hook.ts` with `handleStopHook()` function
  - Get changed files from git (staged, unstaged, and untracked)
  - Filter out ignored paths
  - Run e2e only if relevant files remain
- [x] 1.3 Add routing for `af stop-hook` command in `router.ts`
- [x] 1.4 Add help text for stop-hook command in `commands/help.ts`

## 2. Testing

- [x] 2.1 Write unit tests for config loading (with and without af.json)
- [x] 2.2 Write unit tests for file change detection and filtering
- [x] 2.3 Test that e2e is skipped when only ignored paths changed
- [x] 2.4 Test that e2e runs when source files changed

## 3. Documentation

- [x] 3.1 Update CLAUDE.md with stop-hook command documentation and example Claude hook config
