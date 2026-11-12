# atlassian-shared-config Specification

## Purpose

Shared authentication, ADF conversion, and configuration infrastructure used by both Jira and Confluence CLI commands.
## Requirements
### Requirement: Shared Atlassian authentication

The CLI SHALL provide shared authentication configuration for all Atlassian services.

#### Scenario: Configuration with ATLASSIAN variables

- **GIVEN** environment has `ATLASSIAN_BASE_URL`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_API_TOKEN`
- **WHEN** any Atlassian command is executed
- **THEN** authentication uses the `ATLASSIAN_*` values

#### Scenario: Fallback to JIRA variables

- **GIVEN** environment has `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN`
- **AND** `ATLASSIAN_*` variables are not set
- **WHEN** any Atlassian command is executed
- **THEN** authentication uses the `JIRA_*` values

#### Scenario: ATLASSIAN variables take precedence

- **GIVEN** environment has both `ATLASSIAN_*` and `JIRA_*` variables set
- **WHEN** any Atlassian command is executed
- **THEN** the `ATLASSIAN_*` values are used

#### Scenario: Missing credentials error

- **GIVEN** neither `ATLASSIAN_*` nor `JIRA_*` variables are set
- **WHEN** an Atlassian command is executed
- **THEN** an error is displayed listing the required `ATLASSIAN_*` variables
- **AND** the error mentions all three legacy `JIRA_*` variable names as alternatives

### Requirement: Shared ADF conversion

The CLI SHALL provide shared ADF (Atlassian Document Format) converters used by both Jira and Confluence: `textToAdf()` converts markdown to ADF, and `adfToText()` converts ADF to markdown.

`textToAdf()` SHALL parse its input as GitHub-flavored markdown, with block structure following CommonMark. It SHALL recognize headings, paragraphs, nested lists, fenced and indented code blocks, blockquotes, horizontal rules, emphasis, code spans, links, URLs in angle brackets, and the GitHub-flavored extensions for tables, strike-through (`~~text~~`), task list items and bare URLs. It SHALL map the result to ADF that validates against the published ADF JSON schema, and SHALL apply these policies:

- A single newline inside a paragraph is a hard break.
- Raw HTML is kept as literal text and never dropped.
- The `code` mark is combined only with `link`.
- Nested blockquotes, and blockquotes inside list items, are flattened into their parent.
- A heading, rule or table that ADF does not allow at its position, such as inside a list item or blockquote, becomes a paragraph that keeps its text.
- Task list items become list items prefixed with a ballot box, not ADF task items.
- No text node is empty.

It SHALL keep every guarantee of the **Robust markdown input for ADF conversion** requirement.

`adfToText()` SHALL render as markdown the following:

- headings, paragraphs, nested lists, task items, code blocks, blockquotes, rules and tables;
- inline marks;
- mentions, emoji and inline cards.

It SHALL NOT drop the text of nodes it does not recognize, and SHALL NOT throw on unexpected input.

#### Scenario: Markdown to ADF conversion

- **GIVEN** markdown text with headings, lists, bold, italic, code, and links
- **WHEN** `textToAdf()` is called
- **THEN** a valid ADF document is returned with corresponding node types

#### Scenario: ADF to markdown conversion

- **GIVEN** a valid ADF document
- **WHEN** `adfToText()` is called
- **THEN** markdown text is returned preserving headings, lists, and inline formatting

#### Scenario: Null or undefined ADF input

- **GIVEN** null or undefined input
- **WHEN** `adfToText()` is called
- **THEN** an empty string is returned

#### Scenario: Fenced code block with language

- **GIVEN** markdown text containing a fenced block opened with ` ```typescript ` and closed with ` ``` `
- **WHEN** `textToAdf()` is called
- **THEN** the result contains a `codeBlock` node whose `attrs.language` is `"typescript"`
- **AND** the body text is preserved verbatim with original line breaks

#### Scenario: Fenced code block without language

- **GIVEN** markdown text containing a fenced block opened with ` ``` ` (no language tag)
- **WHEN** `textToAdf()` is called
- **THEN** the result contains a `codeBlock` node whose `attrs` does not include a `language` field

#### Scenario: Code block contents are not parsed as other block types

- **GIVEN** a fenced code block whose body contains a line beginning with `- `, `* `, `1. `, or `# `
- **WHEN** `textToAdf()` is called
- **THEN** the body is preserved verbatim inside a single `codeBlock` node
- **AND** no `bulletList`, `orderedList`, or `heading` node is emitted for those lines

#### Scenario: Unterminated fence consumes to end of input

- **GIVEN** markdown text with an opening ` ``` ` and no closing fence
- **WHEN** `textToAdf()` is called
- **THEN** all remaining lines are emitted as the body of a single `codeBlock` node

#### Scenario: Fence directly after a paragraph line

- **GIVEN** the markdown `Here is the fix:`, then on the next line a fence opened with ` ```ts `, the line `const retries = 3;`, and a closing ` ``` `, with no blank line between them
- **WHEN** `textToAdf()` is called
- **THEN** the result is a paragraph with the text `Here is the fix:` followed by a `codeBlock` whose `attrs.language` is `"ts"` and whose body is `const retries = 3;`
- **AND** no text node contains a backtick

#### Scenario: Fence variants and info strings

- **GIVEN** fenced blocks opened with `~~~`, with four backticks around inner ` ``` ` lines, indented under a numbered list item, and with the info strings `c++`, `objective-c`, and `ts title="retry.ts"`
- **WHEN** `textToAdf()` is called
- **THEN** each becomes a `codeBlock`, and the one under the list item is inside that `listItem`
- **AND** `attrs.language` is the first word of the info string: `"c++"`, `"objective-c"`, and `"ts"`
- **AND** the inner ` ``` ` lines of the four-backtick fence are part of its body

#### Scenario: Blockquote conversion

- **GIVEN** markdown text containing one or more consecutive lines beginning with `>` whose bodies are plain text, with no bare `>` line between them
- **WHEN** `textToAdf()` is called
- **THEN** the result contains a `blockquote` node wrapping a single `paragraph` that holds the line bodies in order, separated by `hardBreak` nodes
- **AND** when a quoted line starts a list or a fenced code block, as in `> Reviewer said:` followed by `> - rename the flag`, that block is kept as a `bulletList`, `orderedList`, or `codeBlock` inside the same `blockquote`, after the paragraph

#### Scenario: Nested blockquotes are flattened

- **GIVEN** the markdown `> outer` followed by `>> inner`
- **WHEN** `textToAdf()` is called
- **THEN** the result is one `blockquote` containing a paragraph `outer` and a paragraph `inner`
- **AND** no `blockquote` node contains another `blockquote`

#### Scenario: Horizontal rule conversion

- **GIVEN** a line of three or more `-`, `*`, or `_` characters, optionally separated by spaces, that starts the document or follows a blank line, outside any code block, list item or blockquote
- **WHEN** `textToAdf()` is called
- **THEN** the result contains a `rule` node at that position
- **AND** a `***` or `___` line directly under a paragraph line also ends that paragraph and becomes a `rule`

#### Scenario: Setext headings

- **GIVEN** the markdown `Summary`, `---`, `Everything passed.` on three consecutive lines
- **WHEN** `textToAdf()` is called
- **THEN** the result is a level-2 `heading` with the text `Summary` followed by a paragraph `Everything passed.`
- **AND** no `rule` node is emitted
- **AND** a line of `===` directly under a text line likewise makes that line a level-1 `heading`
- **AND** when the text above the underline spans several lines, as in `Summary of the fix`, `and its rollout`, `---`, the heading holds all of them, separated by `hardBreak` nodes

#### Scenario: Heading syntax variants

- **GIVEN** the lines `## Summary ##`, `   ### Indented` (three leading spaces), and `#123 is fixed`, each separated by a blank line
- **WHEN** `textToAdf()` is called
- **THEN** the first is a level-2 `heading` whose text is `Summary`, without the closing `#` characters
- **AND** the second is a level-3 `heading` whose text is `Indented`
- **AND** the third is a paragraph whose text is `#123 is fixed`

#### Scenario: Nested lists

- **GIVEN** the markdown `- Backend`, `  - fixed auth refresh`, `- Frontend` on consecutive lines
- **WHEN** `textToAdf()` is called
- **THEN** the result is one `bulletList` with two `listItem` nodes
- **AND** the first `listItem` contains a paragraph `Backend` followed by a nested `bulletList` whose single item holds the paragraph `fixed auth refresh`
- **AND** bullets indented under a numbered item (`1. Setup` followed by `    - install deps`) form a `bulletList` inside that `orderedList` item

#### Scenario: Ordered list start number

- **GIVEN** the markdown `3. third` followed by `4. fourth`
- **WHEN** `textToAdf()` is called
- **THEN** the result is an `orderedList` whose `attrs.order` is `3`
- **AND** an ordered list that starts at 1 carries no `order` attribute
- **AND** in `1. Install:`, a blank line, an unindented fenced block, a blank line, `2. Test:`, the second `orderedList` has `attrs.order` `2`

#### Scenario: GFM table

- **GIVEN** the markdown `CI summary:` directly followed by the table rows `| Job | Status |`, `|:----|:------:|`, and ``| `lint` | **pass** |``
- **WHEN** `textToAdf()` is called
- **THEN** the result is a paragraph `CI summary:` followed by a `table` node
- **AND** the first `tableRow` holds `tableHeader` cells with the texts `Job` and `Status`
- **AND** the second `tableRow` holds `tableCell` cells whose texts are `lint` with the `code` mark and `pass` with the `strong` mark
- **AND** every cell holds exactly one `paragraph`, an empty cell holds an empty paragraph, and an escaped `\|` in a cell is a literal `|`

#### Scenario: Strike-through text

- **GIVEN** the markdown `The fix is ~~a retry~~ a lock.`
- **WHEN** `textToAdf()` is called
- **THEN** the text `a retry` carries the `strike` mark
- **AND** no text node contains `~~`

#### Scenario: Inline marks nest

- **GIVEN** the markdown `This is ***critical***.` and, separately, `**See [the runbook](https://example.com/runbook)**`
- **WHEN** `textToAdf()` is called
- **THEN** the text `critical` carries both `strong` and `em`
- **AND** the text `See ` carries `strong`, and the text `the runbook` carries `strong` and a `link` mark whose `href` is `https://example.com/runbook`
- **AND** no text node carries the same mark type twice

#### Scenario: The code mark combines only with link

- **GIVEN** the markdown ``**`af jira comment`** sends``, ``Note: **run `bun run test` before pushing**.``, and ``See [`adf.ts`](https://example.com/adf.ts).``
- **WHEN** `textToAdf()` is called
- **THEN** the text `af jira comment` carries only the `code` mark
- **AND** `run ` and ` before pushing` carry `strong`, while `bun run test` carries only `code`
- **AND** the text `adf.ts` carries `code` and a `link` mark to `https://example.com/adf.ts`
- **AND** no text node carries `code` together with any mark other than `link`

#### Scenario: Links, images, and bare URLs

- **GIVEN** the markdown `[Foo](https://en.wikipedia.org/wiki/Foo_(bar))`, `[docs](https://example.com "Docs")`, `![screenshot](https://example.com/shot.png)`, `Build log: https://ci.example.com/job/42 and <https://example.com/x>`, and `[](https://example.com/empty)`
- **WHEN** `textToAdf()` is called
- **THEN** the text `Foo` links to `https://en.wikipedia.org/wiki/Foo_(bar)`
- **AND** the text `docs` has a `link` mark whose `href` is `https://example.com` and whose `title` is `Docs`
- **AND** the image becomes the text `screenshot` with a `link` mark to `https://example.com/shot.png`, and no text node contains `!`
- **AND** both URLs in the `Build log:` line become text that links to itself
- **AND** the link with empty text becomes the text `https://example.com/empty`, linking to itself

#### Scenario: Single newlines are hard breaks

- **GIVEN** the markdown `**Status:** fixed` followed on the next line by `**PR:** 42`
- **WHEN** `textToAdf()` is called
- **THEN** the result is a single paragraph containing `Status:` with `strong`, the text ` fixed`, a `hardBreak`, `PR:` with `strong`, and the text ` 42`
- **AND** a `hardBreak` node never carries marks

#### Scenario: Raw HTML is kept as literal text

- **GIVEN** the markdown `Run af jira get <ISSUE-KEY>; it returns Promise<void>.`
- **WHEN** `textToAdf()` is called
- **THEN** the result is a paragraph whose text is exactly that line, including `<ISSUE-KEY>` and `Promise<void>`
- **AND** an HTML block such as `<details>` followed by `<summary>Full log</summary>` becomes a paragraph holding those lines as literal text separated by a `hardBreak`

#### Scenario: Task list items fall back to ballot boxes

- **GIVEN** the markdown `- [x] reproduce the bug` followed by `- [ ] write a regression test`
- **WHEN** `textToAdf()` is called
- **THEN** the result is a `bulletList` with two items whose paragraph texts are `☑ reproduce the bug` (U+2611 and a space) and `☐ write a regression test` (U+2610 and a space)
- **AND** no `taskList` or `taskItem` node is emitted

#### Scenario: Footnote syntax stays literal

- **GIVEN** the markdown `See note[^1].`, a blank line, and `[^1]: Source.`
- **WHEN** `textToAdf()` is called
- **THEN** the first paragraph's text is `See note[^1].` with no `link` mark
- **AND** a second paragraph has the text `[^1]: Source.`

#### Scenario: Content that ADF cannot nest is kept as text

- **GIVEN** a heading, a table, a horizontal rule, or a blockquote written inside a list item, or a heading, a table, or a horizontal rule written inside a blockquote
- **WHEN** `textToAdf()` is called
- **THEN** a heading becomes a paragraph with the heading's inline content
- **AND** a table or rule becomes a paragraph whose text is its markdown source, with lines separated by `hardBreak` nodes
- **AND** a blockquote inside a list item is flattened into the item's content
- **AND** no text is dropped and the document stays valid against the ADF JSON schema

#### Scenario: Output is valid ADF

- **GIVEN** any input in the converter regression corpus of agent-style markdown (`test/fixtures/adf-corpus.json`)
- **WHEN** `textToAdf()` is called
- **THEN** the document validates against the ADF JSON schema from `@atlaskit/adf-schema` 57.7.1 (`full.json`)
- **AND** no text node is empty, contains `\r`, or carries the same mark type twice
- **AND** the document's outline matches the expected outline recorded for that corpus case

#### Scenario: Mentions, emoji, and inline cards are rendered

- **GIVEN** an ADF paragraph containing a `mention` with `attrs.text` `@Jane Doe`, an `inlineCard` with `attrs.url` `https://example.atlassian.net/browse/PROJ-1`, and an `emoji` with `attrs.shortName` `:smile:` and no `attrs.text`
- **WHEN** `adfToText()` is called
- **THEN** the output contains `@Jane Doe`, `https://example.atlassian.net/browse/PROJ-1`, and `:smile:`
- **AND** a `mention` without `attrs.text` renders as `@` followed by its `attrs.id`

#### Scenario: Task items are rendered

- **GIVEN** an ADF `taskList` with a `TODO` item `write tests`, a `DONE` item `ship it`, and a nested `taskList` with a `TODO` item `nested task`
- **WHEN** `adfToText()` is called
- **THEN** the output contains the lines `- [ ] write tests` and `- [x] ship it`
- **AND** the nested item renders as `  - [ ] nested task`

#### Scenario: Tables are rendered as pipe tables

- **GIVEN** an ADF `table` whose header row holds `Suite` and `Result` and whose second row holds `a | b` and a cell with the paragraphs `line one` and `line two`
- **WHEN** `adfToText()` is called
- **THEN** the output is `| Suite | Result |`, then `| --- | --- |`, then `| a \| b | line one line two |`

#### Scenario: Nested lists, start numbers, and strike are rendered

- **GIVEN** an ADF `orderedList` with `attrs.order` `3`, whose first item holds the paragraph `third` and a nested `bulletList` item `child`, and whose second item holds `fourth`
- **AND** a paragraph whose text `gone` carries the `strike` mark
- **WHEN** `adfToText()` is called
- **THEN** the list renders as `3. third`, `   - child`, `4. fourth` on consecutive lines
- **AND** the paragraph renders as `~~gone~~`
- **AND** a `bulletList` directly followed by another `bulletList` renders the second with `*` markers, so `textToAdf()` reads back two lists

#### Scenario: Unrecognized nodes keep their text

- **GIVEN** an ADF document containing a `panel` with the paragraph `panel text`, a `decisionList` whose item reads `use marked`, and a `status` node with `attrs.text` `IN PROGRESS`
- **WHEN** `adfToText()` is called
- **THEN** the output contains `panel text`, `use marked`, and `IN PROGRESS`
- **AND** no error is thrown for missing or malformed `content`

#### Scenario: Paragraph text that looks like block syntax is escaped

- **GIVEN** an ADF paragraph whose text is `1. not a list`, and another whose text is `# not a heading`
- **WHEN** `adfToText()` is called
- **THEN** they render as `1\. not a list` and `\# not a heading`
- **AND** converting that output with `textToAdf()` yields paragraphs with the original texts

#### Scenario: Headings that ATX syntax cannot hold are rendered

- **GIVEN** an ADF level-2 heading holding `Summary`, a `hardBreak`, and `of the fix`, followed by a level-2 heading whose text is `C #`
- **WHEN** `adfToText()` is called
- **THEN** the first heading renders in setext form as the lines `Summary`, `of the fix`, and `---`, and the second renders as `## C \#`
- **AND** converting that output with `textToAdf()` yields the same two headings
- **AND** a level-3 heading holding `a`, a `hardBreak`, and `b` renders as `### a b`

#### Scenario: Round-trip of fence, blockquote, and rule

- **GIVEN** a markdown document containing a fenced code block with a language tag, a single-paragraph blockquote, and a horizontal rule
- **WHEN** the document is passed through `textToAdf()` then `adfToText()`
- **THEN** the resulting markdown is byte-equal to the input

#### Scenario: Round-trip of canonical markdown

- **GIVEN** a markdown document in the form `adfToText()` emits, containing:
    - ATX headings;
    - `-` bullets nested by two spaces;
    - numbered items starting at 3;
    - a fenced code block with a language tag;
    - a blockquote of two paragraphs separated by a bare `>` line;
    - a `---` rule after a blank line;
    - a pipe table with a `| --- |` delimiter row;
    - `**`, `*`, `~~`, backtick, and `[text](url)` marks.
- **WHEN** the document is passed through `textToAdf()` then `adfToText()`
- **THEN** the resulting markdown is byte-equal to the input

#### Scenario: Converter output survives a round trip

- **GIVEN** any input in the converter regression corpus (`test/fixtures/adf-corpus.json`)
- **WHEN** it is converted with `textToAdf()`, rendered with `adfToText()`, and converted with `textToAdf()` again
- **THEN** the second ADF document is deeply equal to the first

### Requirement: Trailing slash normalization

The shared configuration SHALL normalize the base URL.

#### Scenario: Trailing slash is stripped

- **GIVEN** `ATLASSIAN_BASE_URL` is set to `https://example.atlassian.net/`
- **WHEN** the configuration is loaded
- **THEN** `baseUrl` is `https://example.atlassian.net` (no trailing slash)

### Requirement: Plain-text request helper

The shared HTTP layer SHALL provide a `requestText()` function for Atlassian API endpoints that return non-JSON content (e.g. pipeline logs, pull request diffs).

#### Scenario: Returns body as string

- **GIVEN** an authenticated Atlassian endpoint that returns `text/plain`
- **WHEN** `requestText(url)` is called
- **THEN** the response body is returned as a string

#### Scenario: Authentication header is shared

- **WHEN** `requestText(url)` is called
- **THEN** the same Basic auth header used by `request<T>()` is sent

#### Scenario: Non-2xx response throws

- **GIVEN** an endpoint that responds with a 4xx or 5xx status
- **WHEN** `requestText(url)` is called
- **THEN** an error is thrown with a message derived from the response status and any error body

### Requirement: Cursor pagination helper

The shared HTTP layer SHALL provide a `paginate<T>()` async-iterable helper that walks Atlassian Cloud's `{values, next}` cursor pattern.

#### Scenario: Yields each value across pages

- **GIVEN** an endpoint whose first response is `{values: [a, b], next: "...page2"}`
- **AND** whose second response is `{values: [c, d]}` (no `next` field)
- **WHEN** `paginate<T>(url)` is iterated to completion
- **THEN** the iterator yields `a`, `b`, `c`, `d` in order

#### Scenario: Single-page response

- **GIVEN** an endpoint whose response is `{values: [a, b]}` with no `next`
- **WHEN** `paginate<T>(url)` is iterated to completion
- **THEN** the iterator yields `a`, `b` and terminates

#### Scenario: Empty response

- **GIVEN** an endpoint whose response is `{values: []}`
- **WHEN** `paginate<T>(url)` is iterated
- **THEN** the iterator terminates without yielding any value

#### Scenario: Authentication is shared with request

- **WHEN** `paginate<T>(url)` makes its underlying requests
- **THEN** each request uses the same Basic auth header as `request<T>()`

### Requirement: Robust markdown input for ADF conversion

The markdown→ADF converter `textToAdf()` SHALL return an ADF document for every input string and SHALL NOT run indefinitely. These guarantees apply to every caller, including Jira descriptions, comments, worklog and transition comments, and Confluence pages and comments. They hold whatever markdown features the converter otherwise supports.

Before interpreting markdown, the converter SHALL:

- treat CRLF (`\r\n`) and a lone CR (`\r`) as line endings equivalent to LF (`\n`);
- remove one byte-order mark (U+FEFF) at the very start of the input.

This normalization SHALL NOT change any other character. In particular, U+2028 and U+2029 SHALL NOT be treated as line endings.

Outside code blocks and HTML blocks, a line that begins with one to six `#` characters followed by a space, a tab or the end of the line SHALL become a heading of that level. Its text SHALL be the rest of the line, without leading and trailing spaces and tabs, and without a closing sequence of `#` characters if the converter recognizes CommonMark closing sequences. When that text is empty, the heading SHALL contain no text node.

Inside a blockquote, a bare quote line SHALL end the current paragraph instead of contributing a line body. A bare quote line is a `>` followed by nothing, or only by spaces and tabs. This refines the Blockquote conversion scenario of the Shared ADF conversion requirement: consecutive quoted lines that carry plain text SHALL still form one paragraph joined by hard breaks.

The output SHALL NOT contain a text node whose text is empty or contains a carriage return. A heading, a quoted paragraph or a list-item paragraph without text SHALL be emitted with empty content (`content: []`).

In the scenarios below:

- `\n`, `\r` and `\t` stand for the LF, CR and tab characters;
- `<U+XXXX>` stands for the character with that code point.

#### Scenario: Heading-like lines no longer hang

- **GIVEN** any of these inputs:
    - `## `, `#\t`, `## \r` and `## x\r`;
    - `## Summary\r\n\r\n- one\r\n- two\r\n`;
    - `intro\n## \noutro`;
    - `## a<U+2028>b`, `## Title<U+2028>`, `## a<U+2029>b` and `## Title<U+2029>`
- **WHEN** `textToAdf()` is called
- **THEN** it returns an ADF document instead of running indefinitely

#### Scenario: CRLF line endings

- **GIVEN** the input `## Summary\r\n\r\nFirst line\r\nsecond line\r\n\r\n- one\r\n- two\r\n`
- **WHEN** `textToAdf()` is called
- **THEN** the result is, in order:
    - a level-2 heading `Summary`;
    - a paragraph `First line`, `hardBreak`, `second line`;
    - a `bulletList` with the items `one` and `two`
- **AND** no text node contains `\r`

#### Scenario: Lone CR line endings

- **GIVEN** the input `## Summary\rBody`
- **WHEN** `textToAdf()` is called
- **THEN** the result is a level-2 heading `Summary` followed by a paragraph `Body`

#### Scenario: CRLF inside a fenced code block

- **GIVEN** the input ` ```ts\r\nconst a = 1;\r\nconst b = 2;\r\n```\r\n `
- **WHEN** `textToAdf()` is called
- **THEN** the result is one `codeBlock` whose `attrs.language` is `"ts"` and whose text is `const a = 1;\nconst b = 2;`

#### Scenario: Leading byte-order mark

- **GIVEN** the input `<U+FEFF>## Title\nbody`
- **WHEN** `textToAdf()` is called
- **THEN** the result is a level-2 heading `Title` followed by a paragraph `body`

#### Scenario: Only the first leading byte-order mark is removed

- **GIVEN** the input `<U+FEFF><U+FEFF>## Title`, or `a<U+FEFF>b`
- **WHEN** `textToAdf()` is called
- **THEN** every other byte-order mark is kept as text:
    - the first input gives a paragraph whose text is `<U+FEFF>## Title`;
    - the second gives a paragraph whose text is `a<U+FEFF>b`

#### Scenario: Very long lines still return a document

- **GIVEN** a single paragraph or quote line holding hundreds of thousands of inline marks, such as `*a* ` repeated 200,000 times
- **WHEN** `textToAdf()` is called
- **THEN** it returns an ADF document instead of throwing

#### Scenario: U+2028 and U+2029 are not line endings

- **GIVEN** a heading line whose text contains U+2028 or U+2029, such as `## a<U+2028>b` or `## Title<U+2029>`
- **WHEN** `textToAdf()` is called
- **THEN** the result is a single level-2 heading whose text is the rest of the line, unchanged: `a<U+2028>b` or `Title<U+2029>`

#### Scenario: Marker-only heading lines become empty headings

- **GIVEN** a line of one to six `#` characters followed by nothing or only by spaces and tabs, such as `#`, `## `, `#\t`, `###   ` or `######`
- **WHEN** `textToAdf()` is called
- **THEN** the result is a heading of that level with empty content (`content: []`)

#### Scenario: Heading text excludes surrounding spaces and tabs

- **GIVEN** the input `##   Title \t`
- **WHEN** `textToAdf()` is called
- **THEN** the result is a level-2 heading whose text is `Title`

#### Scenario: Hash runs that do not open a heading stay paragraph text

- **GIVEN** a line such as `#hashtag`, `#123`, `#######` (seven `#`) or `#<U+00A0>Title` (a non-breaking space after the `#`, not a space or tab)
- **WHEN** `textToAdf()` is called
- **THEN** the result is a paragraph whose text is the line, unchanged

#### Scenario: A heading line ends a paragraph

- **GIVEN** the input `intro\n#`
- **WHEN** `textToAdf()` is called
- **THEN** the result is a paragraph `intro` followed by a level-1 heading with empty content

#### Scenario: Bare quote line separates quoted paragraphs

- **GIVEN** the input `> a\n>\n> b` or `> a\n> \n> b`
- **WHEN** `textToAdf()` is called
- **THEN** the result is one `blockquote` containing two paragraphs, `a` and `b`

#### Scenario: Repeated and surrounding bare quote lines add no paragraphs

- **GIVEN** a quote with several bare lines between its paragraphs (`> a\n>\n>\n> b`), or one that starts and ends with a bare line (`>\n> a\n>`)
- **WHEN** `textToAdf()` is called
- **THEN** the bare lines produce no extra paragraphs:
    - the first input gives a `blockquote` with the paragraphs `a` and `b`;
    - the second gives a `blockquote` with the single paragraph `a`

#### Scenario: Quote of only bare lines

- **GIVEN** the input `>`, `> ` or `>\n>`
- **WHEN** `textToAdf()` is called
- **THEN** the result is one `blockquote` containing exactly one paragraph with empty content (`content: []`)

#### Scenario: Quoted lines with text still form one paragraph

- **GIVEN** the input `> line 1\n> line 2`
- **WHEN** `textToAdf()` is called
- **THEN** the result is one `blockquote` containing one paragraph: `line 1`, `hardBreak`, `line 2`

#### Scenario: Empty list item

- **GIVEN** the input `- `, `* ` or `1. `
- **WHEN** `textToAdf()` is called
- **THEN** the result is a list with one `listItem`, which contains one paragraph with empty content (`content: []`)
    - The list is a `bulletList` for `- ` and `* `, and an `orderedList` for `1. `.

#### Scenario: Empty list item between items

- **GIVEN** the input `- a\n- \n- b`
- **WHEN** `textToAdf()` is called
- **THEN** the result is one `bulletList` with three `listItem` nodes
    - Their paragraphs hold `a`, nothing (`content: []`) and `b`.

#### Scenario: No empty or CR-bearing text nodes

- **GIVEN** any input string, including every input in the scenarios of this requirement
- **WHEN** `textToAdf()` is called
- **THEN** every text node in the result has non-empty text that contains no `\r`

### Requirement: Attachment download to local files

The shared download helper (`atlassian/lib/download.ts`) SHALL implement the download behaviour that `af jira download` and `af confluence download` have in common.

**Destination.**

- Without `--out`, each run SHALL create a new, empty folder in the OS temporary directory, with a name starting with the prefix the command defines.
- `--out <dir>` SHALL write into that directory, creating it and any missing parents.
- No folder SHALL be created when no file will be written, either because nothing is selected or because `--out -` is given.

**Local filenames.** Each attachment's name from the metadata SHALL be turned into a single path component:

- normalized to Unicode NFC;
- with `/`, `\`, NUL and the other control characters (U+0001–U+001F and U+007F) replaced by `_`;
- replaced by `attachment-<id>` when the result is empty, `.` or `..`;
- when longer than 255 UTF-8 bytes, shortened in its stem while keeping its extension (the text after the last `.`, when at most 16 bytes), without splitting a character.

**Collisions.** Attachments SHALL be named in ascending order of their numeric ID: the Jira ID, or the digits of a Confluence `att…` ID. Two names that are equal after NFC normalization and lowercasing collide. The first attachment SHALL keep its name, and each later one SHALL get `-<id>` inserted before its extension. If that name is also taken, a counter SHALL follow (`-<id>-2`, and so on).

**Existing files with `--out <dir>`.** Before any download, every final path SHALL be inspected without following symlinks:

- nothing there: the file is downloaded;
- a regular file whose size equals the attachment's size: the file is skipped, and its status is `skipped`;
- any other entry (a regular file of a different size, a directory, a symlink, or any other file type): a conflict.

When there is any conflict, the command SHALL print every conflicting path, download nothing, and exit with code 1. With `--force`, every selected file SHALL be written, replacing a file or symlink at its path. A directory at a path SHALL still be an error. `--force` without `--out <dir>` SHALL be an argument error.

**Writing.**

- Each file SHALL be streamed into a temporary file in the destination directory. The temporary file is created exclusively (it fails when its path exists) and named `.af-<random>.part`.
- When the number of bytes written differs from the attachment's size in the metadata, the temporary file SHALL be deleted and the file SHALL fail with an error giving both numbers.
- Otherwise the temporary file SHALL be renamed onto the final name.
- On any error, the temporary file SHALL be deleted.

**Requests and credentials.**

- Every download URL SHALL start with the configured base URL.
- Redirects SHALL be followed by the helper, at most 5 hops, each `Location` resolved against the current URL.
- The `Authorization` header SHALL be sent only to URLs whose origin equals the base URL's origin. A hop to another origin SHALL be sent without it.
- More than 5 hops SHALL fail the file with an error.
- A non-2xx response SHALL fail the file with the API's error message, parsed as other Atlassian errors are, or with `HTTP <status>: <statusText>` when the body is not a recognized error.

**Phases and concurrency.**

- All metadata SHALL be fetched before any download. A metadata failure SHALL exit with code 1 before any folder is created or any file is downloaded.
- At most 4 metadata requests and at most 4 downloads SHALL be in flight at once.
- A failed download SHALL NOT stop the other downloads. When any file fails, the exit code SHALL be 1, and the files already written SHALL remain.

**Filtering.** `--name <pattern>` SHALL keep only the attachments whose whole metadata name matches the pattern, ignoring case. `*` matches any run of characters, `?` matches exactly one character, and every other character matches itself. When the selection is not empty but no attachment matches, the command SHALL print the available filenames and exit with code 1.

**Output.**

- The command SHALL print the folder's absolute path, then one line per file with its ID, its size and its absolute path, the path last. A skipped file SHALL be marked `(already present)`, and a failed file SHALL be reported on standard error with its reason.
- With `--json`, the command SHALL print `{ "directory", "files" }`. Each entry of `files` SHALL have `id`, `filename` (the metadata name), `path` (the absolute local path), `size`, `mimeType` and `status`, which is `downloaded`, `skipped` or `failed`. A failed entry SHALL also carry `error`.
- Notices and warnings SHALL go to standard error.

**Standard output.**

- `--out -` SHALL write the bytes of exactly one attachment to standard output, and nothing else.
- When the selection, after filtering, holds more or fewer than one attachment, the command SHALL say how many were selected and exit with code 1 before downloading.
- When the number of bytes written differs from the attachment's size in the metadata, the command SHALL report both numbers on standard error and exit with code 1.
- `--json` together with `--out -` SHALL be an argument error.

#### Scenario: Each run gets a fresh folder

- **GIVEN** `af jira download MR-10` has already run once
- **WHEN** the user runs `af jira download MR-10` again
- **THEN** a second, different folder is created in the OS temporary directory
- **AND** both runs print absolute paths inside their own folder

#### Scenario: A name with path separators stays inside the folder

- **GIVEN** an attachment's metadata name is `../../.zshrc`
- **WHEN** it is downloaded
- **THEN** it is written as `.._.._.zshrc` inside the destination folder
- **AND** nothing is written outside the destination folder

#### Scenario: A dot name falls back to the attachment ID

- **GIVEN** attachment 10050's metadata name is `..`
- **WHEN** it is downloaded
- **THEN** it is written as `attachment-10050`

#### Scenario: A long name keeps its extension

- **GIVEN** an attachment's metadata name is 300 ASCII characters ending in `.png`
- **WHEN** it is downloaded
- **THEN** its local name is at most 255 bytes long and ends in `.png`

#### Scenario: Names that differ only in case get the ID

- **GIVEN** attachment 10046 is named `Shot.png` and attachment 10047 is named `shot.png`
- **WHEN** both are downloaded in one run
- **THEN** they are written as `Shot.png` and `shot-10047.png`

#### Scenario: An existing file of the same size is skipped

- **GIVEN** `./shots/mobile-modules.png` exists with the attachment's size
- **WHEN** the user runs `af jira download MR-10 --out ./shots`
- **THEN** `mobile-modules.png` is not downloaded and is marked `(already present)`
- **AND** the other attachment is downloaded

#### Scenario: A conflicting file stops the run before any download

- **GIVEN** `./shots/mobile-modules.png` exists with a different size
- **WHEN** the user runs `af jira download MR-10 --out ./shots`
- **THEN** an error listing `./shots/mobile-modules.png` as a conflict is printed
- **AND** no attachment is downloaded
- **AND** the exit code is 1

#### Scenario: --force replaces existing files

- **GIVEN** `./shots/mobile-modules.png` exists with a different size
- **WHEN** the user runs `af jira download MR-10 --out ./shots --force`
- **THEN** `./shots/mobile-modules.png` holds the attachment's bytes

#### Scenario: A planted symlink is not written through

- **GIVEN** `./shots/mobile-modules.png` is a symlink to another file
- **WHEN** the user runs `af jira download MR-10 --out ./shots --force`
- **THEN** `./shots/mobile-modules.png` is a regular file holding the attachment's bytes
- **AND** the file the symlink pointed to is unchanged

#### Scenario: --force without --out is rejected

- **WHEN** the user runs `af jira download MR-10 --force`
- **THEN** an error saying `--force` needs `--out <dir>` is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: A short download leaves no file behind

- **GIVEN** the metadata says an attachment has 26,904 bytes and the server sends 1,000
- **WHEN** it is downloaded
- **THEN** an error giving both byte counts is printed
- **AND** neither the final file nor a temporary file exists in the destination folder
- **AND** the exit code is 1

#### Scenario: Credentials stay on the configured site

- **GIVEN** the download URL on the configured site answers with a redirect to `https://api.media.atlassian.com/file/…`
- **WHEN** the attachment is downloaded
- **THEN** the request to the configured site carries the `Authorization` header
- **AND** the request to `api.media.atlassian.com` carries no `Authorization` header

#### Scenario: Too many redirects

- **GIVEN** a download URL redirects 6 times
- **WHEN** the attachment is downloaded
- **THEN** that file fails with an error about too many redirects

#### Scenario: At most four downloads run at once

- **GIVEN** issue MR-1 has 12 attachments
- **WHEN** the user runs `af jira download MR-1`
- **THEN** no more than 4 downloads are in flight at any moment
- **AND** all 12 files are downloaded

#### Scenario: One failed download does not stop the others

- **GIVEN** issue MR-2 has two attachments and the content request for one of them fails
- **WHEN** the user runs `af jira download MR-2 --json`
- **THEN** the other attachment is downloaded
- **AND** the JSON lists one entry with status `downloaded` and one with status `failed` and an `error`
- **AND** the exit code is 1

#### Scenario: A pattern that matches nothing

- **GIVEN** issue MR-10 has attachments `mobile-modules.png` and `mobile-property-settings.png`
- **WHEN** the user runs `af jira download MR-10 --name '*.pdf'`
- **THEN** an error naming the pattern and listing `mobile-modules.png` and `mobile-property-settings.png` is printed
- **AND** no folder is created
- **AND** the exit code is 1

#### Scenario: Stream one attachment to standard output

- **WHEN** the user runs `af jira download 10046 --out -`
- **THEN** standard output receives exactly the attachment's bytes
- **AND** no folder is created

#### Scenario: Standard output needs exactly one attachment

- **GIVEN** issue MR-10 has two attachments
- **WHEN** the user runs `af jira download MR-10 --out -`
- **THEN** an error saying 2 attachments were selected and `--out -` takes one is printed
- **AND** nothing is downloaded
- **AND** the exit code is 1

#### Scenario: --json with standard output is rejected

- **WHEN** the user runs `af jira download 10046 --out - --json`
- **THEN** an argument error is printed
- **AND** the exit code is 1
- **AND** no request is sent

#### Scenario: JSON output

- **WHEN** the user runs `af jira download MR-10 --json`
- **THEN** standard output is a JSON object with the absolute `directory` and a `files` array
- **AND** each entry has `id`, `filename`, `path`, `size`, `mimeType` and `status`

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

