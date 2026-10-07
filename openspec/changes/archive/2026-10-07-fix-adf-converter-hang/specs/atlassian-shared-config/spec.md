## ADDED Requirements

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
