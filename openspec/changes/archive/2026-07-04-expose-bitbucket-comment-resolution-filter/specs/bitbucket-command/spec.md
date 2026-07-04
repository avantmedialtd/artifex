## MODIFIED Requirements

### Requirement: Pull request comment listing and retrieval

The CLI SHALL list and fetch pull request comments, including general, inline, and reply comments. When a comment carries resolution information, the CLI SHALL render its resolution state (resolved or open) alongside the comment. The `comment list` subcommand SHALL accept optional `--resolved` and `--unresolved` flags that filter the listing by thread resolution state. Because resolution is a property of a comment thread (carried on the thread's top-level comment), filtering SHALL operate on whole threads by their root: a thread is included only when its root comment's resolution state matches the requested filter, and when included the thread's replies SHALL be retained. The filter SHALL be applied before rendering so that `--json` emits the filtered set. The `--resolved` and `--unresolved` flags SHALL be mutually exclusive.

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

#### Scenario: Filter to resolved threads

- **GIVEN** pull request 42 has both resolved and unresolved comment threads, each with replies
- **WHEN** the user runs `af bitbucket pr comment list 42 --resolved`
- **THEN** only threads whose root comment is resolved are rendered
- **AND** the replies belonging to each retained resolved thread are also rendered

#### Scenario: Filter to unresolved threads

- **GIVEN** pull request 42 has both resolved and unresolved comment threads, each with replies
- **WHEN** the user runs `af bitbucket pr comment list 42 --unresolved`
- **THEN** only threads whose root comment is open (no resolution) are rendered
- **AND** the replies belonging to each retained open thread are also rendered

#### Scenario: Filter applies to JSON output

- **WHEN** the user runs `af bitbucket pr comment list 42 --unresolved --json`
- **THEN** the emitted JSON array contains only the comments belonging to unresolved threads

#### Scenario: Resolved and unresolved filters are mutually exclusive

- **WHEN** the user runs `af bitbucket pr comment list 42 --resolved --unresolved`
- **THEN** an error is printed naming the conflict
- **AND** the exit code is 1

### Requirement: Pull request task listing

The CLI SHALL list pull request tasks across all pages. The `task list` subcommand SHALL accept optional `--resolved` and `--unresolved` flags that filter the listing by task state. The filter SHALL be applied before rendering so that `--json` emits the filtered set. The `--resolved` and `--unresolved` flags SHALL be mutually exclusive.

#### Scenario: List tasks

- **WHEN** the user runs `af bitbucket pr task list 42`
- **THEN** all tasks on pull request 42 are fetched across all pages and rendered with their resolved/unresolved state

#### Scenario: Filter to resolved tasks

- **GIVEN** pull request 42 has both resolved and unresolved tasks
- **WHEN** the user runs `af bitbucket pr task list 42 --resolved`
- **THEN** only tasks whose state is resolved are rendered

#### Scenario: Filter to unresolved tasks

- **GIVEN** pull request 42 has both resolved and unresolved tasks
- **WHEN** the user runs `af bitbucket pr task list 42 --unresolved`
- **THEN** only tasks whose state is unresolved are rendered

#### Scenario: Task list filter applies to JSON output

- **WHEN** the user runs `af bitbucket pr task list 42 --resolved --json`
- **THEN** the emitted JSON array contains only tasks whose state is resolved

#### Scenario: Resolved and unresolved task filters are mutually exclusive

- **WHEN** the user runs `af bitbucket pr task list 42 --resolved --unresolved`
- **THEN** an error is printed naming the conflict
- **AND** the exit code is 1
