# versions-reset Specification

## Purpose

TBD - created by archiving change add-versions-reset-command. Update Purpose after archive.

## Requirements

### Requirement: Versions reset command invocation

The system SHALL provide a `versions reset` command that resets git worktrees matching a specific pattern.

#### Scenario: Developer runs versions reset

- **GIVEN** the developer is in a git repository with worktrees
- **WHEN** they execute `zap versions reset`
- **THEN** the command identifies all worktrees with branches matching `/v\d+/` pattern
- **AND** resets each matching worktree to the current branch's HEAD revision

#### Scenario: No subcommand provided

- **GIVEN** the developer runs `zap versions` without a subcommand
- **WHEN** the command executes
- **THEN** it displays an error message "Error: versions command requires a subcommand (e.g., reset)"
- **AND** exits with code 1

#### Scenario: Unknown subcommand

- **GIVEN** the developer runs `zap versions unknown`
- **WHEN** the command executes
- **THEN** it displays an error message "Error: Unknown versions subcommand: unknown"
- **AND** exits with code 1

### Requirement: Worktree enumeration by branch name

The system SHALL enumerate git worktrees and filter by branch name matching the pattern `/v\d+/`.

#### Scenario: Multiple version worktrees exist

- **GIVEN** worktrees with branches named `v1`, `v2`, `v10`, and `feature-branch`
- **WHEN** the versions reset command executes
- **THEN** it identifies worktrees with branches `v1`, `v2`, and `v10`
- **AND** excludes `feature-branch` from the reset operation

#### Scenario: No matching worktrees found

- **GIVEN** no worktrees with branches matching `/v\d+/` exist
- **WHEN** the versions reset command executes
- **THEN** it displays a message indicating no matching worktrees were found
- **AND** exits successfully with code 0

#### Scenario: Worktree branch name validation

- **GIVEN** worktrees with branches named `v1`, `v001`, `version1`, `v1.2`, and `v`
- **WHEN** the versions reset command executes
- **THEN** it matches only `v1` and `v001` (single 'v' followed by one or more digits)
- **AND** excludes `version1`, `v1.2`, and `v`

### Requirement: Uncommitted changes detection

The system SHALL check each matching worktree for uncommitted changes before resetting.

#### Scenario: Worktree has uncommitted changes

- **GIVEN** a worktree with branch `v1` has modified files not yet committed
- **WHEN** the versions reset command checks for uncommitted changes
- **THEN** it detects the uncommitted changes
- **AND** fails with an error message listing the worktree with uncommitted changes
- **AND** exits with code 1
- **AND** does not reset any worktrees

#### Scenario: Worktree has staged changes

- **GIVEN** a worktree with branch `v2` has staged but uncommitted changes
- **WHEN** the versions reset command checks for uncommitted changes
- **THEN** it detects the staged changes
- **AND** fails with an error message listing the worktree with uncommitted changes
- **AND** exits with code 1

#### Scenario: All worktrees are clean

- **GIVEN** all matching worktrees have no uncommitted or staged changes
- **WHEN** the versions reset command checks for uncommitted changes
- **THEN** all checks pass
- **AND** the command proceeds to reset worktrees

### Requirement: Git reset hard operation

The system SHALL execute `git reset --hard` in each matching worktree to the target revision.

#### Scenario: Reset worktrees to current branch HEAD

- **GIVEN** the current branch is `master` at commit `abc123`
- **AND** worktrees `v1` and `v2` are at different commits
- **WHEN** the versions reset command executes
- **THEN** it runs `git reset --hard abc123` in each worktree
- **AND** both worktrees are updated to commit `abc123`

#### Scenario: Reset operation succeeds

- **GIVEN** matching worktrees with no uncommitted changes
- **WHEN** git reset --hard is executed in each worktree
- **THEN** each reset operation completes successfully
- **AND** worktree HEAD is moved to the target revision
- **AND** working directory is updated to match the target revision

#### Scenario: Reset operation fails

- **GIVEN** a git reset --hard command fails in one worktree
- **WHEN** the error occurs
- **THEN** the command reports which worktree failed
- **AND** includes the git error message
- **AND** exits with code 1

### Requirement: Current revision detection

The system SHALL use the HEAD commit of the current branch as the target revision for resetting worktrees.

#### Scenario: Get current HEAD commit

- **GIVEN** the developer is on branch `master` at commit `def456`
- **WHEN** the versions reset command determines the target revision
- **THEN** it retrieves the current HEAD commit hash `def456`
- **AND** uses this as the target for all reset operations

#### Scenario: Detached HEAD state

- **GIVEN** the current repository is in detached HEAD state
- **WHEN** the versions reset command determines the target revision
- **THEN** it uses the current HEAD commit hash
- **AND** proceeds with the reset operation

### Requirement: Git repository validation

The system SHALL validate that the command is run from within a git repository.

#### Scenario: Not in a git repository

- **GIVEN** the command is run from a directory that is not a git repository
- **WHEN** the versions reset command executes
- **THEN** it displays an error message "Error: Not in a git repository"
- **AND** exits with code 1

#### Scenario: Valid git repository

- **GIVEN** the command is run from within a git repository
- **WHEN** the versions reset command validates the environment
- **THEN** validation passes
- **AND** the command proceeds to enumerate worktrees

### Requirement: Progress and result reporting

The system SHALL provide clear feedback about the reset operation progress and results.

#### Scenario: Successful reset of multiple worktrees

- **GIVEN** worktrees `v1`, `v2`, and `v3` are successfully reset
- **WHEN** the versions reset command completes
- **THEN** it displays a message "Successfully reset 3 worktree(s): v1, v2, v3"
- **AND** exits with code 0

#### Scenario: Clear error messages

- **GIVEN** a worktree has uncommitted changes
- **WHEN** the command fails due to uncommitted changes
- **THEN** it displays "Error: Cannot reset worktrees with uncommitted changes"
- **AND** lists each worktree with uncommitted changes: "Worktree 'v1' at /path/to/v1 has uncommitted changes"
- **AND** suggests running `git status` in the affected worktrees

#### Scenario: Display reset operation progress

- **GIVEN** multiple worktrees are being reset
- **WHEN** the command executes
- **THEN** it displays progress such as "Resetting worktree v1..."
- **AND** indicates completion for each worktree

### Requirement: Error handling for git command failures

The system SHALL handle git command failures gracefully with informative error messages.

#### Scenario: Git worktree list command fails

- **GIVEN** the `git worktree list` command fails
- **WHEN** the versions reset command tries to enumerate worktrees
- **THEN** it displays an error message with the git error output
- **AND** exits with code 1

#### Scenario: Git status command fails

- **GIVEN** checking git status in a worktree fails
- **WHEN** the command tries to detect uncommitted changes
- **THEN** it displays an error message indicating which worktree check failed
- **AND** exits with code 1

#### Scenario: Invalid worktree path

- **GIVEN** a worktree path from git worktree list is invalid or inaccessible
- **WHEN** the command tries to operate on the worktree
- **THEN** it displays an error message with the worktree path
- **AND** exits with code 1
