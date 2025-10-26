# spell-checking Specification Delta

## ADDED Requirements

### Requirement: CSpell package installation

The project MUST include CSpell as a development dependency to provide automated spell checking for code, comments, and documentation.

#### Scenario: Developer installs dependencies

```bash
cd /path/to/zap
npm install
```

**Then** CSpell is installed in `node_modules`
**And** the developer can run `npx cspell --version`

#### Scenario: CSpell dependency in package.json

```bash
cat package.json | grep cspell
```

**Then** the output includes `"cspell"` in `devDependencies`
**And** the version is a stable release

### Requirement: Spell check command availability

The project MUST provide an npm script command for running spell checks.

#### Scenario: Run spell check on all files

```bash
npm run spell:check
```

**Then** CSpell analyzes all relevant files in the project
**And** the command exits with code 0 if no spelling errors are found
**And** the command exits with non-zero code if spelling errors exist
**And** violations are displayed in a readable format with file paths and line numbers

#### Scenario: Spell check respects ignore patterns

```bash
npm run spell:check
```

**Then** CSpell does not analyze files in `node_modules/`
**And** CSpell does not analyze files in `.git/`
**And** CSpell does not analyze `package-lock.json`
**And** the command completes quickly without scanning unnecessary files

### Requirement: File type support

CSpell MUST check spelling in TypeScript, JavaScript, Markdown, and JSON files.

#### Scenario: Check TypeScript files

**When** a TypeScript file contains a misspelled word in a comment
```typescript
// This is a mispeled comment
const x = 1;
```
**Then** CSpell reports the spelling error
**And** shows the file path and line number
**And** suggests corrections if available

#### Scenario: Check Markdown files

**When** a Markdown file contains spelling errors
```markdown
# Inroduction

This is a mispeled paragraph.
```
**Then** CSpell reports both spelling errors
**And** provides clear feedback about the issues

#### Scenario: Code-aware checking

**When** a file contains camelCase or snake_case identifiers
```typescript
const myVariableName = 1; // camelCase
const another_variable_name = 2; // snake_case
```
**Then** CSpell correctly splits compound words
**And** checks each component word for spelling
**And** does not flag properly spelled compound identifiers

### Requirement: Custom configuration

CSpell MUST use project-specific configuration to define dictionaries, ignore patterns, and checking behavior.

#### Scenario: CSpell config file exists

```bash
cat .cspell.json
```

**Then** the file exists at the project root
**And** contains valid JSON configuration

#### Scenario: Custom dictionary for technical terms

**When** the project uses specific technical terms or acronyms
**And** these terms are added to the CSpell custom dictionary
**Then** CSpell does not flag these terms as misspellings
**And** the dictionary is version-controlled in `.cspell.json`

#### Scenario: Configuration specifies file patterns

```bash
cat .cspell.json | grep -E "files|ignorePaths"
```

**Then** the configuration includes patterns for files to check
**And** the configuration includes patterns for files/directories to ignore
**And** common directories like `node_modules`, `.git`, and build outputs are ignored

### Requirement: Integration with existing toolchain

CSpell MUST work alongside existing quality tools (Prettier, OXLint, Vitest) without conflicts.

#### Scenario: CSpell works with formatted code

```bash
npm run format:write
npm run spell:check
```

**Then** CSpell successfully checks Prettier-formatted files
**And** formatting does not interfere with spell checking
**And** both tools can run independently

#### Scenario: All quality checks run together

```bash
npm run lint && npm run format:check && npm run spell:check
```

**Then** all three quality tools complete successfully
**And** no conflicts occur between tools
**And** combined execution time remains reasonable

### Requirement: VSCode extension recommendations

The project MUST recommend the CSpell VSCode extension to provide integrated spell checking in the editor.

#### Scenario: CSpell extension is recommended

```bash
cat .vscode/extensions.json | grep cspell
```

**Then** the output includes `"streetsidesoftware.code-spell-checker"` in the recommendations array
**And** developers opening the project in VSCode are prompted to install the extension

#### Scenario: Extension provides editor integration

**When** a developer has the CSpell VSCode extension installed
**Then** spelling errors are highlighted inline in the editor
**And** the developer can see suggestions and quick fixes
**And** the extension uses the same `.cspell.json` configuration as the CLI

### Requirement: CI pipeline integration

The CI pipeline MUST enforce spelling standards by failing builds when spelling errors are found.

#### Scenario: Spell check runs in CI

```bash
cat Jenkinsfile | grep spell
```

**Then** the Jenkinsfile includes a stage that runs spell checking
**And** the spell check stage runs after format and lint stages

#### Scenario: CI fails on spelling violations

**When** CI runs on code with spelling errors
**And** `npm run spell:check` exits with non-zero code
**Then** the CI build fails
**And** developers are notified that spelling needs to be fixed
**And** the error output shows which files have spelling issues

#### Scenario: CI passes with correct spelling

**When** CI runs on code without spelling errors
**And** `npm run spell:check` exits with code 0
**Then** the spell check stage passes
**And** the build continues to subsequent stages

### Requirement: Fast execution

CSpell MUST complete quickly to maintain developer productivity.

#### Scenario: Spell check completes quickly

```bash
time npm run spell:check
```

**Then** the command completes in under 2 seconds for the current codebase
**And** provides immediate feedback for development workflows

### Requirement: Clean codebase compliance

The existing codebase MUST pass spell checking without violations after implementation.

#### Scenario: Zero violations on current code

**When** running `npm run spell:check` on the existing codebase
**Then** the command exits with code 0
**And** no spelling errors are reported
**And** all existing spelling issues have been fixed or added to the custom dictionary

#### Scenario: Maintainable spelling standards

**When** new code is added to the project
**Then** spell checking catches typos and misspellings
**And** provides helpful suggestions for corrections
**And** maintains quality standards over time

### Requirement: Project documentation updates

Project documentation MUST be updated to reflect the addition of CSpell and spelling requirements.

#### Scenario: CLAUDE.md documents spell checking

```bash
cat CLAUDE.md | grep -i spell
```

**Then** CLAUDE.md includes information about spell checking
**And** documents the npm spell:check command
**And** explains the CSpell configuration

#### Scenario: CLAUDE.md includes CSpell in tech stack

```bash
cat CLAUDE.md | grep -i cspell
```

**Then** CLAUDE.md lists CSpell in the project's tooling/tech stack
**And** mentions that spell checking is enforced in CI

#### Scenario: project.md updated with spell checking conventions

```bash
cat openspec/project.md | grep -i spell
```

**Then** project.md includes spell checking in the code quality section
**And** documents the spell:check command
**And** explains that spelling is enforced in CI pipeline
