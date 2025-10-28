# Implementation Tasks

## 1. Command Routing

- [x] 1.1 Add `versions` command case to main command router in [main.ts](main.ts)
- [x] 1.2 Add subcommand parsing for `reset` under versions command
- [x] 1.3 Add error handling for missing or invalid versions subcommands
- [x] 1.4 Call `runVersionsReset()` function when `versions reset` is invoked

## 2. Git Operations Module

- [x] 2.1 Create new file `git-worktree.ts` for git worktree operations
- [x] 2.2 Implement `isGitRepository()` function to validate git repo
- [x] 2.3 Implement `getCurrentHeadCommit()` function to get current branch HEAD
- [x] 2.4 Implement `listWorktrees()` function to parse `git worktree list --porcelain` output
- [x] 2.5 Implement `getWorktreeBranch()` function to extract branch name from worktree
- [x] 2.6 Implement `hasUncommittedChanges()` function using `git status --porcelain`
- [x] 2.7 Implement `resetWorktree()` function to run `git reset --hard <revision>` in worktree

## 3. Versions Reset Implementation

- [x] 3.1 Create `runVersionsReset()` function in main.ts
- [x] 3.2 Validate current directory is a git repository
- [x] 3.3 Get current HEAD commit hash
- [x] 3.4 Enumerate all worktrees and filter by branch name pattern `/v\d+/`
- [x] 3.5 Check each matching worktree for uncommitted changes
- [x] 3.6 If any worktree has uncommitted changes, report error and exit
- [x] 3.7 Reset each clean worktree to the target revision
- [x] 3.8 Display progress messages during reset operations
- [x] 3.9 Display success summary with count and list of reset worktrees

## 4. Error Handling

- [x] 4.1 Handle "not in git repository" error
- [x] 4.2 Handle "no matching worktrees found" case
- [x] 4.3 Handle uncommitted changes detection and reporting
- [x] 4.4 Handle git command failures with descriptive error messages
- [x] 4.5 Handle invalid worktree paths gracefully

## 5. Testing

- [x] 5.1 Create `git-worktree.test.ts` with unit tests for git operations
- [x] 5.2 Add integration tests for `versions reset` command in `integration.test.ts`
- [x] 5.3 Test worktree enumeration and filtering
- [x] 5.4 Test uncommitted changes detection
- [x] 5.5 Test successful reset operation
- [x] 5.6 Test error cases (uncommitted changes, not in repo, git command failures)
- [x] 5.7 Run `npm test` and ensure all tests pass

## 6. Code Quality

- [x] 6.1 Run `npm run format` to format all new code
- [x] 6.2 Run `npm run lint` to check for linting errors
- [x] 6.3 Run `npm run spell:check` to verify spelling
- [x] 6.4 Address any formatting, linting, or spelling issues

## 7. Documentation

- [x] 7.1 Add usage examples for `zap versions reset` in code comments
- [x] 7.2 Update CLAUDE.md if needed (likely not necessary for user-facing commands)
