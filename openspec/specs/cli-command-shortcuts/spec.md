# cli-command-shortcuts Specification

## Purpose

TBD - created by archiving change add-propose-shorthand. Update Purpose after archive.
## Requirements
### Requirement: Top-level propose command

The CLI MUST support `propose` as a top-level command that delegates to the spec propose functionality.

#### Scenario: Developer uses propose shorthand

- **GIVEN** the developer has zap installed
- **AND** they want to create a proposal with text "Add user authentication"
- **WHEN** they execute `zap propose Add user authentication`
- **THEN** the CLI invokes the same logic as `zap spec propose`
- **AND** the Claude Code process executes with: `claude --permission-mode acceptEdits "/openspec:proposal Add user authentication"`
- **AND** the zap command exits with the same status code as the Claude process

### Requirement: Propose shorthand requires proposal text

The `propose` shorthand MUST require proposal text and validate its presence, identical to `zap spec propose`.

#### Scenario: Developer runs propose shorthand without proposal text

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap propose` without providing any proposal text
- **THEN** the CLI displays an error message: "Error: propose requires proposal text"
- **AND** shows usage information: "Usage: zap propose <proposal-text>"
- **AND** exits with status code 1

### Requirement: Backward compatibility with spec propose

The existing `zap spec propose` command path MUST continue to work identically to maintain backward compatibility.

#### Scenario: Developer uses original spec propose command

- **GIVEN** the developer has the new propose shorthand available
- **WHEN** they execute `zap spec propose Add new feature`
- **THEN** the command works identically to `zap propose Add new feature`
- **AND** invokes: `claude --permission-mode acceptEdits "/openspec:proposal Add new feature"`
- **AND** exits with the Claude process status code

#### Scenario: Both command forms behave identically

- **GIVEN** the same proposal text is used
- **WHEN** comparing `zap propose <text>` with `zap spec propose <text>`
- **THEN** both commands invoke the same underlying function
- **AND** both perform the same validation
- **AND** both execute the same claude command
- **AND** both have identical error handling

### Requirement: Multi-word proposal text handling in shorthand

The propose shorthand MUST support multi-word proposal text without requiring manual quoting.

#### Scenario: Developer provides multi-word proposal via shorthand

- **GIVEN** the developer executes `zap propose Add authentication with OAuth2`
- **WHEN** the command is processed
- **THEN** the CLI passes all words after "propose" as the proposal text
- **AND** executes: `claude --permission-mode acceptEdits "/openspec:proposal Add authentication with OAuth2"`

### Requirement: Claude Code availability check in shorthand

The propose shorthand MUST verify that Claude Code is available before attempting to execute it.

#### Scenario: Claude Code is not installed when using shorthand

- **GIVEN** the `claude` command is not available in the user's PATH
- **WHEN** the developer executes `zap propose <text>`
- **THEN** the CLI displays an error message: "Error: Claude Code CLI is not installed or not in PATH"
- **AND** displays help text: "Please install Claude Code from: https://claude.com/claude-code"
- **AND** exits with status code 1

### Requirement: Unknown top-level command handling

The CLI MUST handle unknown top-level commands gracefully without breaking existing error handling.

#### Scenario: Unknown top-level command after adding propose

- **GIVEN** the propose shorthand has been added
- **WHEN** a developer executes `zap unknown-command`
- **THEN** the CLI displays an error message: "Error: Unknown command: unknown-command"
- **AND** exits with status code 1

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

### Requirement: Claude Code availability check in archive shorthand

The archive shorthand MUST verify that Claude Code is available before attempting to execute it.

#### Scenario: Claude Code is not installed when using archive shorthand

- **GIVEN** the `claude` command is not available in the user's PATH
- **WHEN** the developer executes `zap archive <spec-id>`
- **THEN** the CLI displays an error message: "Error: Claude Code CLI is not installed or not in PATH"
- **AND** displays help text: "Please install Claude Code from: https://claude.com/claude-code"
- **AND** exits with status code 1

### Requirement: Top-level apply command

The CLI MUST support `apply` as a top-level command that delegates to the spec apply functionality.

#### Scenario: Developer uses apply shorthand with change-id

- **GIVEN** the developer has zap installed
- **AND** they want to apply a change with id "add-user-auth"
- **WHEN** they execute `zap apply add-user-auth`
- **THEN** the CLI invokes the same logic as `zap spec apply`
- **AND** the Claude Code process executes with: `claude --permission-mode acceptEdits "/openspec:apply add-user-auth"`
- **AND** the zap command exits with the same status code as the Claude process

#### Scenario: Developer uses apply shorthand without change-id

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap apply`
- **THEN** the CLI invokes the same logic as `zap spec apply`
- **AND** the Claude Code process executes with: `claude --permission-mode acceptEdits "/openspec:apply"`
- **AND** Claude Code prompts the user to select a change interactively
- **AND** the zap command exits with the same status code as the Claude process

### Requirement: Apply shorthand accepts optional change-id

The `apply` shorthand MUST accept an optional change-id argument, identical to `zap spec apply`.

#### Scenario: Developer provides change-id via shorthand

- **GIVEN** the developer executes `zap apply my-change-id`
- **WHEN** the command is processed
- **THEN** the CLI passes the change-id to the underlying handler
- **AND** executes: `claude --permission-mode acceptEdits "/openspec:apply my-change-id"`

#### Scenario: Developer omits change-id via shorthand

- **GIVEN** the developer executes `zap apply`
- **WHEN** the command is processed
- **THEN** the CLI omits the change-id from the Claude slash command
- **AND** executes: `claude --permission-mode acceptEdits "/openspec:apply"`

### Requirement: Backward compatibility with spec apply

The existing `zap spec apply` command path MUST continue to work identically to maintain backward compatibility.

#### Scenario: Developer uses original spec apply command

- **GIVEN** the developer has the new apply shorthand available
- **WHEN** they execute `zap spec apply add-user-auth`
- **THEN** the command works identically to `zap apply add-user-auth`
- **AND** invokes: `claude --permission-mode acceptEdits "/openspec:apply add-user-auth"`
- **AND** exits with the Claude process status code

#### Scenario: Both command forms behave identically

- **GIVEN** the same change-id is used (or omitted)
- **WHEN** comparing `zap apply [change-id]` with `zap spec apply [change-id]`
- **THEN** both commands invoke the same underlying function
- **AND** both perform the same validation
- **AND** both execute the same claude command
- **AND** both have identical error handling

### Requirement: Claude Code availability check in apply shorthand

The apply shorthand MUST verify that Claude Code is available before attempting to execute it.

#### Scenario: Claude Code is not installed when using apply shorthand

- **GIVEN** the `claude` command is not available in the user's PATH
- **WHEN** the developer executes `zap apply [change-id]`
- **THEN** the CLI displays an error message: "Error: Claude Code CLI is not installed or not in PATH"
- **AND** displays help text: "Please install Claude Code from: https://claude.com/claude-code"
- **AND** exits with status code 1

