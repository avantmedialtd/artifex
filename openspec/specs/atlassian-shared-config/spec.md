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

