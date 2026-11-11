## MODIFIED Requirements

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

## ADDED Requirements

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
