# Design: Fix ADF code fence support

## Context

`atlassian/lib/adf.ts` exports a hand-rolled markdown→ADF parser (`textToAdf`) and ADF→markdown renderer (`adfToText`) shared by the Jira and Confluence commands. The two directions diverged: `adfToText` emits `codeBlock`, `blockquote`, and `rule` nodes, but `textToAdf` only recognizes headings, bullet/ordered lists, and paragraphs. Anything else falls into the paragraph branch — which is line-by-line, with no awareness of multi-line block syntax.

Concrete failure: a fenced code block whose body contains `- foo` is split into a paragraph holding `` ```lang `` and the first code line, then a `bulletList` containing `foo`, then a paragraph holding the closing `` ``` ``. The `parseInlineMarkdown` regex also chews on the leading triple-backtick because `` `(.+?)` `` greedily matches the first two backticks as inline code.

The parser was hand-rolled (no markdown library dependency) presumably to keep the bundle small and avoid pulling a CommonMark stack into the CLI. We preserve that constraint.

## Goals / Non-Goals

**Goals:**

- `textToAdf` produces ADF `codeBlock` nodes for fenced code blocks (` ``` `), preserving body content verbatim
- `textToAdf` produces ADF `blockquote` nodes for `> ` lines
- `textToAdf` produces ADF `rule` nodes for horizontal rule lines (`---` / `***`)
- `adfToText(textToAdf(x)) === x` round-trips for all three new block types in their canonical form
- Existing behavior for headings, lists, paragraphs, and inline marks is unchanged
- No new runtime dependencies

**Non-Goals:**

- Tilde fences (` ~~~ `) — backticks only
- Indented code blocks (4-space indent)
- Nested lists, nested blockquotes, lazy-continuation blockquotes
- Tables, footnotes, definition lists, setext headings
- Replacing the hand-rolled parser with a library
- Strict CommonMark conformance — we match what users actually write

## Decisions

### D1: Hand-roll the new block parsers; no markdown library

**Choice:** Add ~30 lines of line-loop branches to `textToAdf` for fence / blockquote / rule.

**Alternative considered:** Pull in `marked` or `remark` and map the AST to ADF. Rejected because (a) it's a meaningfully larger surface area, (b) it would re-shape the entire parser, not just plug the gap, and (c) it would kill the rationale for `adfToText` being hand-rolled too. Worth revisiting only if we accumulate two or three more "missing block type" bugs.

### D2: Fence parser runs before list and heading checks

**Choice:** In the line loop, the fence branch is the first block-type check.

**Rationale:** A fence's body must be opaque to other block parsers. If `- item` inside a fence is checked against the bullet-list regex first, the fence is destroyed. Heading and list checks must only see lines outside fences.

**Alternative considered:** A two-pass approach (extract fences first, then run the existing parser on the rest). Rejected as more complex than just reordering branches.

### D3: Unterminated fences consume to EOF

**Choice:** If no closing ` ``` ` is found, treat all remaining lines as code.

**Rationale:** Matches CommonMark §4.5 ("If the end of the containing block (or document) is reached and no closing code fence has been found, the code block contains all of the lines after the opening code fence until the end of the containing block"). Lenient, predictable, and avoids surfacing parse errors to end users who probably just forgot to close a fence.

### D4: Fence regex — opening and closing

**Choice:**

- Opening: `/^```(\w*)\s*$/` — three backticks at column 0, optional language tag of word characters, optional trailing whitespace
- Closing: `/^```\s*$/` — three backticks at column 0, optional trailing whitespace, no info string allowed

**Rationale:** Matches CommonMark behavior closely enough for our inputs while keeping the regex trivial. We deliberately do not support fences indented up to 3 spaces or info strings beyond a single language token — neither has appeared in real usage of the CLI.

### D5: Code block content is a single text node

**Choice:** Emit `{ type: 'codeBlock', attrs: language ? { language } : {}, content: [{ type: 'text', text: lines.join('\n') }] }`.

**Rationale:** Mirrors what `adfToText` expects (line 254 reads `node.content?.map(convertInlineNode).join('')`). No inline markdown parsing inside the body — backticks, asterisks, etc. must remain literal.

**Edge case:** Empty fence body emits `content: []` (no text node) to avoid an ADF `text` node with an empty string, which is invalid.

### D6: Blockquote is single-level, paragraph-only

**Choice:** Consecutive `> ` lines collapse into one `blockquote` containing one `paragraph`. Multi-line bodies use `hardBreak` between lines, mirroring how `textToAdf` already builds multi-line paragraphs.

**Rationale:** Round-trip parity with `adfToText`'s blockquote renderer (lines 258-264), which prefixes every line with `> ` regardless of the inner block structure. Nested blockquotes and blockquote-containing-list are out of scope per non-goals.

### D7: Horizontal rule recognizes `---` and `***` only

**Choice:** Match `/^(-{3,}|\*{3,})\s*$/` as a standalone line.

**Rationale:** Covers what `adfToText` emits (`---`) plus the most common alternative. Underscores (`___`) and indented variants are rare enough to skip.

## Risks / Trade-offs

- **[Risk]** Fence detection runs before existing block checks → if the new branch's regex is wrong, list/heading detection could be skipped for non-fence input. **Mitigation:** Tight regex anchored at line start, plus an explicit test that a line starting with three backticks but not matching the fence pattern (e.g., `` ``code`` ``) falls through to the paragraph branch.
- **[Risk]** Inline-mark parser mishandles content that already contains backticks if we ever pass code body through it. **Mitigation:** Code-block body bypasses `parseInlineMarkdown` entirely (D5).
- **[Risk]** Unterminated fence silently swallows the rest of the document, which could surprise a user who genuinely meant the ` ``` ` to be inline literal text. **Mitigation:** Documented behavior; matches CommonMark; users typing literal triple-backticks outside of code is vanishingly rare.
- **[Trade-off]** Hand-rolled approach means the next missing block type (tables, nested lists, indented code) will require yet another targeted patch. Accepted — we'll revisit a library swap if/when that backlog grows.
- **[Trade-off]** The fence regex requires the opening line to be exactly ` ```lang ` with no other content. Real-world markdown often allows ` ``` lang ` with leading space; we don't. Acceptable — the CLI's input is mostly programmatic or carefully written.
