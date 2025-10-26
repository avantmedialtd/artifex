# Tasks: Add 'zap' CLI Executable

## Implementation Order

- [x] **Add basic content to main.ts**
    - Add a simple console.log or CLI output to main.ts (e.g., "zap CLI ready")
    - Ensure the file has valid TypeScript syntax
    - **Validation**: File has valid TypeScript code
    - **Dependencies**: None

- [x] **Create zap executable file**
    - Create `zap` file (no extension) in project root
    - Add shebang line: `#!/usr/bin/env node --experimental-strip-types`
    - Add import statement to load main.ts: `import './main.ts';`
    - Set execute permissions: `chmod +x zap`
    - **Validation**: File exists and has execute permissions (`ls -la zap`)
    - **Dependencies**: Task 1 (main.ts should exist)

- [x] **Update package.json with bin field**
    - Add `"bin": { "zap": "./zap" }` to package.json
    - **Validation**: package.json has correct bin field syntax
    - **Dependencies**: Task 2 (executable file must exist)

- [x] **Test local npm link functionality**
    - Run `npm link` in project directory
    - Verify `zap` command is available in terminal
    - Test that executing `zap` runs main.ts correctly
    - **Validation**: `which zap` shows symlink path; `zap` command executes and shows output from main.ts
    - **Dependencies**: Task 3 (package.json bin configuration required)

- [x] **Verify git permissions are preserved**
    - Stage the zap executable file
    - Verify git tracks the execute permissions: `git ls-files -s zap`
    - **Validation**: `git ls-files -s` shows mode 100755 for zap file
    - **Dependencies**: Task 2 (executable must exist with permissions)
    - **Can run in parallel with**: Task 4

- [x] **Test cross-platform compatibility**
    - Verify the command works on the current platform (macOS)
    - Confirm npm will auto-generate .cmd wrapper for Windows (verify in package.json docs)
    - **Validation**: `zap` command executes successfully
    - **Dependencies**: Task 4 (npm link must work)

- [x] **Update project documentation**
    - Add Node.js version requirement (22.6+) to package.json or README
    - Document the `npm link` workflow for local development
    - Note that the executable uses `--experimental-strip-types`
    - **Validation**: Documentation clearly explains requirements and usage
    - **Dependencies**: Tasks 1-4 (need complete implementation to document)
    - **Can run in parallel with**: Tasks 5-6

## Notes

- Tasks 1-3 must be sequential
- Task 4 depends on tasks 1-3
- Tasks 5-6-7 can run in parallel after task 4
- All tasks deliver incremental, testable progress
- No task requires more than 30 minutes to complete
- Windows compatibility is automatic via npm's .cmd wrapper generation
