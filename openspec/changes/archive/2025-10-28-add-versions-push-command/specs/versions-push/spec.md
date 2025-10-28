# versions-push Specification

## ADDED Requirements

### Requirement: Versions push command invocation

The system SHALL provide a `versions push` command that force-pushes all git worktrees matching the `/v\d+/` pattern to their remote repositories.

#### Scenario: Developer runs versions push

- **GIVEN** the developer is in a git repository with worktrees
- **WHEN** they execute `zap versions push`
- **THEN** the command identifies all worktrees with branches matching `/v\d+/` pattern
- **AND** force-pushes each matching worktree to its remote repository

#### Scenario: Versions subcommand is recognized

- **GIVEN** the developer runs `zap versions push`
- **WHEN** the command parser processes the arguments
- **THEN** it recognizes `push` as a valid subcommand for `versions`
- **AND** invokes the versions push handler

### Requirement: Worktree enumeration for push

The system SHALL enumerate git worktrees and filter by branch name matching the pattern `/v\d+/` for pushing.

#### Scenario: Multiple version worktrees exist

- **GIVEN** worktrees with branches named `v1`, `v2`, `v10`, and `feature-branch`
- **WHEN** the versions push command executes
- **THEN** it identifies worktrees with branches `v1`, `v2`, and `v10`
- **AND** excludes `feature-branch` from the push operation

#### Scenario: No matching worktrees found

- **GIVEN** no worktrees with branches matching `/v\d+/` exist
- **WHEN** the versions push command executes
- **THEN** it displays a message "No worktrees with branches matching /v\\d+/ pattern found."
- **AND** exits successfully with code 0

#### Scenario: Worktree branch name validation for push

- **GIVEN** worktrees with branches named `v1`, `v001`, `version1`, `v1.2`, and `v`
- **WHEN** the versions push command executes
- **THEN** it matches only `v1` and `v001` (single 'v' followed by one or more digits)
- **AND** excludes `version1`, `v1.2`, and `v`

### Requirement: Git force push operation

The system SHALL execute `git push --force` in each matching worktree to push the branch to its remote repository.

#### Scenario: Force push worktrees to remote

- **GIVEN** worktrees `v1`, `v2`, and `v3` are identified for pushing
- **WHEN** the versions push command executes
- **THEN** it runs `git push --force` in each worktree directory
- **AND** each branch is force-pushed to the remote repository

#### Scenario: Push operation succeeds

- **GIVEN** matching worktrees ready to push
- **WHEN** git push --force is executed in each worktree
- **THEN** each push operation completes successfully
- **AND** the remote branch is updated to match the local worktree state

#### Scenario: Detached HEAD state handling

- **GIVEN** a worktree with branch `v5` is in detached HEAD state
- **WHEN** the versions push command executes git push
- **THEN** the git push command runs and reports the error
- **AND** the command stops and displays the error message
- **AND** exits with code 1

### Requirement: Stop on first failure

The system SHALL stop pushing remaining worktrees when the first push failure occurs.

#### Scenario: First push fails

- **GIVEN** worktrees `v1`, `v2`, and `v3` need to be pushed
- **AND** pushing `v1` succeeds
- **AND** pushing `v2` fails due to a git error
- **WHEN** the push failure occurs
- **THEN** the command stops immediately without attempting to push `v3`
- **AND** displays the error message from the failed push
- **AND** exits with code 1

#### Scenario: All pushes succeed

- **GIVEN** worktrees `v1`, `v2`, and `v3` need to be pushed
- **WHEN** all push operations succeed
- **THEN** the command completes successfully
- **AND** displays a success summary
- **AND** exits with code 0

### Requirement: Git repository validation for push

The system SHALL validate that the command is run from within a git repository before attempting to push.

#### Scenario: Not in a git repository

- **GIVEN** the command is run from a directory that is not a git repository
- **WHEN** the versions push command executes
- **THEN** it displays an error message "Error: Not in a git repository"
- **AND** exits with code 1

#### Scenario: Valid git repository for push

- **GIVEN** the command is run from within a git repository
- **WHEN** the versions push command validates the environment
- **THEN** validation passes
- **AND** the command proceeds to enumerate worktrees

### Requirement: Progress and result reporting for push

The system SHALL provide clear feedback about the push operation progress and results.

#### Scenario: Successful push of multiple worktrees

- **GIVEN** worktrees `v1`, `v2`, and `v3` are successfully pushed
- **WHEN** the versions push command completes
- **THEN** it displays a message "Successfully pushed 3 worktree(s): v1, v2, v3"
- **AND** exits with code 0

#### Scenario: Display push operation progress

- **GIVEN** multiple worktrees are being pushed
- **WHEN** the command executes
- **THEN** it displays progress such as "Pushing worktree v1..."
- **AND** indicates when each push completes before moving to the next

#### Scenario: Clear error messages for push failures

- **GIVEN** a push operation fails in worktree `v2`
- **WHEN** the git push command returns an error
- **THEN** it displays "Error: Failed to push worktree 'v2': " followed by the git error message
- **AND** provides context about which worktree failed
- **AND** exits with code 1

### Requirement: Error handling for git push failures

The system SHALL handle git push command failures gracefully with informative error messages.

#### Scenario: Git push command fails

- **GIVEN** the `git push --force` command fails in a worktree
- **WHEN** the versions push command encounters the failure
- **THEN** it displays an error message with the git error output
- **AND** indicates which worktree failed to push
- **AND** exits with code 1

#### Scenario: Network connectivity issues

- **GIVEN** the git push fails due to network connectivity issues
- **WHEN** the push operation is attempted
- **THEN** the command displays the network error from git
- **AND** exits with code 1

#### Scenario: Remote repository authentication failure

- **GIVEN** the git push fails due to authentication issues
- **WHEN** the push operation is attempted
- **THEN** the command displays the authentication error from git
- **AND** exits with code 1

#### Scenario: Invalid worktree path for push

- **GIVEN** a worktree path from git worktree list is invalid or inaccessible
- **WHEN** the command tries to push from the worktree
- **THEN** it displays an error message with the worktree path
- **AND** exits with code 1
