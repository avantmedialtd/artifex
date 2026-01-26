# worktree-reset Specification

## Purpose

Provides the ability to reset a git worktree to the current HEAD revision, enabling developers to quickly synchronize any worktree with the main working directory's state.

## ADDED Requirements

### Requirement: Worktree reset command invocation

The system SHALL provide a `worktree reset` command that resets a worktree to the current HEAD revision.

#### Scenario: Reset current worktree without arguments

- **GIVEN** the developer is in a git worktree
- **WHEN** they execute `af worktree reset` without arguments
- **THEN** the current worktree is reset to the main repository's HEAD revision

#### Scenario: Reset named worktree

- **GIVEN** the developer is in a git repository with worktrees
- **WHEN** they execute `af worktree reset feature-x`
- **THEN** the worktree with branch `feature-x` is reset to the current HEAD revision

#### Scenario: Named worktree not found

- **GIVEN** no worktree exists with the specified name
- **WHEN** they execute `af worktree reset nonexistent`
- **THEN** it displays an error message "Error: Worktree 'nonexistent' not found"
- **AND** exits with code 1

### Requirement: Git repository validation

The system SHALL validate that the command is run from within a git repository.

#### Scenario: Not in a git repository

- **GIVEN** the command is run from a directory that is not a git repository
- **WHEN** the worktree reset command executes
- **THEN** it displays an error message "Error: Not in a git repository"
- **AND** exits with code 1

#### Scenario: Valid git repository

- **GIVEN** the command is run from within a git repository
- **WHEN** the worktree reset command validates the environment
- **THEN** validation passes
- **AND** the command proceeds with the reset operation

### Requirement: Uncommitted changes detection

The system SHALL check the target worktree for uncommitted changes before resetting.

#### Scenario: Worktree has uncommitted changes

- **GIVEN** the target worktree has modified files not yet committed
- **WHEN** the worktree reset command checks for uncommitted changes
- **THEN** it detects the uncommitted changes
- **AND** displays an error message indicating uncommitted changes exist
- **AND** exits with code 1

#### Scenario: Worktree has staged changes

- **GIVEN** the target worktree has staged but uncommitted changes
- **WHEN** the worktree reset command checks for uncommitted changes
- **THEN** it detects the staged changes
- **AND** displays an error message indicating uncommitted changes exist
- **AND** exits with code 1

#### Scenario: Worktree is clean

- **GIVEN** the target worktree has no uncommitted or staged changes
- **WHEN** the worktree reset command checks for uncommitted changes
- **THEN** all checks pass
- **AND** the command proceeds to reset the worktree

### Requirement: Git reset hard operation

The system SHALL execute `git reset --hard` in the target worktree to the current HEAD revision.

#### Scenario: Reset worktree to current HEAD

- **GIVEN** the main repository is at commit `abc123`
- **AND** the target worktree is at a different commit
- **WHEN** the worktree reset command executes
- **THEN** it runs `git reset --hard abc123` in the target worktree
- **AND** the worktree is updated to commit `abc123`

#### Scenario: Reset operation fails

- **GIVEN** a git reset --hard command fails in the worktree
- **WHEN** the error occurs
- **THEN** the command reports the failure
- **AND** includes the git error message
- **AND** exits with code 1

### Requirement: Current revision detection

The system SHALL use the HEAD commit of the current repository as the target revision for resetting.

#### Scenario: Get current HEAD commit

- **GIVEN** the main repository is at commit `def456`
- **WHEN** the worktree reset command determines the target revision
- **THEN** it retrieves the current HEAD commit hash `def456`
- **AND** uses this as the target for the reset operation

### Requirement: Progress and result reporting

The system SHALL provide clear feedback about the reset operation progress and results.

#### Scenario: Successful reset

- **GIVEN** a worktree is successfully reset
- **WHEN** the worktree reset command completes
- **THEN** it displays a success message indicating the worktree was reset
- **AND** exits with code 0

#### Scenario: Clear error messages

- **GIVEN** a worktree has uncommitted changes
- **WHEN** the command fails due to uncommitted changes
- **THEN** it displays "Error: Cannot reset worktree with uncommitted changes"
- **AND** suggests running `git status` in the affected worktree

### Requirement: Current worktree detection

The system SHALL detect when executed from within a worktree and use that as the target when no name is provided.

#### Scenario: Running from main repository

- **GIVEN** the developer runs `af worktree reset` from the main repository (not a worktree)
- **WHEN** no worktree name is provided
- **THEN** it displays an error message "Error: Not in a worktree. Specify a worktree name or run from within a worktree."
- **AND** exits with code 1

#### Scenario: Running from within a worktree

- **GIVEN** the developer is in a worktree directory
- **WHEN** they execute `af worktree reset` without arguments
- **THEN** the command identifies the current worktree
- **AND** proceeds to reset it to the main repository's HEAD
