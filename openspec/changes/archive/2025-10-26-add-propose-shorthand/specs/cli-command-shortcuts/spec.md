# cli-command-shortcuts Specification

## Purpose

Define convenient shorthand commands for frequently-used zap operations to improve developer ergonomics and reduce typing friction.

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

## ADDED Requirements

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
