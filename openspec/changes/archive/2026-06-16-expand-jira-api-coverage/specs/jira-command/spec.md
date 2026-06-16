## MODIFIED Requirements

### Requirement: Jira workflow operations

The CLI SHALL support workflow transition operations, including transitions that present a screen. `af jira transition` SHALL accept `--resolution <name>`, `--comment <text>`, and repeatable `--field <name>=<value>`, and SHALL send those in the `fields` and `update` properties of `POST /rest/api/3/issue/{key}/transitions` alongside the transition id. A comment SHALL be sent as ADF in `update.comment`. A given field SHALL appear in either `fields` or `update`, never both. `af jira transitions` SHALL support screen discovery via `?expand=transitions.fields`, reporting for each transition whether it has a screen and which fields are required. The CLI SHALL NOT leave an issue resolved without a resolution when the target transition has a resolution screen.

#### Scenario: List available transitions

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira transitions PROJ-123`
- **THEN** available status transitions are displayed

#### Scenario: Transition issue status

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira transition PROJ-123 --to "In Progress"`
- **THEN** the issue status is changed

#### Scenario: Transition with resolution sets the Resolution field

- **GIVEN** valid Jira credentials in environment
- **AND** the `Done` transition on `PROJ-123` presents a resolution screen
- **WHEN** the user runs `af jira transition PROJ-123 --to Done --resolution "Fixed"`
- **THEN** the transition request includes the resolution in its `fields`
- **AND** the issue ends up in `Done` with the Resolution set to `Fixed`

#### Scenario: Comment supplied on transition

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira transition PROJ-123 --to "In Review" --comment "Ready for QA"`
- **THEN** the transition request carries the comment as ADF under `update.comment`

#### Scenario: Discover that a transition requires a screen

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira transitions PROJ-123`
- **THEN** the output marks transitions that present a screen
- **AND** lists the fields each screened transition requires

## ADDED Requirements

### Requirement: Jira issue move across project or type

The CLI SHALL provide `af jira move <key> --to-project <key> [--type <name>]` that moves an issue to a different project and/or issue type using the asynchronous bulk move endpoint `POST /rest/api/3/bulk/issues/move`. The CLI SHALL poll `GET /rest/api/3/bulk/queue/{taskId}` until the task reaches a terminal state and SHALL report success or the raw task status. The CLI SHALL set or auto-suggest the target status mapping (e.g. `inferStatusDefaults`) rather than require the user to hand-build it.

#### Scenario: Move an issue to another project

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira move PROJ-123 --to-project NEWPROJ --type Story`
- **THEN** the CLI submits a bulk move request and receives a task id
- **AND** polls the task until it completes
- **AND** reports that the issue now lives in `NEWPROJ` as a `Story`

#### Scenario: Cross-workflow move infers status defaults

- **GIVEN** the source and target projects use different workflows
- **WHEN** the user runs `af jira move PROJ-123 --to-project NEWPROJ`
- **THEN** the move request sets `inferStatusDefaults` (or an explicit status mapping)
- **AND** the issue lands in a valid status in the target workflow

### Requirement: Jira worklog operations

The CLI SHALL support worklog management via `af jira worklog add/list/update/delete`. `add` SHALL accept time spent and an optional comment rendered as ADF. `list` SHALL display existing worklogs for an issue. `update` and `delete` SHALL operate on an individual worklog by id.

#### Scenario: Add a worklog with a comment

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira worklog add PROJ-123 --time 2h --comment "Investigated root cause"`
- **THEN** a worklog of 2h is recorded on the issue
- **AND** the comment is stored as ADF

#### Scenario: List worklogs

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira worklog list PROJ-123`
- **THEN** the issue's worklogs are displayed

#### Scenario: Delete a worklog

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira worklog delete PROJ-123 <worklog-id>`
- **THEN** the identified worklog is removed from the issue

### Requirement: Jira comment editing and deletion

The CLI SHALL extend comment operations beyond add and list to include `af jira comment edit` and `af jira comment delete`, and SHALL accept a `--visibility <role-or-group>` option when adding or editing a comment to restrict who can see it. Editing SHALL replace the comment body (rendered as ADF). Deleting SHALL remove the comment by id.

#### Scenario: Edit a comment body

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment edit PROJ-123 <comment-id> --body "Updated text"`
- **THEN** the comment body is replaced with the new ADF content

#### Scenario: Delete a comment

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment delete PROJ-123 <comment-id>`
- **THEN** the identified comment is removed from the issue

#### Scenario: Add a restricted-visibility comment

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment PROJ-123 --add "Internal note" --visibility "Administrators"`
- **THEN** the comment is created restricted to the `Administrators` role

### Requirement: Jira issue reparenting

The CLI SHALL allow setting an issue's parent via `af jira update <key> --parent <parent-key>`, sending `{ fields: { parent: { key } } }` to `PUT /rest/api/3/issue/{key}`. The CLI SHALL also offer `--clear-parent` to detach a parent; this clearing behavior SHALL be treated as provisional until empirically verified across project types.

#### Scenario: Set an issue's parent

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira update PROJ-123 --parent PROJ-5`
- **THEN** the update request sets `fields.parent.key` to `PROJ-5`
- **AND** `PROJ-123` becomes a child of `PROJ-5`

#### Scenario: Clear an issue's parent

- **GIVEN** valid Jira credentials in environment
- **AND** `PROJ-123` currently has a parent
- **WHEN** the user runs `af jira update PROJ-123 --clear-parent`
- **THEN** the CLI attempts to detach the parent
- **AND** treats the operation as provisional given the undocumented clearing behavior

### Requirement: Jira bulk operations over JQL

The CLI SHALL provide `af jira bulk <edit|transition|delete> --jql "<query>"` that selects issues by JQL and applies the operation through the asynchronous bulk endpoints, reusing the task-poller. The CLI SHALL respect the bulk limits (max 1,000 issues per request; at most 5 concurrent tasks) by chunking and serializing large selections. Bulk transition SHALL only perform transitions that require no field input, and SHALL refuse field-requiring transitions with a clear error.

#### Scenario: Bulk transition over a JQL selection

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira bulk transition --jql "project = PROJ AND status = 'To Do'" --to "In Progress"`
- **THEN** the CLI submits a bulk transition task for the matching issues
- **AND** polls the task until it completes

#### Scenario: Large selection is chunked and serialized

- **GIVEN** a JQL query matching more than 1,000 issues
- **WHEN** the user runs `af jira bulk delete --jql "<query>"`
- **THEN** the CLI splits the selection into chunks of at most 1,000 issues
- **AND** runs no more than the allowed number of concurrent bulk tasks

#### Scenario: Bulk transition refuses a field-requiring transition

- **GIVEN** the target transition presents a screen requiring fields
- **WHEN** the user runs `af jira bulk transition --jql "<query>" --to Done`
- **THEN** the CLI refuses the operation with an error
- **AND** directs the user to the single-issue `af jira transition` command

### Requirement: Jira edit metadata discovery

The CLI SHALL provide `af jira editmeta <key>` that reports the fields editable on an issue and their allowed values, paralleling the existing createmeta-backed `af jira fields`. This makes `af jira update` field-aware before a mutation is attempted.

#### Scenario: Report editable fields for an issue

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira editmeta PROJ-123`
- **THEN** the output lists the fields that can be edited on the issue
- **AND** shows allowed values for fields that constrain them

### Requirement: Jira backlog ranking

The CLI SHALL provide `af jira rank <key> --above <key2>` and `af jira rank <key> --below <key2>` that reorder issues in the backlog via `PUT /rest/agile/1.0/issue/rank` on the Agile API. The CLI SHALL respect the Agile rank limit of 50 issues per request.

#### Scenario: Rank an issue above another

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira rank PROJ-123 --above PROJ-99`
- **THEN** the rank request places `PROJ-123` before `PROJ-99`

#### Scenario: Rank an issue below another

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira rank PROJ-123 --below PROJ-99`
- **THEN** the rank request places `PROJ-123` after `PROJ-99`

### Requirement: Jira sprint and board operations

The CLI SHALL provide Agile-native sprint and board operations: `af jira sprint add <key> --sprint <id>` to move an issue into an open or active sprint, `af jira sprint remove <key>` to move an issue back to the backlog, `af jira boards` to list boards, and `af jira sprints --board <id>` to list a board's sprints. These SHALL use the `/rest/agile/1.0` endpoints and SHALL coordinate with the `pm` skill rather than duplicate its planning logic.

#### Scenario: Move an issue into a sprint

- **GIVEN** valid Jira credentials in environment
- **AND** sprint `42` is open or active
- **WHEN** the user runs `af jira sprint add PROJ-123 --sprint 42`
- **THEN** the issue is added to sprint `42`

#### Scenario: Move an issue to the backlog

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira sprint remove PROJ-123`
- **THEN** the issue is moved to the backlog

#### Scenario: List boards

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira boards`
- **THEN** the available boards are displayed

#### Scenario: List sprints for a board

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira sprints --board 7`
- **THEN** the sprints belonging to board `7` are displayed

### Requirement: Jira watchers and votes

The CLI SHALL provide `af jira watch <key>` and `af jira unwatch <key>` to add and remove the current user as a watcher, and `af jira vote <key>` to vote on an issue, using the `/rest/api/3` watchers and votes endpoints.

#### Scenario: Watch an issue

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira watch PROJ-123`
- **THEN** the current user is added as a watcher of the issue

#### Scenario: Unwatch an issue

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira unwatch PROJ-123`
- **THEN** the current user is removed from the issue's watchers

#### Scenario: Vote on an issue

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira vote PROJ-123`
- **THEN** the current user's vote is recorded on the issue
