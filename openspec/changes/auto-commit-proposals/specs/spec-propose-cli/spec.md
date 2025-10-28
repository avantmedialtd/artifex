# spec-propose-cli Delta

## ADDED Requirements

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
