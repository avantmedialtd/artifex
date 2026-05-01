# Fix ADF code fence support

## Why

The shared `textToAdf()` converter does not recognize fenced code blocks (` ``` `), so any markdown containing code samples is shredded when posted to Jira or Confluence. Lines inside a fence get reinterpreted as paragraphs, and any line starting with `-`, `*`, or `1.` becomes an accidental bullet/numbered list. Reading works fine (`adfToText()` already emits fences from `codeBlock` nodes), but the write path silently corrupts user input. Blockquotes and horizontal rules suffer the same write-side gap, breaking round-trips through `adfToText → textToAdf`.

## What Changes

- `textToAdf()` recognizes fenced code blocks (` ``` ` only, optionally with a language tag) and emits ADF `codeBlock` nodes
- `textToAdf()` recognizes blockquote lines (`> `) and emits ADF `blockquote` nodes
- `textToAdf()` recognizes horizontal rules (lines that are exactly `---` or `***`, with optional surrounding whitespace) and emits ADF `rule` nodes
- The fence parser runs before list/heading checks so that code-block content containing `-`, `*`, `#`, or `1.` is preserved verbatim
- Unterminated fences consume to end-of-input rather than raising an error

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `atlassian-shared-config`: the "Shared ADF conversion" requirement gains scenarios for fenced code blocks, blockquotes, and horizontal rules in the markdown→ADF direction

## Impact

- **Code**: `atlassian/lib/adf.ts` (`textToAdf` only — `adfToText` already handles these block types), `atlassian/lib/adf.test.ts` (new test cases)
- **APIs**: no signature changes — `textToAdf(text: string): AdfDocument` is unchanged
- **Consumers**: `af jira create/update/comment` and `af confluence create/update/comment` immediately render code samples, blockquotes, and rules correctly without any caller changes
- **Out of scope** (deliberately deferred): tilde fences (` ~~~ `), indented code blocks (4-space), nested lists, tables, nested blockquotes
