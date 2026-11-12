## ADDED Requirements

### Requirement: ADF media nodes in markdown

`adfToText()` SHALL render media nodes as `media:` references, and `textToAdf()` SHALL read those references back as media nodes. A reference is valid when its URL is `media:` followed by a UUID matching `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, ignoring case. The UUID SHALL be kept as written.

**Rendering.** `adfToText()` SHALL render:

- a `mediaSingle` whose `media` is a file as its own block `![<name>](media:<id>)`, with the plain text of its `caption`, when not empty, as the image title (`![<name>](media:<id> "<caption>")`);
- a `mediaGroup` as one block with one `[<name>](media:<id>)` line per `media`;
- a `mediaInline` as `[<name>](media:<id>)` in place;
- a `media` of type `external` as `![<alt>](<url>)`.

`<name>` SHALL be the node's `alt` when it is not empty, else the name an optional `mediaNames` map (from UUID to name) gives for its `id`, else empty. Names and captions SHALL be escaped so that they read back unchanged. A media node with neither a usable `id` nor a `url` SHALL render as its `alt` text, or as nothing. `adfToText()` SHALL accept the `mediaNames` map as an optional second argument, and SHALL NOT throw on any media input.

**Parsing.** `textToAdf()` SHALL map:

- a paragraph whose only content, apart from whitespace, is one image with a valid reference to `mediaSingle { layout: "center" }` holding `media { type: "file", id, collection: "" }`. The node SHALL have an `alt` equal to the alt text when that is not empty, and a `caption` holding the title text when there is a title;
- a paragraph whose only content is one or more links with valid references, separated by whitespace or line breaks, to a `mediaGroup` with one `media { type: "file", id, collection: "" }` per link, each with an `alt` equal to its link text when that is not empty;
- a link or image with a valid reference among other inline content to `mediaInline { type: "file", id, collection: "" }`, with an `alt` equal to its text when that is not empty.

A `media:` URL that is not a valid reference SHALL become its alt text or link text, or the URL when that is empty, as plain text with no `link` mark. A valid reference where ADF allows no media (in a heading, or inside the text of another link) SHALL become its text, with the marks it would otherwise carry. Media blocks SHALL be produced in the document, in blockquotes, in list items (images only, since ADF allows no `mediaGroup` there) and, for a cell whose only content is a media image, in table cells. Images and links with any other URL SHALL convert as before, and markdown that contains no `media:` URL SHALL produce the same ADF as before. Every document either function produces SHALL validate against the published ADF JSON schema.

#### Scenario: An embedded image renders as a media reference

- **GIVEN** a document with a paragraph `Screenshot:` (in bold), followed by `mediaSingle { layout: "align-start", width: 694, widthType: "pixel" }` holding `media { type: "file", id: "0ab844aa-b95b-46bd-9d6c-a7d69ac7b901", collection: "", alt: "image-20251217-080021.png", width: 1916, height: 155 }`
- **WHEN** `adfToText()` is called
- **THEN** the output is `**Screenshot:**`, a blank line, and `![image-20251217-080021.png](media:0ab844aa-b95b-46bd-9d6c-a7d69ac7b901)`

#### Scenario: A caption becomes the image title

- **GIVEN** a `mediaSingle` whose `media` has `alt: "flow.png"` and whose `caption` holds the text `Login flow`
- **WHEN** `adfToText()` is called
- **THEN** the image renders as `![flow.png](media:<id> "Login flow")`

#### Scenario: File cards render one per line

- **GIVEN** a `mediaGroup` with two `media` nodes, named `report.pdf` and `data.csv` by their `alt`
- **WHEN** `adfToText()` is called
- **THEN** the output is `[report.pdf](media:<id1>)` and `[data.csv](media:<id2>)` on consecutive lines

#### Scenario: A name comes from mediaNames when alt is absent

- **GIVEN** a `media` with no `alt` and `id` `7f1e…`, and a `mediaNames` map from `7f1e…` to `diagram.png`
- **WHEN** `adfToText(doc, { mediaNames })` is called
- **THEN** the image renders as `![diagram.png](media:7f1e…)`

#### Scenario: A name with a bracket survives the round trip

- **GIVEN** a `mediaSingle` whose `media` has `alt: "a]b.png"`
- **WHEN** `adfToText()` is called and its output is passed to `textToAdf()`
- **THEN** the resulting `media` has `alt: "a]b.png"`

#### Scenario: A media reference reads back as an embedded image

- **WHEN** `textToAdf()` is called with `![shot.png](media:0ab844aa-b95b-46bd-9d6c-a7d69ac7b901)` as its own paragraph
- **THEN** the document holds `mediaSingle { layout: "center" }` with `media { type: "file", id: "0ab844aa-b95b-46bd-9d6c-a7d69ac7b901", collection: "", alt: "shot.png" }`
- **AND** the document validates against the ADF schema

#### Scenario: Media links on consecutive lines read back as file cards

- **WHEN** `textToAdf()` is called with `[report.pdf](media:<id1>)` and `[data.csv](media:<id2>)` on consecutive lines of one paragraph
- **THEN** the document holds one `mediaGroup` with two `media` nodes, in that order

#### Scenario: A media link inside a sentence reads back as an inline file

- **WHEN** `textToAdf()` is called with `See [report.pdf](media:<id>) for details`
- **THEN** the paragraph holds the text `See `, a `mediaInline` with `id` `<id>` and `alt: "report.pdf"`, and the text ` for details`

#### Scenario: An invalid media reference stays text

- **WHEN** `textToAdf()` is called with `![shot](media:not-a-uuid)`
- **THEN** the paragraph holds the text `shot` with no `link` mark
- **AND** the document contains no media node

#### Scenario: A media reference in a heading stays text

- **WHEN** `textToAdf()` is called with `## Result ![shot](media:0ab844aa-b95b-46bd-9d6c-a7d69ac7b901)`
- **THEN** the heading holds the text `Result shot`, and the document contains no media node

#### Scenario: An https image is still a link

- **WHEN** `textToAdf()` is called with `![screenshot](https://example.com/shot.png)`
- **THEN** the image becomes the text `screenshot` with a `link` mark to `https://example.com/shot.png`

### Requirement: Media attributes restored from the current document

The shared converters SHALL provide `reconcileMedia(next, current, mediaNames?)`, a pure function that restores media presentation from the document currently stored on the server. It SHALL return the reconciled document, the media removed from `current`, and the media in `next` that `current` does not have.

- Each media node of `current` (`media` in a `mediaSingle` or `mediaGroup`, and `mediaInline`) SHALL be indexed by `attrs.id`, the first occurrence winning, together with its parent `mediaSingle`'s attributes and `caption`.
- For each media node of `next` whose `id` is indexed:
    - its attributes SHALL be replaced by the indexed node's attributes, limited to those its node type allows, and its marks by the indexed node's marks;
    - when its alt text equals the name `adfToText()` would show for the indexed node (its `alt`, else its `mediaNames` name, else empty), the indexed `alt` SHALL be kept exactly, including when it is absent. Otherwise `alt` SHALL be its own alt text, or SHALL be removed when that is empty;
    - when both it and the indexed node are in a `mediaSingle`, its parent's attributes and marks SHALL be replaced by the indexed parent's;
    - when its caption text equals the plain text of the indexed `caption`, the indexed `caption` node SHALL be used. When it has no caption, the result SHALL have none.
- A media node of `next` whose `id` is not indexed SHALL keep its attributes and SHALL be listed as not found.
- Each indexed `id` that does not occur in `next` SHALL be listed as removed, with the name `adfToText()` would show for it.
- Malformed nodes SHALL be left unchanged, and the function SHALL NOT throw.

`textToAdfKeepingMedia(markdown, current, mediaNames?)` SHALL return `reconcileMedia(textToAdf(markdown), current, mediaNames)`.

#### Scenario: An untouched image comes back exactly

- **GIVEN** `current` is the MR-4 description from the rendering scenario, with `mediaSingle { layout: "align-start", width: 694, widthType: "pixel" }` and `media { …, width: 1916, height: 155 }`
- **WHEN** `textToAdfKeepingMedia(adfToText(current), current)` is called
- **THEN** the resulting `mediaSingle` and `media` nodes deep-equal those in `current`
- **AND** nothing is listed as removed or not found

#### Scenario: A moved image keeps its presentation

- **GIVEN** the same `current`
- **WHEN** the markdown moves the image line above the `**Screenshot:**` paragraph and `textToAdfKeepingMedia()` is called
- **THEN** the `mediaSingle` now comes first and keeps `layout: "align-start"`, `width: 694` and `widthType: "pixel"`

#### Scenario: Changed alt text is kept

- **GIVEN** the same `current`
- **WHEN** the markdown changes the alt text to `Header layout bug`
- **THEN** the `media` has `alt: "Header layout bug"` and every other attribute from `current`

#### Scenario: An alt equal to the looked-up name stays absent

- **GIVEN** `current` holds a `media` with `id` `7f1e…`, `collection: "contentId-12345"` and no `alt`, and `mediaNames` maps `7f1e…` to `diagram.png`
- **WHEN** `textToAdfKeepingMedia("![diagram.png](media:7f1e…)", current, mediaNames)` is called
- **THEN** the resulting `media` has no `alt` and has `collection: "contentId-12345"`

#### Scenario: An unchanged caption keeps its formatting

- **GIVEN** `current` holds a captioned image whose caption is `Login` in bold followed by ` flow`
- **WHEN** the markdown keeps the image with the title `Login flow`
- **THEN** the resulting `caption` node is the one from `current`, with its bold mark

#### Scenario: A removed image is listed

- **GIVEN** the MR-4 `current`
- **WHEN** `textToAdfKeepingMedia("Only text now", current)` is called
- **THEN** the result lists `image-20251217-080021.png` (UUID `0ab844aa-b95b-46bd-9d6c-a7d69ac7b901`) as removed

#### Scenario: An image from elsewhere is listed as not found

- **GIVEN** `current` has no media node with UUID `11111111-2222-3333-4444-555555555555`
- **WHEN** the markdown contains `![x.png](media:11111111-2222-3333-4444-555555555555)`
- **THEN** that `media` keeps `layout: "center"` on its `mediaSingle` and `collection: ""`
- **AND** the UUID is listed as not found

#### Scenario: A malformed current document does not throw

- **GIVEN** `current` holds a `media` node with no `attrs`
- **WHEN** `reconcileMedia()` is called
- **THEN** it returns without throwing
- **AND** that node is not used to restore any other node
