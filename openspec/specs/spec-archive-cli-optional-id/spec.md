# spec-archive-cli-optional-id Specification

## Purpose
TBD - created by archiving change optional-spec-id-archive. Update Purpose after archive.
## Requirements
### Requirement: Spec-id argument is optional

The `archive` subcommand MUST accept an optional spec-id argument and handle both cases correctly.

#### Scenario: Developer runs archive with spec-id

- **GIVEN** the developer has Claude Code installed and in their PATH
- **AND** a valid spec-id exists (e.g., "add-user-auth")
- **WHEN** they execute `zap spec archive add-user-auth`
- **THEN** the CLI invokes `claude --permission-mode acceptEdits "/openspec:archive add-user-auth"`
- **AND** the Claude Code process executes the archive workflow with the specified spec-id
- **AND** the zap command exits with the same status code as the Claude process

#### Scenario: Developer runs archive without spec-id

- **GIVEN** the developer has Claude Code installed and in their PATH
- **WHEN** they execute `zap spec archive` without providing a spec-id
- **THEN** the CLI invokes `claude --permission-mode acceptEdits "/openspec:archive"`
- **AND** Claude Code prompts the user to select a spec interactively
- **AND** the zap command exits with the same status code as the Claude process

#### Scenario: Spec-id provided in slash command

- **GIVEN** the developer executes `zap spec archive my-spec-id`
- **WHEN** the command is processed
- **THEN** the CLI passes the spec-id to the Claude slash command
- **AND** executes: `claude --permission-mode acceptEdits "/openspec:archive my-spec-id"`

#### Scenario: Spec-id omitted from slash command

- **GIVEN** the developer executes `zap spec archive`
- **WHEN** the command is processed
- **THEN** the CLI omits the spec-id from the Claude slash command
- **AND** executes: `claude --permission-mode acceptEdits "/openspec:archive"`
- **AND** Claude Code handles the interactive spec selection

### Requirement: Help text reflects optional argument

The help text and error messages MUST accurately reflect that spec-id is optional.

#### Scenario: Help command shows optional spec-id

- **GIVEN** the developer runs `zap help spec archive` (if help system supports it)
- **OR** reads the help output for the spec command
- **WHEN** viewing the usage information
- **THEN** the usage shows: `zap spec archive [spec-id]`
- **AND** the description indicates that spec-id is optional

