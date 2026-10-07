## ADDED Requirements

### Requirement: Confluence comment body from a flag, a file or stdin

`af confluence comment <page-id>` SHALL take the comment body from `--body <text>`, `--body-file <path>` or `--body-file -`, and SHALL accept `--add <text>` as an alias of `--body`. One of these flags SHALL be required. Giving `--add` together with `--body`, or `--add` together with `--body-file`, SHALL be an error. An inline body that is empty or only whitespace SHALL be an error. The body SHALL be converted from markdown to ADF and posted as a footer comment.

#### Scenario: Add a comment with --body

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence comment 12345 --body "Looks good"`
- **THEN** a footer comment whose ADF body holds the text `Looks good` is added to the page

#### Scenario: Add a multi-line comment from a quoted heredoc

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence comment 12345 --body-file - <<'AF_BODY'`, followed by the lines `## Summary`, an empty line, `- First point` and `AF_BODY`
- **THEN** the comment's ADF body is a level-2 heading `Summary` followed by a bullet list with the item `First point`

#### Scenario: --add is an alias of --body

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence comment 12345 --add "Comment text"`
- **THEN** the comment is added exactly as with `--body "Comment text"`

#### Scenario: --add together with --body-file is rejected

- **WHEN** the user runs `af confluence comment 12345 --add "a" --body-file note.md`
- **THEN** an error naming `--add` and `--body-file` is printed
- **AND** the exit code is 1
- **AND** no comment is posted

#### Scenario: A body is required

- **WHEN** the user runs `af confluence comment 12345`
- **THEN** an error naming `--body` and `--body-file` is printed
- **AND** the exit code is 1

#### Scenario: Empty inline body is rejected

- **WHEN** the user runs `af confluence comment 12345 --body ""`
- **THEN** an error naming `--body` and saying that it is empty is printed
- **AND** the exit code is 1
- **AND** no comment is posted

### Requirement: Confluence page body from stdin

`af confluence create` and `af confluence update` SHALL accept `--body-file -` to read the page body, as markdown, from standard input. Giving both `--body` and `--body-file` SHALL be an error, `Cannot use both --body and --body-file`, even when `--body` is empty. An inline `--body ""` SHALL keep its current meaning: `create` creates a page with an empty body, and `update` leaves the page body unchanged.

#### Scenario: Create a page from stdin

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence create --space MYSPACE --title "Runbook" --body-file -` with markdown on standard input
- **THEN** a page is created whose body is the ADF converted from standard input

#### Scenario: Update a page from stdin

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence update 12345 --body-file -` with markdown on standard input
- **THEN** the page body is replaced with the ADF converted from standard input
- **AND** the page version is incremented

#### Scenario: Inline body together with a body file is rejected

- **WHEN** the user runs `af confluence update 12345 --body "x" --body-file doc.md`
- **THEN** the error `Cannot use both --body and --body-file` is printed
- **AND** the exit code is 1
- **AND** the page is not updated

#### Scenario: An empty body file no longer creates an empty page

- **GIVEN** `empty.md` is an empty file
- **WHEN** the user runs `af confluence create --space MYSPACE --title "T" --body-file empty.md`
- **THEN** an error naming `--body-file` and `empty.md` is printed
- **AND** the exit code is 1
- **AND** no page is created

#### Scenario: Empty inline body leaves the page body unchanged

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence update 12345 --title "New Title" --body ""`
- **THEN** the page title is updated
- **AND** the page body is kept as it was

### Requirement: Strict option checking on Confluence prose commands

`af confluence create`, `af confluence update` and `af confluence comment` SHALL reject any option that the subcommand does not accept, and SHALL reject more positional arguments than they take. Either error SHALL exit with code 1 before any file or standard input is read and before any request is sent. `--json` SHALL be accepted by all three. Other `af confluence` subcommands are not covered by this requirement.

The unknown-option error SHALL name the option and the command, and SHALL list the options the command accepts. When the intent is clear, it SHALL also suggest the intended option:

- a prose flag name that another command uses maps to `--body` or `--body-file`;
- a near-miss spelling maps to the closest accepted option.

The extra-argument error SHALL name the first unexpected argument. It SHALL say that text containing spaces or apostrophes must be quoted, or passed through `--body-file`.

#### Scenario: A misspelled file flag is rejected

- **WHEN** the user runs `af confluence create --space MYSPACE --title "T" --body-flie doc.md`
- **THEN** an error naming `--body-flie` and suggesting `--body-file` is printed
- **AND** the exit code is 1
- **AND** no page is created

#### Scenario: Another command's comment flag is rejected with a hint

- **WHEN** the user runs `af confluence comment 12345 --comment "Looks good"`
- **THEN** an error naming `--comment` and suggesting `--body` is printed
- **AND** the exit code is 1
- **AND** no comment is posted

#### Scenario: An unquoted multi-word body is rejected

- **WHEN** the user runs `af confluence comment 12345 --body Looks good`
- **THEN** an error naming `good` as an unexpected argument and mentioning quoting is printed
- **AND** the exit code is 1
- **AND** no comment is posted

#### Scenario: --json is accepted

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence comment 12345 --body "Looks good" --json`
- **THEN** the comment is added
- **AND** the result is printed as JSON

### Requirement: Confluence options accept `--name=value`

The `af confluence` argument parser SHALL accept `--<name>=<value>` as equivalent to `--<name> <value>` for every option that takes a value, on every subcommand. It SHALL split the argument at the first `=`, so the value MAY be empty and MAY itself contain `=`. The boolean option `--json` written with `=` SHALL be rejected with an error saying that it takes no value.

#### Scenario: Title with an equals sign

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence update 12345 --title="New Title"`
- **THEN** the page title is updated to `New Title`

#### Scenario: Body file with an equals sign reads stdin

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence create --space MYSPACE --title "T" --body-file=-` with markdown on standard input
- **THEN** the page body is read from standard input

#### Scenario: Boolean option with a value is rejected

- **WHEN** the user runs `af confluence spaces --json=1`
- **THEN** an error saying that `--json` takes no value is printed
- **AND** the exit code is 1

## MODIFIED Requirements

### Requirement: Help documentation

The CLI SHALL include confluence commands in help output. `af help confluence`, `af confluence --help`, `af confluence -h`, `af confluence help` and `af confluence` with no arguments SHALL all print the same full Confluence reference.

#### Scenario: General help includes confluence

- **GIVEN** the user runs `af help`
- **THEN** confluence commands are listed in the available commands

#### Scenario: Confluence-specific help

- **GIVEN** the user runs `af help confluence`
- **THEN** detailed confluence command help is displayed
- **AND** all subcommands and options are documented
- **AND** the `comment` subcommand is documented with `--body`, `--body-file` and the `--add` alias
- **AND** `--body-file` is documented as taking a path or `-` for standard input on `create`, `update` and `comment`
- **AND** the help says that page and comment text is markdown converted to ADF
- **AND** the help explains that `\n` inside a quoted argument is not a newline, and shows a multi-line example that feeds a quoted heredoc to `--body-file -`

#### Scenario: Confluence help flag prints the full reference

- **WHEN** the user runs `af confluence --help`
- **THEN** the output is identical to the output of `af help confluence`

#### Scenario: Multi-line example can be copied as printed

- **WHEN** the user runs `af help confluence`
- **THEN** the output contains these consecutive lines, each starting in the first column: `af confluence comment 12345 --body-file - <<'AF_BODY'`, `## Summary`, an empty line, `- First point` and `AF_BODY`

<!-- cspell:words flie -->
