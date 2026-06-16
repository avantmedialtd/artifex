## ADDED Requirements

### Requirement: Read-only inspection surface

The CLI SHALL provide a read-only inspection surface for the resolved repository and the authenticated account. Every command in this surface SHALL be a read (HTTP GET) with no side effects, SHALL support `--json` to emit the raw API response, and SHALL exit `0` on success and `1` on error. These commands SHALL use the same workspace/repository resolution as the rest of `af bitbucket`.

#### Scenario: Commands are read-only

- **WHEN** the user runs any inspection command (`whoami`, `repo`, `branch`, `tag`, `commit`, `src`, `diff`, `pr activity`, `pr status`, `pr reviewers`)
- **THEN** only HTTP GET requests are issued
- **AND** no repository, pull request, or account state is modified

#### Scenario: JSON output is available

- **WHEN** the user adds `--json` to any inspection command
- **THEN** the raw Bitbucket API response is emitted instead of the rendered view

### Requirement: Authenticated identity

The CLI SHALL report the account the configured token authenticates as.

#### Scenario: Show current account

- **WHEN** the user runs `af bitbucket whoami`
- **THEN** the authenticated account's username, display name, and account id are rendered

#### Scenario: Insufficient token scope

- **GIVEN** the token lacks the Account read scope
- **WHEN** the user runs `af bitbucket whoami`
- **THEN** an error explaining the required token scope is printed
- **AND** the exit code is 1

### Requirement: Repository listing

The CLI SHALL list the repositories in the resolved workspace, with optional query, role, and sort controls.

#### Scenario: List workspace repositories

- **WHEN** the user runs `af bitbucket repo list`
- **THEN** the workspace's repositories are listed
- **AND** all pages are fetched and combined before output

#### Scenario: Query, role, and sort filters

- **WHEN** the user runs `af bitbucket repo list --query 'name~"api"' --role contributor --sort -updated_on`
- **THEN** the `q`, `role`, and `sort` query parameters are forwarded to the API

### Requirement: Repository retrieval

The CLI SHALL fetch and render a single repository's metadata for the resolved target.

#### Scenario: Get the resolved repository

- **WHEN** the user runs `af bitbucket repo get`
- **THEN** the repository's name, main branch, privacy, size, and project are rendered

### Requirement: Branch listing and retrieval

The CLI SHALL list branches and fetch a single branch for the resolved repository.

#### Scenario: List branches

- **WHEN** the user runs `af bitbucket branch list`
- **THEN** the repository's branches and their target commits are listed

#### Scenario: Filter and sort branches

- **WHEN** the user runs `af bitbucket branch list --query 'name~"feature"' --sort -target.date`
- **THEN** the `q` and `sort` query parameters are forwarded to the API

#### Scenario: Get a single branch

- **WHEN** the user runs `af bitbucket branch get main`
- **THEN** the `main` branch and its head commit are rendered

### Requirement: Tag listing and retrieval

The CLI SHALL list tags and fetch a single tag for the resolved repository.

#### Scenario: List tags

- **WHEN** the user runs `af bitbucket tag list`
- **THEN** the repository's tags and their target commits are listed

#### Scenario: Get a single tag

- **WHEN** the user runs `af bitbucket tag get v1.2.0`
- **THEN** the `v1.2.0` tag and its target commit are rendered

### Requirement: Commit listing

The CLI SHALL list commits for the resolved repository, optionally scoped to a branch and to an include/exclude revision range, bounded by a limit.

#### Scenario: List recent commits

- **WHEN** the user runs `af bitbucket commit list`
- **THEN** commits reachable from the repository's main branch are listed, newest first

#### Scenario: List commits on a branch

- **WHEN** the user runs `af bitbucket commit list --branch feature/x`
- **THEN** commits reachable from `feature/x` are listed

#### Scenario: Restrict to a revision range

- **WHEN** the user runs `af bitbucket commit list --include feature/x --exclude main`
- **THEN** the `include` and `exclude` parameters are forwarded so only commits on `feature/x` not yet on `main` are listed

#### Scenario: Limit bounds the history fetched

- **WHEN** the user runs `af bitbucket commit list --limit 10`
- **THEN** at most 10 commits are returned
- **AND** pagination stops once the limit is reached

### Requirement: Commit retrieval with diff formats

The CLI SHALL fetch a single commit and, on request, its diff, diffstat, or patch.

#### Scenario: Get a commit

- **WHEN** the user runs `af bitbucket commit get <sha>`
- **THEN** the commit's author, date, and message are rendered

#### Scenario: Commit diff

- **WHEN** the user runs `af bitbucket commit get <sha> --diff`
- **THEN** the commit's raw unified diff is written to stdout

#### Scenario: Commit diffstat

- **WHEN** the user runs `af bitbucket commit get <sha> --diffstat`
- **THEN** the per-file added/removed summary for the commit is rendered

#### Scenario: Commit patch

- **WHEN** the user runs `af bitbucket commit get <sha> --patch`
- **THEN** the commit's mbox-style patch is written to stdout

### Requirement: Source file read

The CLI SHALL read the raw content of a file at a given ref, defaulting to the repository's main branch.

#### Scenario: Read a file at the default ref

- **WHEN** the user runs `af bitbucket src read package.json`
- **THEN** the raw content of `package.json` at the repository's main branch is written to stdout

#### Scenario: Read a file at an explicit ref

- **WHEN** the user runs `af bitbucket src read src/index.ts --ref develop`
- **THEN** the raw content of `src/index.ts` at `develop` is written to stdout

### Requirement: Source directory browse

The CLI SHALL list the entries of a directory at a given ref, defaulting to the repository's main branch and the repository root.

#### Scenario: List the repository root

- **WHEN** the user runs `af bitbucket src ls`
- **THEN** the top-level files and directories at the main branch are listed

#### Scenario: List a subdirectory recursively at a ref

- **WHEN** the user runs `af bitbucket src ls src --ref main --recursive`
- **THEN** the entries under `src` at `main` are listed, descending into subdirectories

### Requirement: Arbitrary revision diff

The CLI SHALL produce a diff or diffstat between arbitrary revisions, expressed as a Bitbucket revspec.

#### Scenario: Diff between two refs

- **WHEN** the user runs `af bitbucket diff main..feature/x`
- **THEN** the raw diff for the `main..feature/x` revspec is written to stdout

#### Scenario: Diffstat between two refs

- **WHEN** the user runs `af bitbucket diff main..feature/x --stat`
- **THEN** the per-file changed summary for the revspec is rendered

### Requirement: Pull request activity feed

The CLI SHALL render the chronological activity feed of a pull request, bounded by a limit.

#### Scenario: Show activity

- **WHEN** the user runs `af bitbucket pr activity 42`
- **THEN** the pull request's approvals, change requests, updates, and comment events are rendered in order

#### Scenario: Limit the feed

- **WHEN** the user runs `af bitbucket pr activity 42 --limit 20`
- **THEN** at most 20 activity entries are returned

### Requirement: Pull request status aggregation

The CLI SHALL render the build/commit statuses attached to a pull request so the gate state is visible.

#### Scenario: Show statuses

- **WHEN** the user runs `af bitbucket pr status 42`
- **THEN** each status's key, state, name, and url are rendered, grouped by commit

#### Scenario: Read-only exit code

- **WHEN** the user runs `af bitbucket pr status 42` and a status is `FAILED`
- **THEN** the failed status is rendered
- **AND** the command still exits `0` (it is informational)

### Requirement: Pull request reviewers

The CLI SHALL render a pull request's reviewers and participants with their approval state, derived from the pull request's participants.

#### Scenario: Show reviewers

- **WHEN** the user runs `af bitbucket pr reviewers 42`
- **THEN** each reviewer/participant is rendered with their role and approval state

#### Scenario: Show only pending reviewers

- **WHEN** the user runs `af bitbucket pr reviewers 42 --pending`
- **THEN** only participants who have not approved are rendered
