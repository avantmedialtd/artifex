# bitbucket-command Specification

## Purpose
TBD - created by archiving change add-bitbucket-support. Update Purpose after archive.
## Requirements
### Requirement: Bitbucket-specific credentials

The Bitbucket command SHALL authenticate using Bitbucket-specific environment variables, separate from the Jira/Confluence credentials, because Atlassian API tokens scoped for Jira/Confluence are not accepted by Bitbucket Cloud.

#### Scenario: Configuration with BITBUCKET variables

- **GIVEN** environment has `BITBUCKET_USERNAME` and `BITBUCKET_API_TOKEN`
- **WHEN** any bitbucket subcommand makes an API call
- **THEN** the request uses Basic auth with `BITBUCKET_USERNAME:BITBUCKET_API_TOKEN`

#### Scenario: Username falls back to email

- **GIVEN** `BITBUCKET_USERNAME` is unset
- **AND** `ATLASSIAN_EMAIL` (or `JIRA_EMAIL` as legacy fallback) is set
- **AND** `BITBUCKET_API_TOKEN` is set
- **WHEN** any bitbucket subcommand makes an API call
- **THEN** the request uses Basic auth with the email as the username

#### Scenario: Legacy BITBUCKET_APP_PASSWORD alias

- **GIVEN** `BITBUCKET_API_TOKEN` is unset
- **AND** `BITBUCKET_APP_PASSWORD` is set
- **WHEN** any bitbucket subcommand makes an API call
- **THEN** the request uses `BITBUCKET_APP_PASSWORD` as the token

#### Scenario: Missing credentials error

- **GIVEN** neither `BITBUCKET_API_TOKEN` nor `BITBUCKET_APP_PASSWORD` are set
- **WHEN** a bitbucket subcommand attempts an API call
- **THEN** an error names both env vars
- **AND** the error explains that Bitbucket Cloud requires a credential separate from Jira/Confluence
- **AND** the error references the workspace API token / app password generation pages

### Requirement: Bitbucket command with alias

The CLI SHALL provide an `af bitbucket` command for interacting with Bitbucket Cloud, with `af bb` accepted as an alias.

#### Scenario: Full command name routes to handler

- **WHEN** the user runs `af bitbucket pr list`
- **THEN** the bitbucket handler is invoked with subcommand `pr` and `list`

#### Scenario: Short alias routes to handler

- **WHEN** the user runs `af bb pr list`
- **THEN** the bitbucket handler is invoked with the same arguments as `af bitbucket pr list`

#### Scenario: No subcommand prints help

- **WHEN** the user runs `af bitbucket` with no further arguments
- **THEN** the bitbucket subcommand help is printed
- **AND** the exit code is 0

### Requirement: Workspace and repository resolution

The CLI SHALL resolve the target workspace and repository from explicit flags, configuration, or the local git remote, in that order.

#### Scenario: Explicit flags take precedence

- **GIVEN** the user runs a bitbucket subcommand with `--workspace W --repo R`
- **WHEN** any other source would resolve to different values
- **THEN** the values from `--workspace` and `--repo` are used

#### Scenario: Configuration provides defaults

- **GIVEN** `af.json` contains `bitbucket.workspace = "W"` and `bitbucket.repo = "R"`
- **AND** no `--workspace` or `--repo` flag is supplied
- **WHEN** a bitbucket subcommand runs
- **THEN** workspace `W` and repo `R` are used

#### Scenario: Git remote inference

- **GIVEN** no flags or configuration are present
- **AND** `git remote get-url origin` returns a URL whose hostname is `bitbucket.org` and path is `W/R` (or `W/R.git`)
- **WHEN** a bitbucket subcommand runs
- **THEN** workspace `W` and repo `R` are used

#### Scenario: Resolution failure

- **GIVEN** no flags, no configuration, and the git remote does not point at `bitbucket.org`
- **WHEN** a bitbucket subcommand that requires a workspace/repo runs
- **THEN** an error is printed naming all three resolution sources
- **AND** the exit code is 1

### Requirement: Pull request listing

The CLI SHALL list pull requests for the resolved repository, with optional state and author filters.

#### Scenario: Default lists open pull requests

- **WHEN** the user runs `af bitbucket pr list`
- **THEN** only pull requests with state `OPEN` are returned

#### Scenario: State filter

- **WHEN** the user runs `af bitbucket pr list --state MERGED`
- **THEN** only pull requests with state `MERGED` are returned

#### Scenario: All states

- **WHEN** the user runs `af bitbucket pr list --state ALL`
- **THEN** pull requests in any state are returned

#### Scenario: Mine filter

- **WHEN** the user runs `af bitbucket pr list --mine`
- **THEN** only pull requests authored by the authenticated user are returned

#### Scenario: Pagination is automatic

- **GIVEN** the result set spans multiple API pages
- **WHEN** the user runs `af bitbucket pr list`
- **THEN** all pages are fetched and combined before output

### Requirement: Pull request retrieval

The CLI SHALL fetch a single pull request by id.

#### Scenario: Get by id

- **WHEN** the user runs `af bitbucket pr get 42`
- **THEN** the pull request with id `42` is fetched and rendered

#### Scenario: Not found

- **WHEN** the user runs `af bitbucket pr get` with a non-existent id
- **THEN** an error is printed
- **AND** the exit code is 1

### Requirement: Pull request creation

The CLI SHALL create a pull request, with sensible defaults for source and target branches. The source branch MAY be supplied via `--from`, `--source`, or `--src` (all equivalent). The target branch MAY be supplied via `--to`, `--destination`, or `--dest` (all equivalent). When multiple equivalent flags are supplied in the same invocation, the value occurring later on the command line SHALL be used.

#### Scenario: Default source branch is current branch

- **GIVEN** the working directory is on branch `feature/x`
- **AND** no `--from` flag is supplied
- **WHEN** the user runs `af bitbucket pr create --title T`
- **THEN** the source branch in the request body is `feature/x`

#### Scenario: Default target is repository main branch

- **GIVEN** no `--to` flag is supplied
- **AND** the repository's main branch is `main`
- **WHEN** the user runs `af bitbucket pr create --title T`
- **THEN** the destination branch in the request body is `main`

#### Scenario: Description from inline flag

- **WHEN** the user runs `af bitbucket pr create --title T --description "Body"`
- **THEN** the request body's description field is `Body`

#### Scenario: Description from file

- **WHEN** the user runs `af bitbucket pr create --title T --description-file ./body.md`
- **THEN** the request body's description field is the contents of `body.md`

#### Scenario: Reviewers by account id

- **WHEN** the user runs `af bitbucket pr create --title T --reviewers a1,a2`
- **THEN** the request body's `reviewers` field is `[{account_id: "a1"}, {account_id: "a2"}]`

#### Scenario: Draft pull request

- **WHEN** the user runs `af bitbucket pr create --title T --draft`
- **THEN** the request body's `draft` field is `true`

#### Scenario: Source branch via `--source` alias

- **WHEN** the user runs `af bitbucket pr create --title T --source feature/x`
- **THEN** the source branch in the request body is `feature/x`

#### Scenario: Source branch via `--src` alias

- **WHEN** the user runs `af bitbucket pr create --title T --src feature/x`
- **THEN** the source branch in the request body is `feature/x`

#### Scenario: Destination branch via `--destination` alias

- **WHEN** the user runs `af bitbucket pr create --title T --destination develop`
- **THEN** the destination branch in the request body is `develop`

#### Scenario: Destination branch via `--dest` alias

- **WHEN** the user runs `af bitbucket pr create --title T --dest develop`
- **THEN** the destination branch in the request body is `develop`

#### Scenario: Later flag wins when canonical and alias conflict

- **WHEN** the user runs `af bitbucket pr create --title T --to main --dest develop`
- **THEN** the destination branch in the request body is `develop`

#### Scenario: Earlier flag is overridden by later canonical flag

- **WHEN** the user runs `af bitbucket pr create --title T --src feature/a --from feature/b`
- **THEN** the source branch in the request body is `feature/b`

### Requirement: Pull request update

The CLI SHALL update title, description, and reviewers on an existing pull request.

#### Scenario: Update title

- **WHEN** the user runs `af bitbucket pr update 42 --title "New title"`
- **THEN** a PUT request is made with the new title and the existing description and reviewers preserved

#### Scenario: Update description from file

- **WHEN** the user runs `af bitbucket pr update 42 --description-file ./body.md`
- **THEN** a PUT request is made with the new description from the file

### Requirement: Pull request lifecycle actions

The CLI SHALL provide approve, unapprove, request-changes, merge, and decline operations on a pull request.

#### Scenario: Approve

- **WHEN** the user runs `af bitbucket pr approve 42`
- **THEN** a POST request is made to the approve endpoint of pull request 42

#### Scenario: Unapprove

- **WHEN** the user runs `af bitbucket pr unapprove 42`
- **THEN** a DELETE request is made to the approve endpoint of pull request 42

#### Scenario: Request changes

- **WHEN** the user runs `af bitbucket pr request-changes 42`
- **THEN** a POST request is made to the request-changes endpoint of pull request 42

#### Scenario: Merge with strategy

- **WHEN** the user runs `af bitbucket pr merge 42 --strategy squash`
- **THEN** a POST request is made to the merge endpoint with `merge_strategy = "squash"`

#### Scenario: Merge closes source branch

- **WHEN** the user runs `af bitbucket pr merge 42 --close-source`
- **THEN** the merge body includes `close_source_branch = true`

#### Scenario: Decline

- **WHEN** the user runs `af bitbucket pr decline 42`
- **THEN** a POST request is made to the decline endpoint of pull request 42

### Requirement: Pull request diff

The CLI SHALL fetch and print the unified diff of a pull request.

#### Scenario: Diff to stdout

- **WHEN** the user runs `af bitbucket pr diff 42`
- **THEN** the unified diff is printed to stdout as plain text

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

### Requirement: Pull request comment creation

The CLI SHALL create general, inline, and reply comments on a pull request through one `add` subcommand whose body shape is determined by flags.

#### Scenario: General comment from inline body

- **WHEN** the user runs `af bitbucket pr comment add 42 --body "looks good"`
- **THEN** a POST is made with body `{content: {raw: "looks good"}}`

#### Scenario: General comment from file

- **WHEN** the user runs `af bitbucket pr comment add 42 --body-file ./note.md`
- **THEN** a POST is made with body `{content: {raw: <file contents>}}`

#### Scenario: Inline comment

- **WHEN** the user runs `af bitbucket pr comment add 42 --body "see here" --file src/foo.ts --line 10`
- **THEN** a POST is made with body `{content: {raw: "see here"}, inline: {path: "src/foo.ts", to: 10}}`

#### Scenario: Reply comment

- **WHEN** the user runs `af bitbucket pr comment add 42 --body "agreed" --reply-to 100`
- **THEN** a POST is made with body `{content: {raw: "agreed"}, parent: {id: 100}}`

#### Scenario: Inline reply comment

- **WHEN** the user runs `af bitbucket pr comment add 42 --body "+1" --reply-to 100 --file src/foo.ts --line 10`
- **THEN** a POST is made with body containing both `parent` and `inline` fields

#### Scenario: Body and body-file are mutually exclusive

- **WHEN** the user runs `af bitbucket pr comment add 42 --body "x" --body-file ./y.md`
- **THEN** an error is printed naming the conflict
- **AND** the exit code is 1

### Requirement: Pull request comment update and deletion

The CLI SHALL update and delete pull request comments by id.

#### Scenario: Update comment body

- **WHEN** the user runs `af bitbucket pr comment update 42 100 --body "revised"`
- **THEN** a PUT request is made to the comment 100 endpoint with `{content: {raw: "revised"}}`

#### Scenario: Delete comment

- **WHEN** the user runs `af bitbucket pr comment delete 42 100`
- **THEN** a DELETE request is made to the comment 100 endpoint

### Requirement: Pull request task listing

The CLI SHALL list pull request tasks across all pages.

#### Scenario: List tasks

- **WHEN** the user runs `af bitbucket pr task list 42`
- **THEN** all tasks on pull request 42 are fetched across all pages and rendered with their resolved/unresolved state

### Requirement: Pull request task creation

The CLI SHALL create pull request tasks, optionally linked to an existing comment.

#### Scenario: Standalone task

- **WHEN** the user runs `af bitbucket pr task add 42 --body "rename this"`
- **THEN** a POST is made to the tasks endpoint with `{content: {raw: "rename this"}}`

#### Scenario: Task linked to a comment

- **GIVEN** the body shape for linking a task to a comment has been verified during implementation
- **WHEN** the user runs `af bitbucket pr task add 42 --body "rename this" --on-comment 100`
- **THEN** a POST is made to the tasks endpoint with the verified body shape including a reference to comment 100

### Requirement: Pull request task update and resolution

The CLI SHALL update task content and toggle resolved/unresolved state.

#### Scenario: Update task body

- **WHEN** the user runs `af bitbucket pr task update 42 7 --body "actually rename to bar"`
- **THEN** a PUT is made to the task 7 endpoint with `{content: {raw: "actually rename to bar"}}`

#### Scenario: Resolve task

- **GIVEN** the resolve body shape has been verified during implementation
- **WHEN** the user runs `af bitbucket pr task update 42 7 --resolved`
- **THEN** a PUT is made to the task 7 endpoint with the verified state field set to the resolved value

#### Scenario: Unresolve task

- **GIVEN** the resolve body shape has been verified during implementation
- **WHEN** the user runs `af bitbucket pr task update 42 7 --unresolved`
- **THEN** a PUT is made to the task 7 endpoint with the verified state field set to the unresolved value

#### Scenario: Resolved and unresolved are mutually exclusive

- **WHEN** the user runs `af bitbucket pr task update 42 7 --resolved --unresolved`
- **THEN** an error is printed naming the conflict
- **AND** the exit code is 1

### Requirement: Pull request task deletion

The CLI SHALL delete pull request tasks by id.

#### Scenario: Delete task

- **WHEN** the user runs `af bitbucket pr task delete 42 7`
- **THEN** a DELETE request is made to the task 7 endpoint

### Requirement: Pipeline listing

The CLI SHALL list pipelines for the resolved repository, with optional branch and status filters.

#### Scenario: List most recent pipelines

- **WHEN** the user runs `af bitbucket pipeline list`
- **THEN** pipelines are returned sorted by `created_on` descending

#### Scenario: Branch filter

- **WHEN** the user runs `af bitbucket pipeline list --branch main`
- **THEN** only pipelines triggered on branch `main` are returned

#### Scenario: Status filter

- **WHEN** the user runs `af bitbucket pipeline list --status FAILED`
- **THEN** only failed pipelines are returned

### Requirement: Pipeline retrieval

The CLI SHALL fetch a single pipeline by uuid or build number.

#### Scenario: Get by uuid

- **WHEN** the user runs `af bitbucket pipeline get {uuid}`
- **THEN** the pipeline with that uuid is fetched and rendered

#### Scenario: Get by build number

- **WHEN** the user runs `af bitbucket pipeline get 1234`
- **THEN** the pipeline with build number `1234` is fetched and rendered

### Requirement: Pipeline triggering

The CLI SHALL trigger a new pipeline run targeting a branch, commit, or custom pipeline definition, with optional variables.

#### Scenario: Trigger on branch

- **WHEN** the user runs `af bitbucket pipeline trigger --branch main`
- **THEN** a POST is made with `target.ref_type = "branch"` and `target.ref_name = "main"`

#### Scenario: Trigger on commit

- **WHEN** the user runs `af bitbucket pipeline trigger --commit abcd1234`
- **THEN** a POST is made with `target.commit.hash = "abcd1234"`

#### Scenario: Trigger custom pipeline

- **WHEN** the user runs `af bitbucket pipeline trigger --branch main --custom nightly`
- **THEN** a POST is made with `target.selector.type = "custom"` and `target.selector.pattern = "nightly"`

#### Scenario: Trigger with variables

- **WHEN** the user runs `af bitbucket pipeline trigger --branch main --var FOO=bar --var BAZ=qux`
- **THEN** the request body includes a `variables` array with both `FOO=bar` and `BAZ=qux`

### Requirement: Pipeline stop

The CLI SHALL stop a running pipeline.

#### Scenario: Stop pipeline

- **WHEN** the user runs `af bitbucket pipeline stop {uuid}`
- **THEN** a POST is made to the `/pipelines/{uuid}/stopPipeline` endpoint

### Requirement: Pipeline step listing

The CLI SHALL list the steps of a pipeline.

#### Scenario: List steps

- **WHEN** the user runs `af bitbucket pipeline steps {uuid}`
- **THEN** all steps of the pipeline are fetched and rendered with their state and durations

### Requirement: Pipeline step logs

The CLI SHALL fetch step logs as plain text in one-shot mode and stream them via polling in follow mode.

#### Scenario: One-shot log

- **WHEN** the user runs `af bitbucket pipeline logs {uuid} {step-uuid}`
- **THEN** the full step log is fetched once and printed to stdout as plain text

#### Scenario: Follow mode polls until terminal

- **WHEN** the user runs `af bitbucket pipeline logs {uuid} {step-uuid} --follow`
- **THEN** the step log is fetched repeatedly, with each fetch emitting only the bytes that are new since the previous fetch
- **AND** polling stops once the step's status is one of `SUCCESSFUL`, `FAILED`, `STOPPED`, or `ERROR`

### Requirement: Member account-id lookup

The CLI SHALL provide a `members` subcommand that returns workspace members and their account ids, with optional query filtering.

#### Scenario: List all workspace members

- **WHEN** the user runs `af bitbucket members`
- **THEN** workspace members are listed with their display name and account id

#### Scenario: Query by name

- **WHEN** the user runs `af bitbucket members --query alice`
- **THEN** only workspace members whose display name or username matches the query are listed

### Requirement: JSON output mode

Every bitbucket subcommand that produces structured output SHALL support a `--json` flag that emits the raw API response.

#### Scenario: List in JSON mode

- **WHEN** the user runs `af bitbucket pr list --json`
- **THEN** the output is a JSON array containing every pull request from every page
- **AND** no human-formatted text is mixed into stdout

#### Scenario: Get in JSON mode

- **WHEN** the user runs `af bitbucket pr get 42 --json`
- **THEN** the output is the single JSON object returned by the API

#### Scenario: Errors still go to stderr in JSON mode

- **WHEN** a bitbucket subcommand with `--json` fails
- **THEN** the error message is printed to stderr
- **AND** stdout contains no partial or invalid JSON
- **AND** the exit code is 1

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

