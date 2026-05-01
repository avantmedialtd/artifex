## MODIFIED Requirements

### Requirement: Shared ADF conversion

The CLI SHALL provide shared ADF (Atlassian Document Format) converters used by both Jira and Confluence. The markdown→ADF converter SHALL recognize fenced code blocks, blockquotes, and horizontal rules in addition to headings, lists, paragraphs, and inline marks.

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

#### Scenario: Blockquote conversion

- **GIVEN** markdown text containing one or more consecutive lines beginning with `> `
- **WHEN** `textToAdf()` is called
- **THEN** the result contains a `blockquote` node wrapping a single `paragraph` whose text is the concatenation of the line bodies

#### Scenario: Horizontal rule conversion

- **GIVEN** markdown text containing a line that is exactly `---` or `***` (with optional surrounding whitespace)
- **WHEN** `textToAdf()` is called
- **THEN** the result contains a `rule` node at that position

#### Scenario: Round-trip of fence, blockquote, and rule

- **GIVEN** a markdown document containing a fenced code block with a language tag, a single-paragraph blockquote, and a horizontal rule
- **WHEN** the document is passed through `textToAdf()` then `adfToText()`
- **THEN** the resulting markdown is byte-equal to the input
