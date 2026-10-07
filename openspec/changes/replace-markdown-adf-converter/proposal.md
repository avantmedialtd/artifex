# Replace the hand-rolled markdown→ADF converter with a parser-based mapper

## Why

Even when newlines arrive correctly, `textToAdf` (`atlassian/lib/adf.ts`) loses structure that agents routinely write. An audit ran 66 cases of typical agent-authored markdown and compared them with a GitHub-flavored-markdown reference parse. `textToAdf` matched the block structure in only 27 cases and the inline formatting in 14.

The worst failures are common in agent output:

- **Code fences**
    - A fence directly after a text line ("Here's the fix:") is not recognized. The code renders as body text with stray backticks.
    - A closing fence that is then misread opens a new fence and swallows the rest of the comment into a code block.
    - Fences inside list items, `~~~` fences, longer fences, and info strings such as `c++`, `objective-c` or `ts title="x"` are not recognized either.
- **Lists**
    - Nested lists become paragraphs with literal `  - ` markers and split the parent list.
    - Ordered lists always restart at 1, because no `order` attribute is emitted. This also happens to numbered steps separated by code blocks.
- **Other blocks**
    - GFM tables render as raw pipe text.
    - Task lists, strikethrough and underscore emphasis stay literal.
    - Blockquotes, and `***` or `---` lines, directly after a text line stay literal.
- **Inline**
    - Marks do not nest, so backticks show inside bold or link text.
    - Link URLs containing `)` are truncated.
    - Images leave a stray `!`.
    - Lone asterisks, such as in globs, italicize arbitrary spans.

The converter works line by line with regexes (block loop at `adf.ts:12-158`, one inline regex at `adf.ts:171`). It cannot be patched into a CommonMark-compliant parser one case at a time.

The reverse converter `adfToText` (`adf.ts:229-333`) has matching gaps. It drops mentions, inline cards, emoji and task-item text, flattens nested lists, and prints table cells one per line. This already hides content from `af jira get` for issues written in the Jira UI.

## What Changes

- **`textToAdf` becomes a mapper from a real markdown parser's tokens to ADF.**
    - **Block structure follows CommonMark.**
        - Fences are recognized anywhere: after a paragraph, inside list items, with `~~~` or longer fences, and with any info string.
        - Quotes, `***` / `___` rules, headings and fences can interrupt a paragraph.
        - Setext headings and indented code are supported.
    - **`---` directly under a line of text follows CommonMark** (decided in design D6).
        - It is a setext H2 underline, so the text above it becomes a heading, as on GitHub.
        - Agents sometimes mean it as a separator; a blank line before `---` keeps it a rule.
        - Today af renders it as literal text either way, so this is a visible change but breaks no working output. CLAUDE.md documents it.
    - **Lists:** nested bullet and ordered lists are supported, and `orderedList.attrs.order` is set for lists that do not start at 1.
    - **GFM extensions:**
        - tables map to ADF `table`;
        - strikethrough maps to the `strike` mark;
        - task lists are emitted as ADF task items only after live verification on Jira and Confluence; design defines the fallback.
    - **Inline:**
        - marks nest;
        - the `code` mark is combined only with `link`, per Atlassian's mark rules;
        - link URLs may contain parentheses and titles;
        - images become links;
        - autolinks and bare URLs become links.
- **Deliberately preserved behaviour**, for compatibility with agent output:
    - A single newline inside a paragraph stays a hard line break. CommonMark would render it as a space, but today's behaviour keeps lines like `**Status:** fixed` / `**PR:** …` apart.
    - Raw HTML and HTML-looking text (`<ISSUE-KEY>`, `Promise<void>`) is kept as literal text and never dropped.
    - Output never contains empty text nodes or nesting that ADF does not allow; nested blockquotes are flattened.
    - Every guarantee of `fix-adf-converter-hang`'s **Robust markdown input for ADF conversion** requirement carries over unchanged:
        - termination;
        - CRLF, lone-CR and BOM normalization;
        - no empty or CR-bearing text nodes;
        - U+2028 / U+2029 kept as ordinary characters;
        - empty headings for marker-only lines;
        - bare `>` lines separating quote paragraphs;
        - empty list items as list items with one empty paragraph.
- **`adfToText` is upgraded** to round-trip the new structures and to stop dropping mentions, inline cards, emoji and task items.
- **A regression corpus** of agent-style markdown, seeded from the exploration audit, runs in tests. Every output is validated against the published ADF JSON schema.

**Direction from exploration (confirmed in design D1):** build our own mapper on top of `marked`'s lexer rather than adopt a turnkey library. `marked` is a single package with no dependencies, MIT-licensed and actively maintained. The `mdast` toolchain is the alternative.

This supersedes decision D1 of the archived `2026-05-01-fix-adf-code-fences` design. D1 rejected `marked` and `remark` in favour of hand-rolled branches, to be revisited "only if we accumulate two or three more 'missing block type' bugs". The gaps above meet that trigger: tables, nested lists, setext headings, task lists, and `~~~` and indented fences.

The turnkey options each had a blocker on the audit corpus:

- **marklassian**, the lightest, deletes HTML-looking placeholders and drops the line break before bold text. Only the line-break bug is tracked upstream (open issue #12, with an unmerged fix in PR #13); the placeholder deletion has no upstream issue.
- **`@atlaskit/editor-markdown-transformer`** is about 39 MB with telemetry dependencies, and it silently drops nested-quote content.
- **md-adf** scored best, but its package lists no repository, homepage or author.

Explicitly **not** part of this change:

- **Literal `\n` arriving in argv.**
    - No compliant parser can split it.
    - af deliberately neither detects nor unescapes it.
    - `add-multiline-body-input` adds file and stdin input and help text, so callers can send real newlines instead.
- The JSM `--internal` / `--public` comment path. It posts the text unconverted to the Service Desk API, where it is rendered as Jira wiki markup, and never goes through `textToAdf`.
- Syntax beyond GFM, such as panels, expands or @mentions. These are possible follow-ups.

## Capabilities

### New Capabilities

<!-- None: this broadens the existing shared ADF conversion requirement. -->

### Modified Capabilities

- `atlassian-shared-config`: the **Shared ADF conversion** requirement is rewritten to cover:
    - the broadened markdown coverage (nested lists, list start numbers, tables, fences anywhere, strikethrough, nested inline marks);
    - the preserved hard-break and raw-HTML-as-text policies;
    - output that is valid against the ADF schema;
    - `adfToText` round-trips for the new structures.

  Three existing scenarios will be revised:
    - **Blockquote conversion**, which expects a single paragraph;
    - **Horizontal rule conversion**: any line that is exactly `---` becomes a rule, which conflicts with setext headings and indented code;
    - the byte-equal **round-trip** scenario.

  The delta touches only **Shared ADF conversion**. The **Robust markdown input for ADF conversion** requirement that `fix-adf-converter-hang` adds stays as is, so the two deltas do not collide. Archive `fix-adf-converter-hang` first anyway, since this change's implementation builds on it.

## Impact

- **Code:**
    - `atlassian/lib/adf.ts` becomes a facade over two new modules, `atlassian/lib/markdown-to-adf.ts` and `atlassian/lib/adf-to-markdown.ts` (design D2);
    - `atlassian/lib/adf-types.ts` and `atlassian/lib/adf.test.ts` are updated.
- **Call sites keep their signatures:**
    - the `textToAdf` writers in `jira/lib/client.ts` and `confluence/lib/client.ts`;
    - the `adfToText` readers in `jira/lib/formatters.ts` (description, comments, worklog table) and `confluence/lib/formatters.ts`.
    - `jira/lib/formatters.ts:516` flattens `adfToText` output into a markdown table cell, so richer output (for example a table's `|`) must be escaped there.
    - `jira/lib/types.ts` and `confluence/lib/types.ts` import the updated `adf-types.ts`.
- **Dependencies:**
    - `marked` is added as a runtime dependency, with no transitive dependencies.
    - Test-only additions: a vendored snapshot of `@atlaskit/adf-schema`'s `full.json` under `test/fixtures/`, and the dev dependencies `ajv` and `ajv-draft-04` (design D14).
    - npm installs runtime dependencies outside af's tarball, so the `files` allowlist is unaffected. Any vendored mapper code must be `.ts` inside `atlassian/`.
- **Behaviour:**
    - Jira and Confluence bodies that use the newly supported constructs render correctly instead of as literal syntax.
    - `af jira get` and Confluence reads show content that `adfToText` used to drop.
- **Ordering:** builds on `fix-adf-converter-hang`. Independent of `add-multiline-body-input`, but most valuable after it, because file and stdin input will carry longer, richer markdown.

<!-- cspell:words marklassian strikethrough autolinks -->
