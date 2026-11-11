# confluence-command Specification

## Purpose

Full CRUD management of Confluence pages, comments, labels, attachments, and spaces via the CLI, primarily for AI agent workflows.
## Requirements
### Requirement: Confluence command routing

The CLI SHALL route `af confluence <subcommand>` to appropriate Confluence handlers.

#### Scenario: Confluence command with subcommand

- **GIVEN** the user runs `af confluence get 12345`
- **WHEN** the router processes the command
- **THEN** it delegates to the confluence command handler
- **AND** passes `get` as the subcommand and `12345` as an argument

#### Scenario: Confluence command without subcommand shows help

- **GIVEN** the user runs `af confluence`
- **WHEN** the router processes the command
- **THEN** it displays confluence-specific help information

### Requirement: Confluence page operations

The CLI SHALL support core page operations via subcommands.

#### Scenario: Get page details

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence get <page-id>`
- **THEN** the page content and metadata are displayed in markdown format
- **AND** the page body is converted from ADF to markdown

#### Scenario: List pages in a space

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence list MYSPACE`
- **THEN** pages from the space are displayed as a table

#### Scenario: Search with CQL

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence search "title = 'My Page'"`
- **THEN** matching pages are displayed

#### Scenario: Create page with inline body

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence create --space MYSPACE --title "Title" --body "Content"`
- **THEN** a new page is created with the body converted from markdown to ADF
- **AND** the page ID is displayed

#### Scenario: Create page with body from file

- **GIVEN** valid Atlassian credentials in environment
- **AND** a markdown file exists at the specified path
- **WHEN** the user runs `af confluence create --space MYSPACE --title "Title" --body-file ./doc.md`
- **THEN** the file content is read and used as the page body

#### Scenario: Create page missing required fields

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence create --title "Title"` (missing --space)
- **THEN** an error is displayed indicating --space and --title are required
- **AND** the CLI exits with code 1

#### Scenario: Update page content

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence update <page-id> --body "New content"`
- **THEN** the page content is updated
- **AND** the page version is automatically incremented

#### Scenario: Update page title

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence update <page-id> --title "New Title"`
- **THEN** the page title is updated

#### Scenario: Delete page

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence delete <page-id>`
- **THEN** the page is deleted

### Requirement: Confluence page hierarchy

The CLI SHALL support viewing page hierarchy.

#### Scenario: Show page tree

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence tree <page-id>`
- **THEN** the page and its children are displayed in a tree format

### Requirement: Confluence comment operations

The CLI SHALL support comment operations on pages.

#### Scenario: List comments

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence comments <page-id>`
- **THEN** footer comments on the page are displayed

#### Scenario: Add comment

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence comment <page-id> --add "Comment text"`
- **THEN** the comment is added to the page

### Requirement: Confluence label operations

The CLI SHALL support label management on pages.

#### Scenario: List labels

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence labels <page-id>`
- **THEN** labels on the page are displayed

#### Scenario: Add label

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence label <page-id> --add "my-label"`
- **THEN** the label is added to the page

#### Scenario: Remove label

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence label <page-id> --remove "my-label"`
- **THEN** the label is removed from the page

### Requirement: Confluence attachment operations

The CLI SHALL support file attachments on pages. The attachment list SHALL show each attachment's ID, filename, size and type, so that a single attachment can be downloaded by its ID.

#### Scenario: List attachments

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence attachments <page-id>`
- **THEN** attachments on the page are displayed with ID, filename, size, and type
- **AND** each ID has the form `att` followed by digits

#### Scenario: Upload attachment

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence attach <page-id> ./file.pdf`
- **THEN** the file is attached to the page

### Requirement: Confluence space operations

The CLI SHALL support space discovery operations.

#### Scenario: List spaces

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence spaces`
- **THEN** available spaces are displayed with key, name, and type

#### Scenario: Get space details

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence space MYSPACE`
- **THEN** space details are displayed

### Requirement: JSON output option

The CLI SHALL support JSON output for programmatic use.

#### Scenario: JSON output for page

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence get <page-id> --json`
- **THEN** the page is output as JSON instead of markdown

### Requirement: Lazy credential validation

The CLI SHALL validate Atlassian credentials only when confluence commands are executed.

#### Scenario: Missing credentials with confluence command

- **GIVEN** Atlassian credentials are not set in environment
- **WHEN** the user runs `af confluence spaces`
- **THEN** an error is displayed indicating missing configuration
- **AND** the CLI exits with code 1

#### Scenario: Missing credentials with other commands

- **GIVEN** Atlassian credentials are not set in environment
- **WHEN** the user runs `af help`
- **THEN** the command succeeds without error

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

### Requirement: Confluence attachment download

The CLI SHALL download page attachments with `af confluence download`. A call SHALL take exactly one of:

- one page ID, matching `^\d+$`, which selects every attachment of the page, fetched with `GET /wiki/api/v2/pages/{id}/attachments?limit=250` and then by following each `_links.next` (a site-relative path, prefixed with the configured base URL) until a response has none;
- one or more attachment IDs, each matching `^att\d+$`, which select those attachments (`GET /wiki/api/v2/attachments/{id}` for each). An ID given more than once SHALL be downloaded once.

A page ID together with an attachment ID, two page IDs, or an argument that matches neither form SHALL be an error that names the argument and the accepted forms. The error SHALL exit with code 1 before any request is sent.

Each file's content SHALL be fetched from `{base}/wiki{downloadLink}`, using the configured base URL and the attachment's `downloadLink`. An attachment whose `downloadLink` does not start with `/` SHALL fail with an error, and nothing SHALL be fetched for it. `--name`, `--out`, `--force` and `--json` SHALL behave as the shared requirement **Attachment download to local files** specifies. The temporary folder's name SHALL start with `af-confluence-<page-id>-` for a page, and with `af-confluence-attachments-` for attachment IDs. When the selected page has no attachments, the CLI SHALL print a notice on standard error, create no folder and exit with code 0. `af confluence --help` SHALL document `download` with `--name`, `--out` and `--force`.

#### Scenario: Download every attachment of a page

- **GIVEN** page 12345 has 300 attachments
- **WHEN** the user runs `af confluence download 12345`
- **THEN** `GET /wiki/api/v2/pages/12345/attachments?limit=250` is sent, and then the `_links.next` path it returned
- **AND** all 300 attachments are written to a new folder whose name starts with `af-confluence-12345-`

#### Scenario: Download attachments by ID

- **WHEN** the user runs `af confluence download att111 att222`
- **THEN** `GET /wiki/api/v2/attachments/att111` and `GET /wiki/api/v2/attachments/att222` are sent
- **AND** each file is fetched from the configured base URL followed by `/wiki` and its `downloadLink`
- **AND** the files are written to a new folder whose name starts with `af-confluence-attachments-`

#### Scenario: Page ID and attachment ID together are rejected

- **WHEN** the user runs `af confluence download 12345 att111`
- **THEN** an error naming `att111` and saying a call takes one page ID or attachment IDs, not both, is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: Page without attachments

- **GIVEN** page 12345 has no attachments
- **WHEN** the user runs `af confluence download 12345`
- **THEN** a notice that page 12345 has no attachments is printed on standard error
- **AND** no folder is created
- **AND** the exit code is 0

#### Scenario: Help documents download

- **WHEN** the user runs `af confluence --help`
- **THEN** the output documents `download` with the page-ID and attachment-ID forms
- **AND** it documents `--name`, `--out` (including `-` for standard output) and `--force`
- **AND** it names `download` among the subcommands that reject options they do not know

### Requirement: Strict option checking on Confluence attachment download

`af confluence download` SHALL accept only `--name`, `--out`, `--force` and `--json`, and SHALL take any number of positional arguments, whose forms the download requirement checks. `--force`, like `--json`, SHALL take no value. An unknown option SHALL be reported as the prose commands report it: the error names the option and the command, lists the accepted options, and suggests the intended option when the intent is clear. The error SHALL exit with code 1 before any request is sent.

#### Scenario: A misspelled option is rejected with a suggestion

- **WHEN** the user runs `af confluence download 12345 --outt ./files`
- **THEN** an error naming `--outt` and suggesting `--out` is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: A value given to --force is rejected

- **WHEN** the user runs `af confluence download 12345 --out ./files --force=yes`
- **THEN** an error saying `--force` does not take a value is printed
- **AND** the exit code is 1

#### Scenario: --json is accepted

- **GIVEN** page 12345 has one attachment
- **WHEN** the user runs `af confluence download 12345 --json`
- **THEN** the attachment is downloaded
- **AND** the result is printed as JSON

<!-- cspell:words outt -->

