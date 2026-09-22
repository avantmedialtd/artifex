## ADDED Requirements

### Requirement: Review state in pull request lists

The CLI SHALL show each pull request's review state and open-task count in the `pr list` and `pr mine` tables. It SHALL request `participants` and `reviewers` on the existing list requests through the `fields` partial-response parameter, whose decoded value is `+values.participants,+values.reviewers` with `+` percent-encoded as `%2B`, and SHALL NOT issue any per-pull-request request for this information.

#### Scenario: Review data is requested on the workspace list call

- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** each `GET /workspaces/{ws}/pullrequests/{account}` request carries a `fields` parameter whose decoded value is `+values.participants,+values.reviewers`
- **AND** no per-pull-request request is issued

#### Scenario: Review data is requested on the repository list call

- **WHEN** the user runs `af bitbucket pr list`
- **THEN** the `GET /repositories/{ws}/{repo}/pullrequests` request carries a `fields` parameter whose decoded value is `+values.participants,+values.reviewers`
- **AND** no per-pull-request request is issued

#### Scenario: Approvals exclude the author

- **GIVEN** a pull request approved by two participants and by its own author
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** that row's Review cell shows `✓2`

#### Scenario: Changes requested are shown

- **GIVEN** a pull request with one approval and one participant who requested changes
- **WHEN** the user runs `af bitbucket pr list`
- **THEN** that row's Review cell shows `✓1 ✗1`

#### Scenario: Reviewers who have not responded are pending

- **GIVEN** a pull request with three reviewers, one of whom approved
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** that row's Review cell shows `✓1 ○2`

#### Scenario: Participants who only commented are not pending

- **GIVEN** a pull request with a participant who is not a reviewer and has neither approved nor requested changes
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** that participant is not counted in the Review cell

#### Scenario: No review activity

- **GIVEN** a pull request with no reviewers, no approvals, and no change requests
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** that row's Review cell shows `—`

#### Scenario: Review data unavailable

- **GIVEN** a pull request object returned without a `participants` field
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** that row's Review cell shows `?`

#### Scenario: Open tasks are shown

- **GIVEN** one pull request with `task_count` 2 and another with `task_count` 0
- **WHEN** the user runs `af bitbucket pr list`
- **THEN** the first row's Tasks cell shows `2`
- **AND** the second row's Tasks cell shows `—`

#### Scenario: JSON carries raw review data

- **WHEN** the user runs `af bitbucket pr mine --json`
- **THEN** the output is an array of the raw pull request objects
- **AND** each object includes `participants` and `reviewers` exactly as returned by the API
- **AND** no computed review fields are added

#### Scenario: Review data survives pagination

- **GIVEN** a pull request list that spans two API pages
- **AND** the first page's `next` URL does not carry the `fields` parameter
- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** the second page request carries a `fields` parameter whose decoded value is `+values.participants,+values.reviewers`
- **AND** rows from both pages show their review state

### Requirement: Opt-in merge signals in pull request lists

The CLI SHALL accept `--checks` on `pr list` and `pr mine`. With it, each displayed pull request SHALL also show, in Builds and Conflicts columns, the build state of its head commit and whether it has merge conflicts. Signals SHALL be fetched:

- only when `--checks` is given;
- only with HTTP GET requests;
- only for displayed pull requests whose state is `OPEN`;
- with at most 4 pull requests' signals in flight at once.

A displayed pull request in any other state SHALL show `—` in both columns without any signal request.

#### Scenario: No signal requests without the flag

- **WHEN** the user runs `af bitbucket pr mine`
- **THEN** no `…/statuses` or `…/conflicts` request is issued
- **AND** no Builds or Conflicts column is rendered

#### Scenario: Signals are fetched with the flag

- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** for each listed open pull request `GET …/pullrequests/{id}/statuses` and `GET …/pullrequests/{id}/conflicts` are requested against that pull request's own repository
- **AND** Builds and Conflicts columns are rendered

#### Scenario: Closed pull requests are not checked

- **GIVEN** a listing that contains one `OPEN` and one `MERGED` pull request
- **WHEN** the user runs `af bitbucket pr mine --state ALL --checks`
- **THEN** signals are requested only for the `OPEN` pull request
- **AND** the `MERGED` row shows `—` in its Builds and Conflicts cells
- **AND** no warning is printed for the `MERGED` row

#### Scenario: Only displayed pull requests are checked

- **GIVEN** a repository with open pull requests by several authors
- **WHEN** the user runs `af bitbucket pr list --mine --checks`
- **THEN** signals are requested only for the pull requests authored by the authenticated account

#### Scenario: Limit bounds the checked pull requests

- **WHEN** the user runs `af bitbucket pr mine --limit 5 --checks`
- **THEN** signals are requested for at most 5 pull requests

#### Scenario: Bounded concurrency

- **GIVEN** 10 listed pull requests
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** signals for at most 4 pull requests are being fetched at any time

#### Scenario: Builds reflect only the head commit

- **GIVEN** a pull request with a `FAILED` status on an earlier commit and a `SUCCESSFUL` status on its source head commit
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** that row's Builds cell shows `✓ 1 passed`

#### Scenario: A status without a commit does not disable head filtering

- **GIVEN** a pull request with a `FAILED` status on an earlier commit and a `SUCCESSFUL` status that carries no commit
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** that row's Builds cell shows `✓ 1 passed`

#### Scenario: Failed build on the head commit

- **GIVEN** a pull request whose source head commit has one `FAILED` and one `SUCCESSFUL` status
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** that row's Builds cell shows `✗ 1 failed`

#### Scenario: Stopped build on the head commit

- **GIVEN** a pull request whose source head commit has one `STOPPED` and one `SUCCESSFUL` status and no `FAILED` status
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** that row's Builds cell shows `○ 1 stopped`

#### Scenario: Running build on the head commit

- **GIVEN** a pull request whose source head commit has one `INPROGRESS` and one `SUCCESSFUL` status and no `FAILED` or `STOPPED` status
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** that row's Builds cell shows `⟳ 1 running`

#### Scenario: No builds

- **GIVEN** a pull request with no statuses on its source head commit
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** that row's Builds cell shows `—`

#### Scenario: Conflicts present

- **GIVEN** the conflicts request for a pull request returns two conflict entries
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** that row's Conflicts cell shows `✗ 2`

#### Scenario: No conflicts

- **GIVEN** the conflicts request for a pull request returns no entries
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** that row's Conflicts cell shows `✓ none`

### Requirement: Merge signals never fail the command

The CLI SHALL treat review state, open tasks, and `--checks` signals as informational. The exit code SHALL NOT depend on any pull request's approvals, change requests, open tasks, build state, or conflicts. A signal that cannot be fetched SHALL render as `?` and SHALL NOT fail the command.

#### Scenario: Adverse signals still exit zero

- **GIVEN** a listed pull request with changes requested, open tasks, a failed head-commit build, and conflicts
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** those signals are rendered
- **AND** the exit code is 0

#### Scenario: Unavailable signal renders as unknown

- **GIVEN** the conflicts request for one listed pull request fails with HTTP 403
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** that row's Conflicts cell shows `?`
- **AND** every other cell and row is still rendered
- **AND** a warning naming the conflicts signal and HTTP 403 is printed to stderr
- **AND** the exit code is 0

#### Scenario: Repeated failures produce one warning

- **GIVEN** the conflicts request fails with HTTP 401 for 12 listed pull requests
- **WHEN** the user runs `af bitbucket pr mine --checks`
- **THEN** a single stderr warning reports that conflicts were unavailable for 12 pull requests

#### Scenario: Listing errors are unchanged

- **GIVEN** the repository pull request list request fails with HTTP 500
- **WHEN** the user runs `af bitbucket pr list --checks`
- **THEN** the error is printed to stderr
- **AND** no signal request is issued
- **AND** the exit code is 1

### Requirement: Merge signals with JSON output

Combining `--checks` with `--json` SHALL leave the JSON output unchanged and SHALL NOT issue signal requests.

#### Scenario: Checks flag is ignored in JSON mode

- **WHEN** the user runs `af bitbucket pr mine --checks --json`
- **THEN** stdout is the same array of raw pull request objects as without `--checks`
- **AND** no `…/statuses` or `…/conflicts` request is issued
- **AND** a notice that `--checks` has no effect with `--json` is printed to stderr
- **AND** the exit code is 0
