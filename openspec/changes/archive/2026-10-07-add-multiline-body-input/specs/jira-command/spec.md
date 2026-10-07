## ADDED Requirements

### Requirement: Jira comment body from a flag, a file or stdin

`af jira comment <issue-key>` SHALL add a comment when it is given `--body <text>`, `--body-file <path>` or `--body-file -`, and SHALL accept `--add <text>` as an alias of `--body`. When none of these flags is given, it SHALL list the issue's comments. `af jira comment edit <issue-key> <comment-id>` SHALL take the new body from the same flags, including the `--add` alias, and SHALL fail when none of them is given.

Giving `--add` together with `--body`, or `--add` together with `--body-file`, SHALL be an error. An inline body that is empty or only whitespace SHALL be an error when adding and when editing; the CLI SHALL NOT list the comments or send a request instead.

The body SHALL be converted from markdown to ADF. With `--internal` or `--public`, the body SHALL instead be sent as typed to the Jira Service Management request comment API, which renders it as Jira wiki markup.

#### Scenario: Add a comment with --body

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment PROJ-123 --body "Looks good"`
- **THEN** a comment whose ADF body holds the text `Looks good` is added to the issue

#### Scenario: Add a multi-line comment from a quoted heredoc

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment PROJ-123 --body-file - <<'AF_BODY'`, followed by the lines `## Summary`, an empty line, `- First point` and `AF_BODY`
- **THEN** the comment's ADF body is a level-2 heading `Summary` followed by a bullet list with the item `First point`

#### Scenario: Add a comment from a file

- **GIVEN** valid Jira credentials in environment
- **AND** a markdown file `note.md`
- **WHEN** the user runs `af jira comment PROJ-123 --body-file note.md`
- **THEN** a comment whose ADF body is converted from the content of `note.md` is added

#### Scenario: --add is an alias of --body

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment PROJ-123 --add "Comment text"`
- **THEN** the comment is added exactly as with `--body "Comment text"`

#### Scenario: --add together with --body is rejected

- **WHEN** the user runs `af jira comment PROJ-123 --add "a" --body "b"`
- **THEN** an error naming `--add` and `--body` is printed
- **AND** the exit code is 1
- **AND** no comment is posted

#### Scenario: Empty inline body is rejected

- **WHEN** the user runs `af jira comment PROJ-123 --add ""`
- **THEN** an error naming `--add` and saying that it is empty is printed
- **AND** the exit code is 1
- **AND** the comments are not listed and no comment is posted

#### Scenario: Without a body flag the comments are listed

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment PROJ-123`
- **THEN** the issue's comments are listed

#### Scenario: Edit a comment from stdin

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment edit PROJ-123 10042 --body-file -` with markdown on standard input
- **THEN** comment 10042 is replaced with the ADF converted from standard input

#### Scenario: Edit accepts --add

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment edit PROJ-123 10042 --add "Updated text"`
- **THEN** comment 10042 is replaced with ADF holding the text `Updated text`

#### Scenario: Edit without a body fails

- **WHEN** the user runs `af jira comment edit PROJ-123 10042`
- **THEN** an error naming `--body` and `--body-file` is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: JSM internal note from a file is sent as typed

- **GIVEN** valid Jira credentials in environment
- **AND** a file `note.txt`
- **WHEN** the user runs `af jira comment PROJ-123 --internal --body-file note.txt`
- **THEN** a request is sent to `POST /rest/servicedeskapi/request/PROJ-123/comment`
- **AND** its `body` is the content of `note.txt`, not converted to ADF
- **AND** its `public` field is `false`

### Requirement: Jira issue description from a file or stdin

`af jira create` and `af jira update` SHALL accept `--description-file <path>` and `--description-file -` as the file twin of `--description`. The text SHALL be converted from markdown to ADF for the issue's `description` field. An inline `--description ""` SHALL keep its current meaning: `create` sets no description, and `update` clears the description.

#### Scenario: Create an issue with a description from stdin

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira create --project PROJ --type Task --summary "Title" --description-file -` with markdown on standard input
- **THEN** the create request's `fields.description` is the ADF converted from standard input

#### Scenario: Update a description from a file

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira update PROJ-123 --description-file desc.md` with no other option
- **THEN** the update request's `fields.description` is the ADF converted from `desc.md`

#### Scenario: Empty inline description clears it on update

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira update PROJ-123 --description ""`
- **THEN** the update request sets `fields.description` to `null`

### Requirement: Jira transition and worklog comments from a file or stdin

`af jira transition`, `af jira worklog add` and `af jira worklog update` SHALL accept `--comment-file <path>` and `--comment-file -` as the file twin of `--comment`. The comment SHALL be converted from markdown to ADF. For a transition it goes in `update.comment`; for a worklog it is the worklog's `comment`. An inline `--comment ""` SHALL keep its current meaning: `transition` and `worklog add` send no comment, and `worklog update` sends an empty comment, which clears the existing one.

#### Scenario: Transition comment from stdin

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira transition PROJ-123 --to Done --resolution Fixed --comment-file -` with markdown on standard input
- **THEN** the transition request carries the ADF converted from standard input under `update.comment`

#### Scenario: Worklog comment from a file

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira worklog add PROJ-123 --time 2h --comment-file log.md`
- **THEN** a worklog of 2h is recorded
- **AND** its comment is the ADF converted from `log.md`

#### Scenario: Worklog update comment from stdin

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira worklog update PROJ-123 10100 --comment-file -` with markdown on standard input
- **THEN** the worklog update request's `comment` is the ADF converted from standard input

#### Scenario: Empty inline transition comment sends no comment

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira transition PROJ-123 --to Done --comment ""`
- **THEN** the transition request has no `update` property

### Requirement: Jira version description from a file or stdin

`af jira version-create` and `af jira version-update` SHALL accept `--description-file <path>` and `--description-file -` as the file twin of `--description`. A version description is plain text: the CLI SHALL send it as typed, without markdown or ADF conversion. An inline `--description ""` SHALL keep its current meaning: `version-create` sets no description, and `version-update` clears the description.

#### Scenario: Version description from a file

- **GIVEN** valid Jira credentials in environment
- **AND** a file `notes.txt`
- **WHEN** the user runs `af jira version-create --project PROJ --name "v1.0.0" --description-file notes.txt`
- **THEN** the create request's `description` is the content of `notes.txt` as a plain string

#### Scenario: Version description from stdin

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira version-update 12345 --description-file -` with text on standard input
- **THEN** the update request's `description` is the text from standard input as a plain string

#### Scenario: Empty inline version description clears it

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira version-update 12345 --description ""`
- **THEN** the update request sets `description` to the empty string

### Requirement: Strict option checking on Jira prose commands

These subcommands SHALL reject any option that the subcommand and action do not accept, and SHALL reject more positional arguments than they take:

- `af jira comment`, with every action: listing, adding, `edit` and `delete`;
- `create` and `update`;
- `transition`;
- `worklog`, with every action;
- `version-create` and `version-update`.

Either error SHALL exit with code 1 before any file or standard input is read and before any request is sent. `--json` SHALL be accepted by all of these subcommands. Other `af jira` subcommands are not covered by this requirement.

The unknown-option error SHALL name the option and the command, and SHALL list the options the command accepts. When the intent is clear, it SHALL also suggest the intended option:

- a prose flag name that another command uses maps to this command's prose flag or its `-file` twin;
- a near-miss spelling maps to the closest accepted option.

The extra-argument error SHALL name the first unexpected argument. It SHALL say that text containing spaces or apostrophes must be quoted, or passed through the `-file` flag.

#### Scenario: Another command's comment flag is rejected with a hint

- **WHEN** the user runs `af jira comment PROJ-123 --comment "Looks good"`
- **THEN** an error naming `--comment` and suggesting `--body` is printed
- **AND** the exit code is 1
- **AND** the comments are not listed and no comment is posted

#### Scenario: A misspelled option is rejected

- **WHEN** the user runs `af jira create --project PROJ --type Bug --summary "Title" --descripton "Steps"`
- **THEN** an error naming `--descripton` and suggesting `--description` is printed
- **AND** the exit code is 1
- **AND** no issue is created

#### Scenario: Another command's file flag suggests this command's twin

- **WHEN** the user runs `af jira transition PROJ-123 --to Done --body-file notes.md`
- **THEN** an error naming `--body-file` and suggesting `--comment-file` is printed
- **AND** the exit code is 1
- **AND** the issue is not transitioned

#### Scenario: An option the action does not accept

- **WHEN** the user runs `af jira comment edit PROJ-123 10042 --body "x" --internal`
- **THEN** an error naming `--internal` and `comment edit` is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: Words split off by an apostrophe are rejected

- **GIVEN** the shell splits `--add 'Don't merge until QA's done'` into the arguments `--add`, `Dont`, `merge`, `until` and `QAs done`
- **WHEN** the user runs `af jira comment PROJ-123 --add 'Don't merge until QA's done'`
- **THEN** an error naming `merge` as an unexpected argument and mentioning quoting is printed
- **AND** the exit code is 1
- **AND** no comment is posted

#### Scenario: --json is accepted

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment PROJ-123 --body "Looks good" --json`
- **THEN** the comment is added
- **AND** the result is printed as JSON

### Requirement: Jira options accept `--name=value`

The `af jira` argument parser SHALL accept `--<name>=<value>` as equivalent to `--<name> <value>` for every option that takes a value, on every subcommand. It SHALL split the argument at the first `=`, so the value MAY be empty and MAY itself contain `=`. A boolean option written with `=` SHALL be rejected with an error saying that the option takes no value.

#### Scenario: Inline body with an equals sign

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment PROJ-123 --add="Looks good" --json`
- **THEN** a comment with the text `Looks good` is added
- **AND** the result is printed as JSON

#### Scenario: Value containing an equals sign

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira update PROJ-123 --field=storyPoints=5`
- **THEN** the custom field referenced as `storyPoints` is set to `5`

#### Scenario: File twin with an equals sign reads stdin

- **GIVEN** valid Jira credentials in environment
- **WHEN** the user runs `af jira comment PROJ-123 --body-file=-` with text on standard input
- **THEN** the comment text is read from standard input

#### Scenario: Boolean option with a value is rejected

- **WHEN** the user runs `af jira get PROJ-123 --json=true`
- **THEN** an error saying that `--json` takes no value is printed
- **AND** the exit code is 1

## MODIFIED Requirements

### Requirement: Help documentation

The CLI SHALL include jira commands in help output. `af help jira`, `af jira --help`, `af jira -h`, `af jira help` and `af jira` with no arguments SHALL all print the same full Jira reference.

#### Scenario: General help includes jira

- **GIVEN** the user runs `af help`
- **THEN** jira commands are listed in the available commands

#### Scenario: Jira-specific help

- **GIVEN** the user runs `af help jira`
- **THEN** detailed jira command help is displayed
- **AND** all subcommands and options are documented
- **AND** the `--estimate` and `--remaining` options are documented for create and update commands
- **AND** the version management commands are documented (versions, version, version-create, version-update, version-delete)
- **AND** the `--fix-version` and `--affected-version` options are documented for create and update commands
- **AND** the `link`, `unlink`, and `remote-link` subcommands are documented
- **AND** the `--type` option is documented for the link command
- **AND** the `--from` option is documented for the unlink command
- **AND** the `--url`, `--title`, and `--remove` options are documented for the remote-link command
- **AND** the `fields` subcommand is documented with `--project`, `--type`, `--refresh`, `--verbose`, and `--json` options
- **AND** the `--field` and `--field-json` options are documented for create and update commands, including that an empty value clears the field
- **AND** the `--show-field` option is documented for list and search commands
- **AND** the `comment` subcommand is documented with `--body`, `--body-file`, the `--add` alias, `--visibility`, `--internal` and `--public`, and with its `edit` and `delete` actions
- **AND** every prose flag is documented next to its `-file` twin, which takes a path or `-` for standard input: `--body` / `--body-file`, `--description` / `--description-file` and `--comment` / `--comment-file`
- **AND** the help says what each prose flag's text becomes: markdown converted to ADF for comments, issue descriptions, transition comments and worklog comments; text sent as typed, which Jira Service Management renders as wiki markup rather than markdown, for `comment --internal` and `--public`; plain text for version descriptions
- **AND** the help explains that `\n` inside a quoted argument is not a newline, and shows a multi-line example that feeds a quoted heredoc to `--body-file -`

#### Scenario: Jira help flag prints the full reference

- **WHEN** the user runs `af jira --help`
- **THEN** the output is identical to the output of `af help jira`
- **AND** it documents the `comment` subcommand

#### Scenario: Multi-line example can be copied as printed

- **WHEN** the user runs `af help jira`
- **THEN** the output contains these consecutive lines, each starting in the first column: `af jira comment PROJ-123 --body-file - <<'AF_BODY'`, `## Summary`, an empty line, `- First point` and `AF_BODY`

<!-- cspell:words descripton Dont -->
