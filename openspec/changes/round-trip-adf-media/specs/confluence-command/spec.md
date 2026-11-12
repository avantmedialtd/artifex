## ADDED Requirements

### Requirement: Embedded media in Confluence output

`af confluence get` SHALL render embedded images and files as `media:` references, as the shared requirement **ADF media nodes in markdown** specifies. When any media node in the page body has no `alt`, the CLI SHALL fetch the page's attachments once and name each such node by the `title` of the attachment whose `fileId` equals the node's `id`. A node no attachment matches SHALL render with an empty name. When every media node has `alt`, or the body has no media, the attachments SHALL NOT be fetched. `af confluence comments` SHALL render media without fetching attachments. `--json` output SHALL be unchanged.

#### Scenario: An image without alt is named by its attachment

- **GIVEN** page 12345's body holds a `media` with `id` `7f1e…`, `collection: "contentId-12345"` and no `alt`
- **AND** the page's attachment `diagram.png` has `fileId` `7f1e…`
- **WHEN** the user runs `af confluence get 12345`
- **THEN** the page's attachments are fetched once
- **AND** the body contains `![diagram.png](media:7f1e…)`

#### Scenario: No lookup when every media node has alt

- **GIVEN** every media node in page 12345's body has `alt`
- **WHEN** the user runs `af confluence get 12345`
- **THEN** the page's attachments are not fetched

### Requirement: Embedded media kept on Confluence page updates

When `af confluence update <page-id>` is given `--body` or `--body-file`, the CLI SHALL send the document that `textToAdfKeepingMedia(markdown, currentBody, mediaNames)` returns. `currentBody` is the page body already fetched for the version number, so the document costs no extra request. When any media node in the current body has no `alt`, `mediaNames` SHALL map each attachment's `fileId` to its `title`, from one fetch of the page's attachments. Otherwise, the attachments SHALL NOT be fetched.

When the result lists removed media, the CLI SHALL print a warning on standard error after the update succeeds. The warning SHALL name each removed image or file and say that the attachments are still on the page. The exit code SHALL stay 0. `af confluence create` and `af confluence comment` SHALL send media nodes with default attributes and SHALL make no extra request.

#### Scenario: Editing a page keeps an image without alt exactly

- **GIVEN** page 12345's body holds a `mediaSingle` with a `media` whose `id` is `7f1e…`, with `collection: "contentId-12345"` and no `alt`
- **AND** the page's attachment `diagram.png` has `fileId` `7f1e…`
- **AND** `edited.md` is the output of `af confluence get 12345` with one paragraph reworded and the line `![diagram.png](media:7f1e…)` kept
- **WHEN** the user runs `af confluence update 12345 --body-file edited.md`
- **THEN** the PUT's body holds that `media` with `collection: "contentId-12345"` and no `alt`, and its `mediaSingle` keeps its attributes
- **AND** no warning is printed

#### Scenario: Removing an image from a page warns

- **GIVEN** page 12345's body holds the embedded image `diagram.png`
- **WHEN** the user runs `af confluence update 12345 --body "Text only"`
- **THEN** the page is updated
- **AND** a warning naming `diagram.png` and saying the attachment is still on the page is printed on standard error
- **AND** the exit code is 0
