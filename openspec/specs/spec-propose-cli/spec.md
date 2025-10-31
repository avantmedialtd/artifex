# spec-propose-cli Specification

## Purpose

TBD - created by archiving change add-spec-propose-command. Update Purpose after archive.
## Requirements
### Requirement: Propose subcommand exists

The `spec` command MUST support a `propose` subcommand that initiates an OpenSpec change proposal.

#### Scenario: Developer runs propose command with proposal text

- **GIVEN** the developer has Claude Code installed and in their PATH
- **AND** they want to create a proposal with text "Add user authentication"
- **WHEN** they execute `zap spec propose Add user authentication`
- **THEN** the CLI invokes `claude --permission-mode acceptEdits "/openspec:proposal Add user authentication"`
- **AND** the Claude Code process executes the proposal workflow
- **AND** the zap command exits with the same status code as the Claude process

### Requirement: Proposal text argument is required

The `propose` subcommand MUST require proposal text and validate its presence.

#### Scenario: Developer runs propose without proposal text

- **GIVEN** the developer has zap installed
- **WHEN** they execute `zap spec propose` without providing any proposal text
- **THEN** the CLI displays an error message: "Error: spec propose requires proposal text"
- **AND** shows usage information: "Usage: zap spec propose <proposal-text>"
- **AND** exits with status code 1

### Requirement: Multi-word proposal text handling

The propose command MUST support multi-word proposal text without requiring manual quoting.

#### Scenario: Developer provides multi-word proposal

- **GIVEN** the developer executes `zap spec propose Add authentication with OAuth2`
- **WHEN** the command is processed
- **THEN** the CLI passes all words after "propose" as the proposal text
- **AND** executes: `claude --permission-mode acceptEdits "/openspec:proposal Add authentication with OAuth2"`

### Requirement: Claude Code availability check

The propose command MUST verify that Claude Code is available before attempting to execute it.

#### Scenario: Claude Code is not installed

- **GIVEN** the `claude` command is not available in the user's PATH
- **WHEN** the developer executes `zap spec propose <text>`
- **THEN** the CLI displays an error message: "Error: Claude Code CLI is not installed or not in PATH"
- **AND** displays help text: "Please install Claude Code from: https://claude.com/claude-code"
- **AND** exits with status code 1

#### Scenario: Claude Code is installed

- **GIVEN** the `claude` command is available in the user's PATH
- **WHEN** the developer executes `zap spec propose <text>`
- **THEN** the CLI successfully invokes the claude command
- **AND** passes through all output from the Claude process

### Requirement: Command execution with correct arguments

The propose command MUST invoke Claude Code with the exact required flags and slash command syntax.

#### Scenario: Executing claude with proper arguments

- **GIVEN** the developer executes `zap spec propose Implement new feature`
- **WHEN** the command is processed
- **THEN** the CLI executes: `claude --permission-mode acceptEdits "/openspec:proposal Implement new feature"`
- **AND** the permission-mode flag is set to "acceptEdits"
- **AND** the slash command includes the complete proposal text

### Requirement: Process output and exit code handling

The propose command MUST pass through the output from Claude Code and preserve its exit status.

#### Scenario: Claude Code succeeds

- **GIVEN** the Claude Code proposal process completes successfully (exit code 0)
- **WHEN** the zap command finishes
- **THEN** all output from Claude is displayed to the user
- **AND** the zap command exits with status code 0

#### Scenario: Claude Code fails

- **GIVEN** the Claude Code proposal process fails (non-zero exit code)
- **WHEN** the zap command finishes
- **THEN** all output and error messages from Claude are displayed to the user
- **AND** the zap command exits with the same non-zero status code

### Requirement: Integration with existing spec command

The propose subcommand MUST integrate seamlessly with the existing spec command structure.

#### Scenario: Unknown spec subcommand handling still works

- **GIVEN** the propose subcommand has been added
- **WHEN** a developer executes `zap spec unknown-command`
- **THEN** the CLI displays an error message: "Error: Unknown spec subcommand: unknown-command"
- **AND** exits with status code 1

### Requirement: Auto-commit after proposal creation

The propose command MUST automatically commit the generated proposal files after the `/openspec:proposal` command completes successfully.

#### Scenario: Proposal is created and committed automatically

- **GIVEN** the developer executes `zap spec propose Add new feature`
- **AND** the `/openspec:proposal` command successfully creates a proposal with change-id "add-new-feature"
- **AND** the proposal.md file's first line is "# Proposal: Add new feature"
- **WHEN** the Claude Code process completes successfully
- **THEN** the CLI stages all files in `openspec/changes/add-new-feature/`
- **AND** creates a git commit with message "Propose: Add new feature"
- **AND** the zap command exits with status code 0

#### Scenario: Commit message title extraction with "Proposal:" prefix

- **GIVEN** a proposal.md with first line "# Proposal: Show help page if no argument is provided"
- **WHEN** the commit message is generated
- **THEN** the title "Show help page if no argument is provided" is extracted
- **AND** the "Proposal: " prefix is stripped
- **AND** the commit message is "Propose: Show help page if no argument is provided"

#### Scenario: Commit message title extraction without "Proposal:" prefix

- **GIVEN** a proposal.md with first line "# Add user authentication"
- **WHEN** the commit message is generated
- **THEN** the title "Add user authentication" is extracted
- **AND** the commit message is "Propose: Add user authentication"

### Requirement: Git commit failure handling

The propose command MUST handle git commit failures gracefully and report clear error messages.

#### Scenario: Git commit fails

- **GIVEN** the proposal files are created successfully
- **AND** the git commit command fails (e.g., due to git configuration issues)
- **WHEN** the commit fails
- **THEN** the CLI displays a clear error message indicating the commit failed
- **AND** the proposal files remain uncommitted for manual intervention
- **AND** the zap command exits with status code 1

#### Scenario: Title extraction fails

- **GIVEN** the proposal.md file has an unexpected format
- **AND** the title cannot be extracted from the first line
- **WHEN** generating the commit message
- **THEN** the CLI uses a fallback commit message or reports an error
- **AND** provides guidance on how to manually commit

### Requirement: Commit scope limitation

The automatic commit MUST only include files in the proposal's change directory, not other uncommitted changes in the repository.

#### Scenario: Only proposal files are committed

- **GIVEN** the developer has other uncommitted changes in the repository
- **AND** they execute `zap spec propose Add feature`
- **WHEN** the automatic commit is created
- **THEN** only files in `openspec/changes/add-feature/` are staged and committed
- **AND** other uncommitted changes remain unstaged
- **AND** the working directory state for non-proposal files is unchanged

