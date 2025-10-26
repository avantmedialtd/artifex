# Spec: Code Formatting

## ADDED Requirements

### Requirement: Prettier package installation

The project MUST include Prettier as a development dependency to provide automated code formatting.

#### Scenario: Developer installs dependencies
```bash
cd /path/to/zap
npm install
```
**Then** Prettier is installed in `node_modules`

#### Scenario: Prettier dependency in package.json
```bash
cat package.json | grep prettier
```
**Then** the output includes `"prettier"` in `devDependencies`

### Requirement: Format command availability

The project MUST provide npm script commands for checking and applying code formatting.

#### Scenario: Check formatting without changes
```bash
npm run format:check
```
**Then** Prettier analyzes all files and reports formatting issues without modifying files
**And** the command exits with code 0 if all files are formatted correctly
**And** the command exits with non-zero code if formatting issues exist

#### Scenario: Apply formatting to all files
```bash
npm run format:write
```
**Then** Prettier formats all applicable files in place
**And** all files match Prettier's default style

#### Scenario: Shorthand format command
```bash
npm run format
```
**Then** this is equivalent to `npm run format:write`
**And** files are formatted in place

### Requirement: File type support

Prettier MUST format TypeScript, JavaScript, JSON, and Markdown files.

#### Scenario: Format TypeScript files
```bash
echo "const x={a:1,b:2}" > test.ts
npm run format:write
cat test.ts
```
**Then** the file is formatted with proper spacing: `const x = { a: 1, b: 2 };`

#### Scenario: Format JSON files
```bash
echo '{"name":"test","value":123}' > test.json
npm run format:write
cat test.json
```
**Then** the file is formatted with indentation and newlines

#### Scenario: Format Markdown files
```bash
echo "# Title\nSome text without proper spacing..." > test.md
npm run format:write
```
**Then** Prettier applies consistent Markdown formatting

### Requirement: Custom configuration

Prettier MUST use project-specific configuration to match code style preferences.

#### Scenario: Prettier config file exists
```bash
cat .prettierrc.json
```
**Then** the file exists at the project root
**And** contains valid JSON configuration

#### Scenario: Configuration values are applied
**When** reading `.prettierrc.json`
**Then** it specifies:
- `"tabWidth": 4` (4-space indentation)
- `"printWidth": 100` (100-character line width)
- `"semi": true` (semicolons enabled)
- `"singleQuote": true` (single quotes for strings)
- `"trailingComma": "all"` (trailing commas everywhere)
- `"arrowParens": "avoid"` (arrow function parens only when needed)
- `"endOfLine": "lf"` (LF line endings)

#### Scenario: Custom indentation is applied
```bash
echo "const x={a:1}" > test.ts
npm run format:write
cat test.ts
```
**Then** the file uses 4-space indentation

#### Scenario: Custom line width is applied
```bash
echo "const veryLongVariableName = { property1: 'value1', property2: 'value2', property3: 'value3', property4: 'value4' };" > test.ts
npm run format:write
cat test.ts
```
**Then** Prettier wraps lines at 100 characters, not 80

#### Scenario: Single quotes are enforced
```bash
echo 'const x = "hello";' > test.ts
npm run format:write
cat test.ts
```
**Then** the output uses single quotes: `const x = 'hello';`

### Requirement: Ignore unnecessary files

Prettier MUST skip formatting generated files, dependencies, and build artifacts.

#### Scenario: Prettierignore file exists
```bash
cat .prettierignore
```
**Then** the file includes patterns for:
- `node_modules/`
- `.git/`
- Build output directories
- Lock files (`package-lock.json`)

#### Scenario: Node modules are not formatted
```bash
npm run format:write
```
**Then** files in `node_modules/` are not analyzed or modified
**And** the command completes quickly without scanning dependencies

### Requirement: Integration with existing toolchain

Prettier MUST work alongside OXLint without conflicts.

#### Scenario: Prettier does not conflict with OXLint
```bash
npm run format:write
npm run lint
```
**Then** OXLint does not report style violations for Prettier-formatted code
**And** both tools can run independently

#### Scenario: Both tools run in CI pipeline
**When** CI runs both linting and format checking
**Then** lint passes after format is applied
**And** no conflicts between linting rules and formatting exist

### Requirement: Fast execution

Prettier MUST format the codebase quickly to maintain developer productivity.

#### Scenario: Format check completes quickly
```bash
time npm run format:check
```
**Then** the command completes in under 2 seconds for the current codebase

#### Scenario: Format write completes quickly
```bash
time npm run format:write
```
**Then** the command completes in under 3 seconds for the current codebase

### Requirement: VSCode extension recommendations

The project MUST recommend the Prettier VSCode extension to provide integrated formatting support in the editor.

#### Scenario: VSCode extensions file exists
```bash
cat .vscode/extensions.json
```
**Then** the file exists at `.vscode/extensions.json`
**And** contains valid JSON

#### Scenario: Prettier extension is recommended
```bash
cat .vscode/extensions.json | grep prettier
```
**Then** the output includes `"esbenp.prettier-vscode"` in the recommendations array
**And** developers opening the project in VSCode are prompted to install the extension

#### Scenario: Extension provides editor integration
**When** a developer has the Prettier VSCode extension installed
**Then** they can format files using editor commands
**And** they can configure format-on-save if desired (user preference)

### Requirement: CI pipeline integration

The CI pipeline MUST enforce formatting standards by failing builds when code is not properly formatted.

#### Scenario: Format check runs in CI
```bash
cat Jenkinsfile | grep format
```
**Then** the Jenkinsfile includes a stage that runs format checking
**And** the format check stage runs before or alongside other quality checks

#### Scenario: CI fails on formatting violations
**When** CI runs on code with formatting issues
**And** `npm run format:check` exits with non-zero code
**Then** the CI build fails
**And** developers are notified that formatting needs to be fixed

#### Scenario: CI passes with properly formatted code
**When** CI runs on properly formatted code
**And** `npm run format:check` exits with code 0
**Then** the format check stage passes
**And** the build continues to subsequent stages

#### Scenario: Format check runs efficiently in CI
**When** the format check stage runs in CI
**Then** it completes quickly without significantly increasing build time
**And** provides clear output about formatting status

### Requirement: Pre-push hook integration

The project MUST provide a pre-push git hook that runs format checking to prevent pushing unformatted code.

#### Scenario: Pre-push hook includes format check
```bash
cat .git/hooks/pre-push
```
**Then** the file exists and is executable
**And** the script runs both `npm run lint` and `npm run format:check`

#### Scenario: Pre-push hook prevents pushing unformatted code
**When** a developer attempts to push code with formatting violations
**And** the pre-push hook runs `npm run format:check`
**Then** the push is blocked
**And** the developer sees a message about formatting issues

#### Scenario: Pre-push hook allows pushing formatted code
**When** a developer pushes properly formatted code
**And** the pre-push hook runs `npm run format:check`
**Then** the push proceeds successfully
**And** no formatting errors are reported

#### Scenario: README documents pre-push hook setup
```bash
cat README.md | grep -A 5 "pre-push"
```
**Then** the README includes instructions for setting up the pre-push hook
**And** the instructions show how to create the hook to run both linting and format checking
**And** developers understand formatting will be checked before pushing

### Requirement: Project documentation updates

Project documentation MUST be updated to reflect the addition of Prettier and formatting requirements.

#### Scenario: CLAUDE.md documents formatting commands
```bash
cat CLAUDE.md | grep -i format
```
**Then** CLAUDE.md includes information about code formatting
**And** documents the npm format commands (format, format:check, format:write)
**And** explains the Prettier configuration

#### Scenario: CLAUDE.md includes Prettier in tech stack
```bash
cat CLAUDE.md | grep -i prettier
```
**Then** CLAUDE.md lists Prettier in the project's tooling/tech stack
**And** mentions the custom configuration settings

#### Scenario: Development workflow includes formatting
**When** reading CLAUDE.md development guidance
**Then** it mentions running format checks as part of the development workflow
**And** explains that formatting is enforced in CI and pre-commit hooks
