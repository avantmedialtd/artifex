# Tasks: Add OpenCode Support to Setup Command

## 1. Core Implementation

- [x] 1.1 Add `getOpenCodeCommandPath()` function to transform Claude paths to OpenCode paths
- [x] 1.2 Update `listSetupFiles()` to include OpenCode targets for command files
- [x] 1.3 Update `performSetup()` to copy commands to OpenCode directory
- [x] 1.4 Update result tracking to include OpenCode copies

## 2. UI Updates

- [x] 2.1 Update setup header to say "AI agent configurations" instead of "Claude configuration"
- [x] 2.2 Update target info to show both Claude and OpenCode destinations
- [x] 2.3 Update list mode to show OpenCode paths for commands

## 3. Documentation

- [x] 3.1 Update help text to mention OpenCode support

## 4. Validation

- [x] 4.1 Run `openspec validate add-opencode-setup --strict`
- [x] 4.2 Run tests
- [x] 4.3 Manual testing with `af setup --list`
