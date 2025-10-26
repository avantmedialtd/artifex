# cli-command-shortcuts Spec Delta

## ADDED Requirements

### Requirement: Top-level archive command

The CLI MUST support `archive` as a top-level command that delegates to the spec archive functionality.

#### Scenario: Developer uses archive shorthand

- **GIVEN** the developer has zap installed
- **AND** they want to archive a change with spec-id "add-user-auth"
- **WHEN** they execute `zap archive add-user-auth`
- **THEN** the CLI invokes the same logic as `zap spec archive`
- **AND** the Claude Code process executes with: `claude --permission-mode acceptEdits "/openspec:archive add-user-auth"`
- **AND** the zap command exits with the same status code as the Claude process

### Requirement: Archive shorthand requires spec-id

The `archive` shorthand MUST require a spec-id argument and validate its presence, identical to `zap spec archive`.

#### Scenario: Developer runs archive shorthand without spec-id

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap archive` without providing any spec-id
- **THEN** the CLI displays an error message: "Error: spec archive requires a spec-id argument"
- **AND** shows usage information: "Usage: zap spec archive <spec-id>"
- **AND** exits with status code 1

### Requirement: Backward compatibility with spec archive

The existing `zap spec archive` command path MUST continue to work identically to maintain backward compatibility.

#### Scenario: Developer uses original spec archive command

- **GIVEN** the developer has the new archive shorthand available
- **WHEN** they execute `zap spec archive add-user-auth`
- **THEN** the command works identically to `zap archive add-user-auth`
- **AND** invokes: `claude --permission-mode acceptEdits "/openspec:archive add-user-auth"`
- **AND** exits with the Claude process status code

#### Scenario: Both command forms behave identically

- **GIVEN** the same spec-id is used
- **WHEN** comparing `zap archive <spec-id>` with `zap spec archive <spec-id>`
- **THEN** both commands invoke the same underlying function
- **AND** both perform the same validation
- **AND** both execute the same claude command
- **AND** both have identical error handling

### Requirement: Claude Code availability check in shorthand

The archive shorthand MUST verify that Claude Code is available before attempting to execute it.

#### Scenario: Claude Code is not installed when using shorthand

- **GIVEN** the `claude` command is not available in the user's PATH
- **WHEN** the developer executes `zap archive <spec-id>`
- **THEN** the CLI displays an error message: "Error: Claude Code CLI is not installed or not in PATH"
- **AND** displays help text: "Please install Claude Code from: https://claude.com/claude-code"
- **AND** exits with status code 1
