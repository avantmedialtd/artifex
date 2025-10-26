# Tasks: Add Prettier

## Implementation Tasks

- [ ] Install prettier as dev dependency
  - Run `npm install --save-dev prettier`
  - Verify it appears in package.json devDependencies
  - **Validation:** `npm ls prettier` shows the installed version

- [ ] Create .prettierrc.json configuration file
  - Create file at project root with custom settings
  - Include: tabWidth=4, printWidth=100, singleQuote=true, trailingComma=all, arrowParens=avoid, endOfLine=lf, semi=true
  - **Validation:** `cat .prettierrc.json` shows valid JSON with all required fields

- [ ] Create .prettierignore file
  - Add patterns for node_modules/, .git/, package-lock.json, and other generated files
  - **Validation:** `cat .prettierignore` shows all necessary ignore patterns

- [ ] Add npm scripts for formatting
  - Add `"format": "prettier --write ."` to package.json
  - Add `"format:check": "prettier --check ."` to package.json
  - Add `"format:write": "prettier --write ."` to package.json (explicit version of format)
  - **Validation:** `npm run format:check` executes without errors

- [ ] Test formatting on existing codebase
  - Run `npm run format:check` to see current formatting status
  - Verify Prettier analyzes TypeScript, JSON, and Markdown files
  - **Validation:** Command completes in under 2 seconds

- [ ] Verify no conflicts with OXLint
  - Run `npm run format:write` followed by `npm run lint`
  - Ensure no linting errors are introduced by formatting
  - **Validation:** Both commands succeed with no conflicts

- [ ] Create .vscode/extensions.json for VSCode recommendations
  - Create `.vscode` directory if it doesn't exist
  - Create `extensions.json` with Prettier extension recommendation
  - Include `"esbenp.prettier-vscode"` in recommendations array
  - **Validation:** `cat .vscode/extensions.json` shows valid JSON with Prettier extension

- [ ] Add format check stage to Jenkinsfile
  - Add new stage after 'lint' stage that runs `npm run format:check`
  - Ensure build fails if format check exits with non-zero code
  - Place format check before or alongside lint for early feedback
  - **Validation:** `cat Jenkinsfile | grep format` shows the new stage

- [ ] Update pre-push git hook to include format checking
  - Modify `.git/hooks/pre-push` to run both `npm run lint` and `npm run format:check`
  - Ensure hook fails if either command exits with non-zero code
  - Keep hook executable
  - **Validation:** `cat .git/hooks/pre-push` shows both lint and format:check commands

- [ ] Update CLAUDE.md with Prettier documentation
  - Add Prettier to the project overview/tech stack section
  - Document the format commands (format, format:check, format:write)
  - Explain the custom Prettier configuration (tabWidth: 4, printWidth: 100, etc.)
  - Mention that formatting is enforced in CI and pre-push hooks
  - **Validation:** `cat CLAUDE.md | grep -i prettier` shows Prettier documentation

- [ ] Update README.md with pre-push hook instructions
  - Update the "Git Hooks" section to include format checking
  - Modify the pre-push hook setup command to include both lint and format:check
  - Explain that formatting is checked before pushing
  - **Validation:** `cat README.md | grep -A 5 "pre-push"` shows format checking in hook

- [ ] Update openspec/project.md if needed
  - Review project.md to ensure Prettier configuration is documented
  - Update "Code Style" section to reflect custom config instead of "default settings"
  - **Validation:** grep for "Prettier" in openspec/project.md shows accurate information

## Validation Tasks

- [ ] Run all tests to ensure no breakage
  - Execute `npm test`
  - **Validation:** All tests pass

- [ ] Verify format scripts work correctly
  - Test `npm run format:check` on unformatted code
  - Test `npm run format:write` fixes formatting
  - Test `npm run format` (shorthand) works
  - **Validation:** All three commands execute as expected

- [ ] Measure performance
  - Time `npm run format:check` on current codebase
  - **Validation:** Completes in under 2 seconds

- [ ] Test CI integration
  - Verify format check stage runs in CI pipeline
  - Test that CI fails when code has formatting violations
  - Test that CI passes when code is properly formatted
  - **Validation:** CI build includes format check stage and enforces formatting

## Documentation Tasks

- [ ] Verify README.md mentions formatting (if applicable)
  - Check if development section mentions running format commands
  - **Validation:** Documentation is consistent with new capability
