## ADDED Requirements

### Requirement: Authored pull requests across workspaces

The CLI SHALL list the pull requests authored by the authenticated account across every workspace the account belongs to, without requiring a resolved repository. The command SHALL issue only HTTP GET requests, SHALL support `--json`, and SHALL NOT use the removed `GET /2.0/pullrequests/{selected_user}` endpoint.

#### Scenario: Default lists my open pull requests in every workspace

- **GIVEN** the authenticated account belongs to workspaces `W1` and `W2`
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** the authenticated account is resolved via `GET /user`
- **AND** the workspaces are discovered via `GET /user/workspaces`
- **AND** `GET /workspaces/{ws}/pullrequests/{account}` is requested for both `W1` and `W2` with `state=OPEN`
- **AND** only pull requests authored by the authenticated account are listed

#### Scenario: Works outside a Bitbucket checkout

- **GIVEN** the current directory has no `af.json` Bitbucket configuration and no bitbucket.org origin remote
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** no workspace/repository resolution error is printed
- **AND** the pull requests are listed

#### Scenario: Configuration and git remote do not narrow the search

- **GIVEN** `af.json` contains `bitbucket.workspace = "W1"` and the account also belongs to `W2`
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** pull requests from both `W1` and `W2` are listed

#### Scenario: Explicit workspace narrows the search

- **WHEN** the user runs `af bitbucket pr mine --workspace W1`
- **THEN** `GET /user/workspaces` is not requested
- **AND** only pull requests from workspace `W1` are listed

#### Scenario: State filter

- **WHEN** the user runs `af bitbucket pr mine --state MERGED`
- **THEN** each workspace request carries `state=MERGED`
- **AND** only merged pull requests are listed

#### Scenario: All states

- **WHEN** the user runs `af bitbucket pr mine --state ALL`
- **THEN** each workspace request carries a `state` parameter for each of `OPEN`, `MERGED`, `DECLINED`, and `SUPERSEDED`

#### Scenario: Invalid state

- **WHEN** the user runs `af bitbucket pr mine --state BOGUS`
- **THEN** an error naming the invalid state is printed
- **AND** no API request is made
- **AND** the exit code is 1

#### Scenario: Results are merged newest first

- **GIVEN** pull requests are returned from more than one workspace
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** the combined list is ordered by `updated_on`, most recent first

#### Scenario: Output identifies the repository

- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** each row shows the destination repository's full name (`workspace/repo`) alongside the pull request id, state, title, branches, and updated time

#### Scenario: Limit bounds the results fetched

- **WHEN** the user runs `af bitbucket pr mine --limit 10`
- **THEN** at most 10 pull requests are listed
- **AND** they are the 10 most recently updated across all searched workspaces
- **AND** pagination in each workspace stops once that workspace has yielded 10 pull requests

#### Scenario: Invalid limit

- **WHEN** the user runs `af bitbucket pr mine --limit 0`
- **THEN** an error stating that `--limit` must be a positive integer is printed
- **AND** the exit code is 1

#### Scenario: Pagination is automatic without a limit

- **GIVEN** a workspace's result set spans multiple API pages
- **WHEN** the user runs `af bitbucket pr mine` without `--limit`
- **THEN** all pages are fetched and combined before output

#### Scenario: Inaccessible workspace is skipped with a warning

- **GIVEN** the account belongs to workspaces `W1` and `W2`
- **AND** the request for `W2` fails with HTTP 403 or 404
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** a warning naming `W2` is printed to stderr
- **AND** the pull requests from `W1` are still listed
- **AND** the exit code is 0

#### Scenario: Other errors fail the command

- **GIVEN** a workspace request fails with an error other than HTTP 403 or 404
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** the error is printed to stderr
- **AND** the exit code is 1

#### Scenario: Insufficient token scope

- **GIVEN** the token lacks the Account read scope
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** an error explaining the required token scope is printed
- **AND** the exit code is 1

#### Scenario: No pull requests

- **GIVEN** the authenticated account has no pull requests in the requested state
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** a "no pull requests" message is rendered
- **AND** the exit code is 0

#### Scenario: JSON output

- **WHEN** the user runs `af bitbucket pr mine --json`
- **THEN** the output is a single JSON array of the raw pull request objects from every searched workspace, merged newest first
- **AND** workspace warnings, if any, go to stderr only
- **AND** no human-formatted text is mixed into stdout

## MODIFIED Requirements

### Requirement: Pull request listing

The CLI SHALL list pull requests for the resolved repository, with optional state and author filters. Because Bitbucket returns only open pull requests when no `state` parameter is sent, every state filter SHALL be sent explicitly as one or more `state` query parameters.

#### Scenario: Default lists open pull requests

- **WHEN** the user runs `af bitbucket pr list`
- **THEN** only pull requests with state `OPEN` are returned

#### Scenario: State filter

- **WHEN** the user runs `af bitbucket pr list --state MERGED`
- **THEN** only pull requests with state `MERGED` are returned

#### Scenario: All states

- **WHEN** the user runs `af bitbucket pr list --state ALL`
- **THEN** pull requests in any state are returned
- **AND** the request carries a `state` parameter for each of `OPEN`, `MERGED`, `DECLINED`, and `SUPERSEDED`

#### Scenario: Mine filter

- **WHEN** the user runs `af bitbucket pr list --mine`
- **THEN** only pull requests authored by the authenticated user are returned

#### Scenario: Pagination is automatic

- **GIVEN** the result set spans multiple API pages
- **WHEN** the user runs `af bitbucket pr list`
- **THEN** all pages are fetched and combined before output
