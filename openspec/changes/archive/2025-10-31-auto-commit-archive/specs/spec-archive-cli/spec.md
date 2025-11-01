# spec-archive-cli Delta

## ADDED Requirements

### Requirement: Auto-commit after archive operation

The archive command MUST automatically commit the archived spec files after the `/openspec:archive` command completes successfully.

#### Scenario: Archive operation is committed automatically

- **GIVEN** the developer executes `zap spec archive add-cli-executable`
- **AND** the `/openspec:archive` command successfully archives the spec
- **AND** the archived proposal.md file's first line is "# Proposal: Add CLI executable"
- **WHEN** the Claude Code process completes successfully
- **THEN** the CLI stages all files in `openspec/specs/add-cli-executable/`
- **AND** creates a git commit with message "Archive: Add CLI executable"
- **AND** displays a success message: "Archive committed: Archive: Add CLI executable"
- **AND** the zap command exits with status code 0

#### Scenario: Commit message title extraction with "Proposal:" prefix

- **GIVEN** an archived proposal.md with first line "# Proposal: Add dependency upgrade command"
- **WHEN** the commit message is generated
- **THEN** the title "Add dependency upgrade command" is extracted
- **AND** the "Proposal: " prefix is stripped
- **AND** the commit message is "Archive: Add dependency upgrade command"

#### Scenario: Commit message title extraction without "Proposal:" prefix

- **GIVEN** an archived proposal.md with first line "# Show help on no args"
- **WHEN** the commit message is generated
- **THEN** the title "Show help on no args" is extracted
- **AND** the commit message is "Archive: Show help on no args"

### Requirement: Git commit failure handling for archive

The archive command MUST handle git commit failures gracefully and report clear warning messages without failing the overall operation.

#### Scenario: Archive git commit fails

- **GIVEN** the archive operation completes successfully
- **AND** the git commit command fails (e.g., due to git configuration issues)
- **WHEN** the commit fails
- **THEN** the CLI displays a warning message: "Warning: Failed to auto-commit archive: <error details>"
- **AND** displays guidance: "Archive completed but not committed. Please commit manually."
- **AND** the archive files remain uncommitted for manual intervention
- **AND** the zap command exits with status code 0 (archive succeeded even though commit failed)

#### Scenario: Archive title extraction fails

- **GIVEN** the archive operation completes successfully
- **AND** the proposal.md file cannot be found or has an unexpected format
- **WHEN** generating the commit message
- **THEN** the CLI displays a warning: "Warning: Could not extract archive title for auto-commit"
- **AND** displays guidance: "Archive completed but not committed. Please commit manually."
- **AND** the zap command exits with status code 0

### Requirement: Archive commit scope limitation

The automatic commit MUST only include files in the archived spec directory, not other uncommitted changes in the repository.

#### Scenario: Only archived spec files are committed

- **GIVEN** the developer has other uncommitted changes in the repository
- **AND** they execute `zap spec archive add-feature`
- **WHEN** the automatic commit is created
- **THEN** only files in `openspec/specs/add-feature/` are staged and committed
- **AND** other uncommitted changes remain unstaged
- **AND** the working directory state for non-archive files is unchanged
