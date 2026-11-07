## MODIFIED Requirements

### Requirement: Pull request update

The CLI SHALL update the title, description, reviewers and draft state of an existing open pull request. `pr update` SHALL accept `--ready`, which marks a draft ready for review, and `--draft`, which moves an open pull request back to draft. The two flags SHALL be mutually exclusive. Either MAY be combined with `--title`, `--description` / `--description-file` and `--reviewers`, and the combination SHALL be sent as one PUT. At least one of these change flags SHALL be given. Without one, the CLI SHALL print an error listing the change flags and send no request.

Before it sends the PUT, the CLI SHALL fetch the pull request with `GET …/pullrequests/{id}`, and then SHALL:

- print an error and send no PUT when the pull request's state is not `OPEN`;
- preserve every field the user did not change (title, description and reviewers) by resending its current value from the fetched pull request, so that every PUT carries the title, the description and the reviewers;
- send `draft` only when `--ready` or `--draft` changes the pull request's draft state;
- when `--ready` or `--draft` is the only change flag and the pull request is already in the requested state, print a notice saying so, send no PUT, and exit with code 0.

`--reviewers` SHALL replace the whole reviewer list, and an empty `--reviewers ""` SHALL clear it. An inline `--description ""` SHALL clear the description. Mutually exclusive flags and a missing change flag SHALL be reported before any file or standard input is read and before any request is sent. A description file or standard input SHALL be read before the pull request is fetched. On success, the CLI SHALL print the updated pull request, or with `--json` the raw pull request that the PUT returned. When Bitbucket rejects the PUT with HTTP 400 and an error message that mentions reviewers, the CLI SHALL print Bitbucket's error, then a hint to pass `--reviewers` explicitly or to remove the inactive reviewer in Bitbucket, and SHALL exit with code 1.

#### Scenario: Update title

- **GIVEN** pull request 42 is open, with a description and reviewers `a1` and `a2`
- **AND** every PUT resends the current value of each field the user does not change
- **WHEN** the user runs `af bitbucket pr update 42 --title "New title"`
- **THEN** a GET of pull request 42 is made before the PUT
- **AND** the PUT sets the title to `New title`
- **AND** the PUT preserves the existing description and reviewers `a1` and `a2` by resending their current values

#### Scenario: Update description from file

- **GIVEN** every PUT resends the current value of each field the user does not change
- **WHEN** the user runs `af bitbucket pr update 42 --description-file ./body.md`
- **THEN** a PUT is made with the new description from the file
- **AND** the PUT preserves the existing title and reviewers by resending their current values

#### Scenario: Reviewers replace the list

- **GIVEN** pull request 42 is open with reviewers `a1` and `a2`
- **WHEN** the user runs `af bitbucket pr update 42 --reviewers a3`
- **THEN** the PUT body's `reviewers` field is `[{account_id: "a3"}]`

#### Scenario: Clear the description

- **WHEN** the user runs `af bitbucket pr update 42 --description ""`
- **THEN** the PUT body's `description` field is the empty string

#### Scenario: Clear the reviewers

- **GIVEN** pull request 42 is open with reviewers `a1` and `a2`
- **WHEN** the user runs `af bitbucket pr update 42 --reviewers ""`
- **THEN** the PUT body's `reviewers` field is an empty list

#### Scenario: Mark a draft ready for review

- **GIVEN** pull request 42 is an open draft
- **WHEN** the user runs `af bitbucket pr update 42 --ready`
- **THEN** the PUT body's `draft` field is `false`

#### Scenario: Move an open pull request back to draft

- **GIVEN** pull request 42 is open and is not a draft
- **WHEN** the user runs `af bitbucket pr update 42 --draft`
- **THEN** the PUT body's `draft` field is `true`

#### Scenario: Finish a draft in one request

- **GIVEN** pull request 42 is an open draft
- **WHEN** the user runs `af bitbucket pr update 42 --description-file ./final.md --ready`
- **THEN** exactly one PUT is made
- **AND** its body carries the description from `final.md` and `draft: false`

#### Scenario: Draft state already as requested

- **GIVEN** pull request 42 is open and is not a draft
- **WHEN** the user runs `af bitbucket pr update 42 --ready`
- **THEN** a notice that pull request 42 is already ready for review is printed
- **AND** no PUT is made
- **AND** the exit code is 0

#### Scenario: Already-ready notice with JSON output

- **GIVEN** pull request 42 is open and is not a draft
- **WHEN** the user runs `af bitbucket pr update 42 --ready --json`
- **THEN** the fetched pull request is printed as JSON on standard output
- **AND** the notice is printed on standard error
- **AND** no PUT is made

#### Scenario: Unchanged draft state is not sent

- **GIVEN** pull request 42 is open and is not a draft
- **WHEN** the user runs `af bitbucket pr update 42 --title "T2" --ready`
- **THEN** the PUT sets the title to `T2`
- **AND** the PUT body has no `draft` field

#### Scenario: Ready and draft are mutually exclusive

- **WHEN** the user runs `af bitbucket pr update 42 --ready --draft`
- **THEN** an error naming the conflict is printed
- **AND** no request is sent
- **AND** the exit code is 1

#### Scenario: Pull request that is not open

- **GIVEN** pull request 42 has state `MERGED`
- **WHEN** the user runs `af bitbucket pr update 42 --title T`
- **THEN** an error saying that pull request 42 is `MERGED` and only open pull requests can be updated is printed
- **AND** no PUT is made
- **AND** the exit code is 1

#### Scenario: No change flag

- **WHEN** the user runs `af bitbucket pr update 42`
- **THEN** an error listing `--title`, `--description`, `--description-file`, `--reviewers`, `--ready` and `--draft` is printed
- **AND** no request is sent
- **AND** the exit code is 1

#### Scenario: Resent reviewer list is rejected

- **GIVEN** pull request 42 is open, and one of its reviewers is no longer an active user
- **AND** Bitbucket rejects the PUT with HTTP 400 and an error message that mentions reviewers
- **WHEN** the user runs `af bitbucket pr update 42 --title "New title"`
- **THEN** Bitbucket's error message is printed
- **AND** a hint to pass `--reviewers` explicitly, or to remove the inactive reviewer in Bitbucket, is printed
- **AND** the exit code is 1

### Requirement: Strict option checking on Bitbucket pull request prose commands

These subcommands SHALL reject any option that the subcommand and action do not accept, and SHALL reject more positional arguments than they take:

- `pr create` and `pr update`;
- `pr ready` and `pr draft`, which stand for `pr update --ready` and `pr update --draft`;
- `pr comment`, with every action;
- `pr task`, with every action.

The exported `parseArgs` SHALL perform this check, so either error exits with code 1 before any file or standard input is read and before any request is sent. `--json`, `--workspace` and `--repo` SHALL be accepted by all of these subcommands, and `pr create` SHALL accept the branch aliases `--source`, `--src`, `--destination` and `--dest`. Other `af bitbucket` subcommands are not covered by this requirement.

The unknown-option error SHALL name the option and the command, and SHALL list the options the command accepts. When the intent is clear, it SHALL also suggest the intended option:

- a prose flag name that another command uses maps to this command's prose flag or its `-file` twin;
- a near-miss spelling maps to the closest accepted option.

The extra-argument error SHALL name the first unexpected argument. It SHALL say that text containing spaces or apostrophes must be quoted, or passed through the `-file` flag.

#### Scenario: Another command's comment flag is rejected with a hint

- **WHEN** the user runs `af bb pr comment add 42 --add "LGTM"`
- **THEN** an error naming `--add` and suggesting `--body` is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: A body flag on pull request creation suggests the description flag

- **WHEN** the user runs `af bb pr create --title "Fix" --body "Details"`
- **THEN** an error naming `--body` and suggesting `--description` is printed
- **AND** the exit code is 1
- **AND** no pull request is created

#### Scenario: An unquoted multi-word body is rejected

- **WHEN** the user runs `af bb pr comment add 42 --body Looks good`
- **THEN** an error naming `good` as an unexpected argument and mentioning quoting is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: An option the action does not accept

- **WHEN** the user runs `af bb pr update 42 --close-source`
- **THEN** an error naming `--close-source` and `pr update` is printed
- **AND** the exit code is 1

#### Scenario: A draft alias rejects update options

- **WHEN** the user runs `af bb pr ready 42 --title "New title"`
- **THEN** an error naming `--title` and `pr ready` is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: Global options and branch aliases are accepted

- **WHEN** the user runs `af bb pr create --title T --src feature/x --dest main --workspace ws --repo r --json`
- **THEN** no option error is reported
- **AND** the pull request is created from `feature/x` into `main` in `ws/r`

## ADDED Requirements

### Requirement: Pull request draft lifecycle commands

`af bitbucket pr ready <id>` SHALL behave as `af bitbucket pr update <id> --ready`, and `af bitbucket pr draft <id>` SHALL behave as `af bitbucket pr update <id> --draft`. That covers the fetch before the write, the not-open error, the notice when the pull request is already in the requested state, the preserved fields, and the output. Both commands SHALL take exactly one positional argument, the pull request id, and SHALL accept only the global options `--json`, `--workspace` and `--repo`.

#### Scenario: Mark a draft ready

- **GIVEN** pull request 42 is an open draft
- **WHEN** the user runs `af bb pr ready 42`
- **THEN** a PUT with `draft: false` is made to pull request 42
- **AND** the updated pull request is printed

#### Scenario: Reviewers survive marking a draft ready

- **GIVEN** pull request 42 is an open draft with reviewers `a1` and `a2`
- **AND** every PUT resends the current value of each field the user does not change
- **WHEN** the user runs `af bb pr ready 42`
- **THEN** the PUT preserves reviewers `a1` and `a2` by resending them, together with the current title and description

#### Scenario: Move back to draft

- **GIVEN** pull request 42 is open and is not a draft
- **WHEN** the user runs `af bb pr draft 42`
- **THEN** a PUT with `draft: true` is made to pull request 42

#### Scenario: Already a draft

- **GIVEN** pull request 42 is an open draft
- **WHEN** the user runs `af bb pr draft 42`
- **THEN** a notice that pull request 42 is already a draft is printed
- **AND** no PUT is made
- **AND** the exit code is 0

#### Scenario: Pull request id is required

- **WHEN** the user runs `af bb pr ready`
- **THEN** an error saying that a pull request id is required is printed
- **AND** no request is sent
- **AND** the exit code is 1

#### Scenario: JSON output

- **GIVEN** pull request 42 is an open draft
- **WHEN** the user runs `af bb pr ready 42 --json`
- **THEN** the raw pull request returned by the PUT is printed as JSON

### Requirement: Draft state in pull request lists

The `pr list` and `pr mine` tables SHALL show the State cell of a draft pull request as its state followed by ` (draft)`, for example `OPEN (draft)`. That is the wording `pr get` uses.

Both commands SHALL accept `--draft`, which lists only drafts, and `--ready`, which lists only pull requests that are not drafts. The two flags SHALL be mutually exclusive.

The filter SHALL be sent in the `q` query parameter as `draft=true` or `draft=false`. When the command also has another `q` clause, such as the `--author` filter of `pr list`, the clauses SHALL be joined with ` AND `. The filter SHALL be set on every page request, including requests that follow a `next` URL. It SHALL apply before `--mine`, `--limit`, `--checks` and `--json` see the results, and SHALL issue no additional requests.

#### Scenario: Drafts are marked in pr list

- **GIVEN** the repository has open pull request 7, which is a draft, and open pull request 8, which is not
- **WHEN** the user runs `af bb pr list`
- **THEN** the State cell of pull request 7 is `OPEN (draft)`
- **AND** the State cell of pull request 8 is `OPEN`

#### Scenario: Drafts are marked in pr mine

- **GIVEN** one of the authenticated account's open pull requests is a draft
- **WHEN** the user runs `af bb pr mine`
- **THEN** that row's State cell is `OPEN (draft)`

#### Scenario: Only drafts

- **WHEN** the user runs `af bb pr list --draft`
- **THEN** the `GET /repositories/{ws}/{repo}/pullrequests` request carries a `q` parameter whose decoded value is `draft=true`

#### Scenario: Only pull requests that are ready

- **WHEN** the user runs `af bb pr mine --ready`
- **THEN** each `GET /workspaces/{ws}/pullrequests/{account}` request carries a `q` parameter whose decoded value is `draft=false`

#### Scenario: Draft filter combined with the author filter

- **WHEN** the user runs `af bb pr list --author alice --draft`
- **THEN** the `q` parameter's decoded value is `author.nickname="alice" AND draft=true`

#### Scenario: Draft filter survives pagination

- **GIVEN** the results span two pages
- **AND** the first page's `next` URL carries no `q` parameter
- **WHEN** the user runs `af bb pr list --draft`
- **THEN** the request for the second page also carries a `q` parameter whose decoded value is `draft=true`

#### Scenario: Limit counts only matching pull requests

- **WHEN** the user runs `af bb pr mine --draft --limit 2`
- **THEN** each request carries a `q` parameter whose decoded value is `draft=true`
- **AND** at most two pull requests are printed

#### Scenario: Draft and ready filters are mutually exclusive

- **WHEN** the user runs `af bb pr list --draft --ready`
- **THEN** an error naming the conflict is printed
- **AND** no request is sent
- **AND** the exit code is 1

### Requirement: Merging a draft pull request

When the merge request of `pr merge` fails, the CLI SHALL fetch the pull request. If it is a draft, the CLI SHALL print Bitbucket's error, then an error saying that the pull request is a draft and cannot be merged, suggesting `af bb pr ready <id>`, and SHALL exit with code 1. If the fetch fails or the pull request is not a draft, the merge failure SHALL be reported as before. A successful merge SHALL make no request besides the merge request.

#### Scenario: Merging a draft suggests marking it ready

- **GIVEN** pull request 42 is an open draft
- **AND** Bitbucket rejects the merge request
- **WHEN** the user runs `af bb pr merge 42`
- **THEN** Bitbucket's error message is printed
- **AND** an error saying that pull request 42 is a draft and suggesting `af bb pr ready 42` is printed
- **AND** the exit code is 1

#### Scenario: Other merge failures are reported as before

- **GIVEN** pull request 42 is open and is not a draft
- **AND** Bitbucket rejects the merge request
- **WHEN** the user runs `af bb pr merge 42`
- **THEN** only Bitbucket's error message is printed
- **AND** the exit code is 1

#### Scenario: A successful merge makes no extra request

- **WHEN** the user runs `af bb pr merge 42` and Bitbucket accepts the merge
- **THEN** the merge request is the only request made

### Requirement: Bitbucket help documents draft pull requests

The full Bitbucket reference, printed by `af help bitbucket` and the equivalent help forms, SHALL:

- list `pr ready <id>` and `pr draft <id>`;
- show `[--ready | --draft]` on `pr update` and `[--draft | --ready]` on `pr list` and `pr mine`;
- say that reviewers on a draft are not notified until it is marked ready, and that a draft cannot be merged.

#### Scenario: Help lists the draft commands

- **WHEN** the user runs `af help bitbucket`
- **THEN** the output lists `pr ready <id>` and `pr draft <id>`
- **AND** it says that reviewers on a draft are notified only when it is marked ready

### Requirement: Bitbucket errors include per-field details

When a Bitbucket API request fails with Bitbucket's error envelope (`{"type": "error", "error": {"message": …, "fields": {…}}}`), the reported error message SHALL be Bitbucket's `message`, followed by one `field: detail` line for each entry of `fields`, where `detail` joins that field's messages with `; `. A line that the message already contains SHALL be left out. An envelope without `fields` SHALL be reported as its `message` alone.

#### Scenario: Field errors follow the message

- **GIVEN** Bitbucket rejects a request with HTTP 400 and the error `{"message": "Bad request", "fields": {"reviewers": ["Malformed reviewers list"]}}`
- **WHEN** the CLI reports the error
- **THEN** the message is `Bad request`, followed by the line `reviewers: Malformed reviewers list`

#### Scenario: A field error the message repeats is not duplicated

- **GIVEN** Bitbucket's error message is `reviewers: Malformed reviewers list`, and its `fields` hold `{"reviewers": ["Malformed reviewers list"]}`
- **WHEN** the CLI reports the error
- **THEN** the message is `reviewers: Malformed reviewers list`, once

#### Scenario: The reviewers hint sees field errors

- **GIVEN** pull request 42 is open
- **AND** Bitbucket rejects the PUT with HTTP 400, the message `Bad request`, and `fields` holding `{"reviewers": ["Malformed reviewers list"]}`
- **WHEN** the user runs `af bitbucket pr update 42 --title "New title"`
- **THEN** the error, including the line `reviewers: Malformed reviewers list`, is printed
- **AND** the hint to pass `--reviewers` explicitly, or to remove the inactive reviewer in Bitbucket, is printed
- **AND** the exit code is 1
