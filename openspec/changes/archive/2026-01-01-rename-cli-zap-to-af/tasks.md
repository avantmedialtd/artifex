# Tasks: Rename CLI from 'zap' to 'af'

## 1. Core Executable Setup

- [x] 1.1 Create `af` executable file with same content as `zap`
- [x] 1.2 Set execute permissions on `af`: `chmod +x af`
- [x] 1.3 Update `package.json`:
  - Change `"name": "zap"` to `"name": "af"`
  - Update `bin` to: `{ "af": "./af", "zap": "./zap" }`
- [x] 1.4 Verify both executables work: `./af help` and `./zap help`
- **Validation**: Both `af` and `zap` commands execute identically

## 2. Help System Updates

- [x] 2.1 Update `commands/help.ts`:
  - Change all `zap` references in usage strings to `af`
  - Update header from "zap - Development utility CLI" to "af - Development utility CLI"
  - Update all command examples to use `af`
- [x] 2.2 Update `router.ts`:
  - Change error messages from "Run 'zap help ...'" to "Run 'af help ...'"
- **Validation**: `af help` shows "af" branding; `zap help` shows same output

## 3. Command Error Messages

- [x] 3.1 Update `commands/spec.ts`: Change "Usage: zap spec propose" to "Usage: af spec propose"
- [x] 3.2 Update `commands/todo.ts`: Change "Usage: zap todo" to "Usage: af todo"
- [x] 3.3 Update `commands/watch.ts`: Change "Usage: zap watch" to "Usage: af watch"
- [x] 3.4 Update `commands/changes.ts`: Change "Usage: zap changes" to "Usage: af changes"
- **Validation**: Each command's error message shows "af" usage

## 4. Test Updates

- [x] 4.1 Update `integration.test.ts`:
  - Change expected output from "zap - Development utility CLI" to "af - Development utility CLI"
  - Update any "Usage: zap" expectations to "Usage: af"
- [x] 4.2 Update `spec-propose.test.ts`: Change "Usage: zap spec propose" to "Usage: af spec propose"
- [x] 4.3 Update `commands/todo.test.ts`: Change "Usage: zap todo" to "Usage: af todo"
- [x] 4.4 Update `commands/watch.test.ts`: Change "Usage: zap watch" to "Usage: af watch"
- [x] 4.5 Update `commit-apply.test.ts`: Change "zap commit" to "af commit"
- [x] 4.6 Run all tests: `npm test`
- **Validation**: All tests pass

## 5. Documentation Updates

- [x] 5.1 Update `README.md`:
  - Change title from "# Zap" to "# af"
  - Update "What is Zap?" to "What is af?"
  - Replace all `zap` command examples with `af`
  - Add note about `zap` being available as alias
  - Update git clone URL reference if needed
- [x] 5.2 Update `CLAUDE.md`:
  - Change "**zap** is a development utility tool" to "**af** is a development utility tool"
  - Update command examples
- [x] 5.3 Update `openspec/project.md`:
  - Change "**zap** is a CLI development utility tool" to "**af** is a CLI development utility tool"
- [x] 5.4 Update `openspec/AGENTS.md`:
  - Change references from `zap todo`, `zap versions` to `af todo`, `af versions`
  - Note that `zap` commands still work as alias
- **Validation**: Documentation accurately reflects "af" as primary name

## 6. VSCode Extension Updates

- [x] 6.1 Update `vscode-extension/src/extension.ts`:
  - Change `zap spec ${subcommand}` to `af spec ${subcommand}`
  - Update task group name if it references "zap"
- [x] 6.2 Update `vscode-extension/README.md`:
  - Change `zap spec archive` and `zap spec apply` to `af spec archive` and `af spec apply`
- **Validation**: Extension commands execute `af` instead of `zap`

## 7. Configuration Files

- [x] 7.1 Update `.oxlintrc.json` comment if it references "zap"
- [x] 7.2 Update `package-lock.json` will auto-update when running `npm install`
- **Validation**: Config comments reflect "af" branding

## 8. Spec File Updates (documentation only - no functional changes)

- [x] 8.1 Update `openspec/specs/cli-executable/spec.md`:
  - Add note about "af" being primary and "zap" being alias
  - Keep scenarios working with both commands
- **Validation**: Spec accurately documents both command names

## 9. Final Verification

- [x] 9.1 Run `npm link` and verify both `af` and `zap` are available globally
- [x] 9.2 Test all major commands with both names:
  - `af help` / `zap help`
  - `af npm upgrade` / `zap npm upgrade` (in test directory)
  - `af todo` / `zap todo`
  - `af changes` / `zap changes`
- [x] 9.3 Run full test suite: `npm test`
- [x] 9.4 Run lint: `npm run lint`
- [x] 9.5 Run format check: `npm run format:check`
- **Validation**: All checks pass, both command names work identically
