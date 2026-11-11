## ADDED Requirements

### Requirement: Jira attachment listing

The CLI SHALL list an issue's attachments with `af jira attachments <issue-key>`, fetched with `GET /rest/api/3/issue/{key}?fields=attachment`. The output SHALL be a table headed `# Attachments on <KEY> (<n>)`, with one row per attachment showing its ID, filename, size, type, the date it was added and its author. An issue without attachments SHALL print `No attachments.` With `--json`, the CLI SHALL print the raw attachment array. Without an issue key, the CLI SHALL print a usage error and exit with code 1.

#### Scenario: List an issue's attachments

- **GIVEN** issue MR-10 has attachment 10113 `mobile-modules.png` (38,612 bytes, `image/png`) and attachment 10115 `mobile-property-settings.png`
- **WHEN** the user runs `af jira attachments MR-10`
- **THEN** a table headed `# Attachments on MR-10 (2)` is printed
- **AND** the row for 10113 shows `mobile-modules.png`, `37.7 KB`, `image/png`, the date added and the author's display name

#### Scenario: Issue without attachments

- **GIVEN** issue PROJ-1 has no attachments
- **WHEN** the user runs `af jira attachments PROJ-1`
- **THEN** `No attachments.` is printed
- **AND** the exit code is 0

#### Scenario: JSON output

- **WHEN** the user runs `af jira attachments MR-10 --json`
- **THEN** the issue's `fields.attachment` array is printed as JSON

#### Scenario: Missing issue key

- **WHEN** the user runs `af jira attachments`
- **THEN** a usage error is printed
- **AND** the exit code is 1
- **AND** no request is sent

### Requirement: Jira attachment download

The CLI SHALL download attachments with `af jira download`. A call SHALL take exactly one of:

- one issue key, matching `^[A-Za-z][A-Za-z0-9_]*-\d+$`, which selects every attachment of the issue (`GET /rest/api/3/issue/{key}?fields=attachment`);
- one or more attachment IDs, each matching `^\d+$`, which select those attachments (`GET /rest/api/3/attachment/{id}` for each). An ID given more than once SHALL be downloaded once.

An issue key together with an attachment ID, two issue keys, or an argument that matches neither form SHALL be an error that names the argument and the accepted forms. The error SHALL exit with code 1 before any request is sent.

Each file's content SHALL be fetched from `GET {base}/rest/api/3/attachment/content/{id}?redirect=false`, built from the configured base URL and the attachment ID. `--name`, `--out`, `--force` and `--json` SHALL behave as the shared requirement **Attachment download to local files** specifies. The temporary folder's name SHALL start with `af-jira-<KEY>-` (the issue key in upper case) for an issue, and with `af-jira-attachments-` for attachment IDs. When the selected issue has no attachments, the CLI SHALL print a notice on standard error, create no folder and exit with code 0. `af jira --help` SHALL document `attachments` and `download` with `--name`, `--out` and `--force`.

#### Scenario: Download every attachment of an issue

- **GIVEN** issue MR-10 has attachments `mobile-modules.png` and `mobile-property-settings.png`
- **WHEN** the user runs `af jira download MR-10`
- **THEN** a new folder whose name starts with `af-jira-MR-10-` is created in the OS temporary directory
- **AND** it contains `mobile-modules.png` and `mobile-property-settings.png` with the attachments' bytes
- **AND** the folder's absolute path and each file's absolute path are printed
- **AND** the exit code is 0

#### Scenario: Download attachments by ID

- **WHEN** the user runs `af jira download 10046 10113`
- **THEN** `GET /rest/api/3/attachment/10046` and `GET /rest/api/3/attachment/10113` are sent
- **AND** each file is fetched from `/rest/api/3/attachment/content/<id>?redirect=false` on the configured site
- **AND** the files are written to a new folder whose name starts with `af-jira-attachments-`

#### Scenario: Filter by filename

- **GIVEN** issue MR-1 has attachments `a.png`, `b.PNG` and `notes.txt`
- **WHEN** the user runs `af jira download MR-1 --name '*.png'`
- **THEN** `a.png` and `b.PNG` are downloaded
- **AND** `notes.txt` is not downloaded

#### Scenario: Issue key and attachment ID together are rejected

- **WHEN** the user runs `af jira download MR-4 10046`
- **THEN** an error naming `10046` and saying a call takes one issue key or attachment IDs, not both, is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: Unrecognized argument is rejected

- **WHEN** the user runs `af jira download screenshot.png`
- **THEN** an error naming `screenshot.png` and both accepted forms is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: Issue without attachments

- **GIVEN** issue PROJ-1 has no attachments
- **WHEN** the user runs `af jira download PROJ-1`
- **THEN** a notice that PROJ-1 has no attachments is printed on standard error
- **AND** no folder is created
- **AND** the exit code is 0

#### Scenario: Unknown attachment ID

- **GIVEN** attachment 99999999 does not exist
- **WHEN** the user runs `af jira download 10046 99999999`
- **THEN** Jira's error message for 99999999 is printed
- **AND** the exit code is 1
- **AND** no file is downloaded and no folder is created

#### Scenario: Help documents the attachment commands

- **WHEN** the user runs `af jira --help`
- **THEN** the output documents `attachments <issue-key>` and `download`, with the issue-key and attachment-ID forms
- **AND** it documents `--name`, `--out` (including `-` for standard output) and `--force`
- **AND** it names `attachments` and `download` among the subcommands that reject options they do not know

### Requirement: Attachments in Jira issue details

When an issue has attachments, `af jira get` SHALL print an `## Attachments (<n>)` section after the Remote Links section and before the Custom Fields section. The section SHALL be a table with the columns ID, Filename, Size, Type and Added, followed by a line naming `af jira download <KEY>`. When the issue has no attachments, the section SHALL be omitted. In a table cell, a `|` in a filename SHALL be written as `\|`, and control characters SHALL be displayed as `_`. The attachments SHALL come from the issue response that `get` already fetches, so no request is added. `af jira get --json` output SHALL be unchanged.

#### Scenario: Issue with attachments

- **GIVEN** issue MR-4 has attachment 10046 `image-20251217-080021.png` (26,904 bytes, `image/png`)
- **WHEN** the user runs `af jira get MR-4`
- **THEN** the output contains `## Attachments (1)` and a row with `10046`, `image-20251217-080021.png`, `26.3 KB` and `image/png`
- **AND** the section is followed by a line naming `af jira download MR-4`
- **AND** no request beyond those `get` already made is sent

#### Scenario: Issue without attachments

- **GIVEN** issue PROJ-1 has no attachments
- **WHEN** the user runs `af jira get PROJ-1`
- **THEN** the output contains no Attachments section

#### Scenario: A pipe in a filename does not break the table

- **GIVEN** issue PROJ-2 has an attachment named `a|b.txt`
- **WHEN** the user runs `af jira get PROJ-2`
- **THEN** the attachment's Filename cell reads `a\|b.txt`

#### Scenario: JSON output is unchanged

- **WHEN** the user runs `af jira get MR-4 --json`
- **THEN** the output is the issue as returned by the API, with its remote links, and its `fields.attachment` array is included unchanged

### Requirement: Strict option checking on Jira attachment commands

`af jira attachments` SHALL accept only `--json` and SHALL take one positional argument. `af jira download` SHALL accept only `--name`, `--out`, `--force` and `--json`, and SHALL take any number of positional arguments, whose forms the download requirement checks. `--force` SHALL take no value. An unknown option or an extra positional argument SHALL be reported as the prose commands report them: the error names the option or argument and the command, lists the accepted options, and suggests the intended option when the intent is clear. Either error SHALL exit with code 1 before any request is sent.

#### Scenario: A truncated option is rejected with a suggestion

- **WHEN** the user runs `af jira download MR-4 --nam '*.png'`
- **THEN** an error naming `--nam` and suggesting `--name` is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: An extra argument to attachments is rejected

- **WHEN** the user runs `af jira attachments MR-4 MR-5`
- **THEN** an error naming `MR-5` as an unexpected argument is printed
- **AND** the exit code is 1

#### Scenario: A value given to --force is rejected

- **WHEN** the user runs `af jira download MR-4 --out ./shots --force=yes`
- **THEN** an error saying `--force` does not take a value is printed
- **AND** the exit code is 1
