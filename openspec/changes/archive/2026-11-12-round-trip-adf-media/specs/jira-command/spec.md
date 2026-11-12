## ADDED Requirements

### Requirement: Embedded media in Jira output

`af jira get` (the description and comments) and `af jira comment <issue-key>` (the comment listing) SHALL render embedded images and files as `media:` references, as the shared requirement **ADF media nodes in markdown** specifies. Jira media nodes without `alt` SHALL render with an empty name. `--json` output SHALL be unchanged.

#### Scenario: An embedded screenshot appears in the issue view

- **GIVEN** issue MR-4's description ends with the bold paragraph `Screenshot:` and an embedded image with `alt: "image-20251217-080021.png"` and UUID `0ab844aa-b95b-46bd-9d6c-a7d69ac7b901`
- **WHEN** the user runs `af jira get MR-4`
- **THEN** the Description section ends with `**Screenshot:**`, a blank line, and `![image-20251217-080021.png](media:0ab844aa-b95b-46bd-9d6c-a7d69ac7b901)`

#### Scenario: Media in a comment appears in the comment listing

- **GIVEN** a comment on PROJ-1 holds an embedded image with `alt: "trace.png"`
- **WHEN** the user runs `af jira comment PROJ-1`
- **THEN** the comment's text contains `![trace.png](media:<id>)`

### Requirement: Embedded media kept on Jira updates

When `af jira update <issue-key>` is given `--description` or `--description-file`, the CLI SHALL fetch the current description with `GET /rest/api/3/issue/{key}?fields=description`. The fetch SHALL come after the argument checks and after the input is read, and before the update is sent. The CLI SHALL send the document that `textToAdfKeepingMedia(markdown, currentDescription)` returns. `af jira comment edit <issue-key> <id>` SHALL do the same with `GET /rest/api/3/issue/{key}/comment/{id}`.

When the result lists removed media, the CLI SHALL print a warning on standard error after the update succeeds. The warning SHALL name each removed image or file (or `media <uuid>` when its name is unknown) and say that the attachments are still on the issue. The exit code SHALL stay 0.

A failed fetch SHALL be reported as a request error, and nothing SHALL be written. Commands that create content (`create`, adding a comment, transition and worklog comments) SHALL send media nodes with default attributes and SHALL make no extra request. Comments sent with `--internal` or `--public` are text, not ADF, and SHALL be unaffected. An `update` that does not change the description SHALL NOT fetch it. With `--json`, the output SHALL be unchanged, and the warning SHALL still go to standard error.

#### Scenario: Editing the text keeps an embedded image exactly

- **GIVEN** MR-4's description holds `mediaSingle { layout: "align-start", width: 694, widthType: "pixel" }` with `media { type: "file", id: "0ab844aa-b95b-46bd-9d6c-a7d69ac7b901", collection: "", alt: "image-20251217-080021.png", width: 1916, height: 155 }`
- **AND** `edited.md` is the output of `af jira get MR-4`'s description with one sentence reworded and the `media:` line kept
- **WHEN** the user runs `af jira update MR-4 --description-file edited.md`
- **THEN** a GET of MR-4's description is sent before the PUT
- **AND** the PUT's description holds the same `mediaSingle` and `media` attributes as before
- **AND** no warning is printed

#### Scenario: Removing a media line warns

- **GIVEN** MR-4's description holds the embedded image `image-20251217-080021.png`
- **WHEN** the user runs `af jira update MR-4 --description "Fixed; screenshot no longer relevant"`
- **THEN** the description is updated
- **AND** a warning naming `image-20251217-080021.png` and saying the attachment is still on the issue is printed on standard error
- **AND** the exit code is 0

#### Scenario: Clearing the description warns

- **GIVEN** MR-4's description holds one embedded image
- **WHEN** the user runs `af jira update MR-4 --description ""`
- **THEN** the description is cleared
- **AND** a warning naming the image is printed on standard error

#### Scenario: Editing a comment keeps its embedded image

- **GIVEN** comment 10042 on PROJ-1 holds an embedded image with `layout: "wide"`
- **WHEN** the user runs `af jira comment edit PROJ-1 10042 --body-file edited.md`, where `edited.md` keeps the comment's `media:` line
- **THEN** `GET /rest/api/3/issue/PROJ-1/comment/10042` is sent before the PUT
- **AND** the PUT's body holds the image with `layout: "wide"`

#### Scenario: Updates that do not touch the description make no extra request

- **WHEN** the user runs `af jira update MR-4 --summary "New title"`
- **THEN** no GET of the description is sent

#### Scenario: Adding a comment makes no extra request

- **WHEN** the user runs `af jira comment PROJ-1 --body "See ![shot.png](media:0ab844aa-b95b-46bd-9d6c-a7d69ac7b901)"`
- **THEN** only the comment POST is sent
- **AND** its body holds a `mediaInline` with that UUID and `collection: ""`

#### Scenario: The warning does not disturb JSON output

- **GIVEN** MR-4's description holds one embedded image
- **WHEN** the user runs `af jira update MR-4 --description "Text only" --json`
- **THEN** standard output holds only the JSON result
- **AND** the warning is printed on standard error
