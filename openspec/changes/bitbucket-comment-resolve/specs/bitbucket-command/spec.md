## MODIFIED Requirements

### Requirement: Pull request comment listing and retrieval

The CLI SHALL list and fetch pull request comments, including general, inline, and reply comments. When a comment carries resolution information, the CLI SHALL render its resolution state (resolved or open) alongside the comment.

#### Scenario: List all comments

- **WHEN** the user runs `af bitbucket pr comment list 42`
- **THEN** all comments on pull request 42 are fetched across all pages and rendered

#### Scenario: Get single comment

- **WHEN** the user runs `af bitbucket pr comment get 42 100`
- **THEN** comment 100 on pull request 42 is fetched and rendered

#### Scenario: Resolution state is shown for resolved threads

- **GIVEN** the comment resolution response shape has been verified during implementation
- **WHEN** the user lists or gets a comment whose thread has been resolved
- **THEN** the rendered output marks the comment as resolved, including who resolved it and when when that information is present

#### Scenario: Open threads are distinguishable from resolved threads

- **WHEN** the user lists comments containing both resolved and unresolved threads
- **THEN** the rendered output visually distinguishes resolved comments from open ones

## ADDED Requirements

### Requirement: Pull request comment resolution

The CLI SHALL resolve and reopen pull request comment threads by id through dedicated `comment resolve` and `comment reopen` subcommands. Both subcommands SHALL support `--json` to emit the raw API response.

#### Scenario: Resolve a comment thread

- **GIVEN** the comment resolution endpoint and request shape have been verified during implementation
- **WHEN** the user runs `af bitbucket pr comment resolve 42 100`
- **THEN** a request is made to the verified resolve endpoint for comment 100 on pull request 42
- **AND** the comment is reported as resolved

#### Scenario: Reopen a resolved comment thread

- **GIVEN** the comment resolution endpoint and request shape have been verified during implementation
- **WHEN** the user runs `af bitbucket pr comment reopen 42 100`
- **THEN** a request is made to the verified reopen endpoint for comment 100 on pull request 42
- **AND** the comment is reported as open/unresolved

#### Scenario: Raw JSON output for resolution

- **WHEN** the user runs `af bitbucket pr comment resolve 42 100 --json`
- **THEN** the raw API response is emitted as JSON

#### Scenario: Resolution requires a comment id

- **WHEN** the user runs `af bitbucket pr comment resolve 42` without a comment id
- **THEN** an error is printed naming the missing argument
- **AND** the exit code is 1
