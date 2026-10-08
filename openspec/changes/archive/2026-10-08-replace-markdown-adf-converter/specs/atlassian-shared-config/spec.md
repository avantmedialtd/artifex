## MODIFIED Requirements

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
