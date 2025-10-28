# cli-command-shortcuts Specification

## Purpose

Provides convenient top-level shorthand commands for frequently-used OpenSpec operations.

## ADDED Requirements

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
