## Context

`textToAdf` and `adfToText` in `atlassian/lib/adf.ts` are hand-rolled. All of the following refer to HEAD `b2ad5f1`; `fix-adf-converter-hang` patches the same code first, but leaves its structure intact.

- **Block parsing** is a line loop of regex branches (`adf.ts:12-158`):
    - fences only at column 0 with a `\w*` language (`:24`);
    - quotes collapse into one paragraph (`:44-63`);
    - rules are `---` / `***` lines (`:67`);
    - lists are column-0 only, with no `order` attribute (`:87-130`);
    - the paragraph loop yields only to blank, heading-like and list-like lines (`:134-139`), so fences, quotes and rules directly after text stay literal.
- **Inline parsing** is one regex with one mark per span (`:171`). The exported `parseInlineMarkdown` (`:168`) has no caller outside `adf.ts` and `adf.test.ts:2,121-156`.
- **`adfToText`** (`:229-333`) drops nodes without `text` or `content` (`:263-266`), so mentions, emoji and inline cards vanish. Its default branch (`:322-328`) loses task-item text and prints table cells one per line. Nested list items are rendered at column 0 (`:283-301`), and ordered lists always restart at 1 (`:287-292`).

Callers:

- **Writers**: `jira/lib/client.ts:158,212,272,286,497,512,639` and `confluence/lib/client.ts:89,130,135,195` (`:135` converts `''`).
- **Readers**: `jira/lib/formatters.ts:113,196,395,516` and `confluence/lib/formatters.ts:63`.
    - The Confluence reader sits in a `try`/`catch` that falls back to the raw JSON string, so `adfToText` must not throw.
    - `jira/lib/formatters.ts:516` squeezes the output into a markdown table cell.

Evidence comes from the exploration audit. Its 66 cases are copied into `audit-corpus.md`, because the scratch copy is temporary.

- Today `textToAdf` matches a GFM reference parse in 27/66 cases for block structure and 14/66 for inline formatting. 62/66 outputs are schema-valid, and 2 inputs hang.
- The turnkey libraries score as follows (block structure / inline / schema-valid, out of 66):

    | Library                                       | Structure | Inline | Valid | Blocker for af                                                                                                                                          |
    | --------------------------------------------- | --------- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | marklassian 1.2.1                             | 64        | 59     | 64    | Deletes `<ISSUE-KEY>` / `Promise<void>`; drops the break before bold unless a global `marked.setOptions`; invalid ADF for nested quotes and empty items |
    | github-markdown-adf 1.3.0                     | 64        | 59     | 65    | Deletes HTML-looking placeholders; drops reference-link text; about 15 downloads/week                                                                   |
    | md-adf 0.2.2                                  | 62        | 61     | 66    | No repository, homepage or author; soft breaks become spaces                                                                                            |
    | `@atlaskit/editor-markdown-transformer` 6.3.1 | 60        | 57     | 66    | About 39 MB with statsig, react-ufo and opentelemetry; drops nested-quote content; no task lists                                                        |
    | extended-markdown-adf-parser 2.4.0            | 61        | 59     | 59    | Schema-invalid tables; drops images                                                                                                                     |
    | markdown-to-adf 0.2.20                        | 45        | 56     | 59–63 | Demotes headings; drops rules and fences in lists                                                                                                       |
    | md-to-adf 0.6.4                               | 42        | 37     | 65    | Unmaintained since 2020; throws on `~~~`                                                                                                                |

ADF constraints, checked against `@atlaskit/adf-schema` 57.7.1 (`full.json`) with ajv in scratch:

- A text node needs `minLength: 1`.
- A `hardBreak` cannot carry marks.
- The `code` mark combines only with `link` (and `annotation`).
- A `blockquote` may hold paragraphs, lists, code blocks and media, but not headings, rules, blockquotes or tables.
- A `listItem` may hold paragraphs, lists, task lists, code blocks and media, in any order, but not headings, rules, blockquotes or tables.
- A table cell needs at least one block.
- `table` attributes are optional.
- `orderedList.attrs.order` is a number ≥ 0.
- `taskList` and `taskItem` require `attrs.localId`.
- The schema does not reject duplicate marks.

The editor's own node specs in the same package agree: the default schema uses the extended blockquote, and `listItem` has no first-child rule.

Repository constraints:

- **Runtime and packaging**: runtime dependencies are `bun`, `chalk`, `ink` and `react`.
    - `package.json` `files` (`:29-47`) publishes `atlassian/**/*.ts` minus `!**/*.test.ts`.
    - npm installs dependencies outside the tarball.
    - `test/` is not published.
- **Formatting and spelling**: `.prettierignore` excludes `openspec/` but nothing under `test/`, and `.cspell.json` `ignorePaths` (`:4-12`) has no `test/` entry.
- **Type check**: `npx tsc --noEmit` already fails at HEAD with 29 errors in 6 unrelated files (`bun-upgrade.test.ts`, `commands/bitbucket.test.ts`, `npm-upgrade.test.ts`, `resources/copy-prompt-reporter.ts`, `sonar/lib/client.test.ts`, `sonar/lib/request.test.ts`).

## Goals / Non-Goals

**Goals:**

- `textToAdf` maps a real markdown parse to ADF:
    - CommonMark block structure;
    - GFM tables, strikethrough and autolinks;
    - task lists through a fallback.
- Every `textToAdf` output validates against the ADF JSON schema, and the regression corpus proves it in tests.
- The compatibility policies hold:
    - single newlines are hard breaks;
    - raw HTML is literal text;
    - text nodes are never empty;
    - `code` is combined only with `link`;
    - nested quotes are flattened;
    - every guarantee of `fix-adf-converter-hang` is kept.
- `adfToText` renders the new structures and stops dropping mentions, emoji, inline cards and task items. Converter output is stable under `textToAdf → adfToText → textToAdf`, apart from one HTML-block gap, and the corpus test proves it for every case (D12).
- Signatures stay as they are: `textToAdf(text: string): AdfDocument` and `adfToText(adf: AdfDocument | string | null | undefined): string`. Call sites do not change.
- One new runtime dependency, with no transitive dependencies.

**Non-Goals:**

- Emitting ADF `taskList` / `taskItem` before live verification (follow-up, D10).
- Syntax beyond GFM: panels, expands, @mentions, emoji shortcodes and footnotes. Footnotes stay literal (D3).
- Images as ADF media. They become links (D9).
- Table column alignment, and colspan or rowspan when rendering.
- Decoding named character references such as `&amp;` (D8).
- Full markdown escaping in `adfToText` (D12).
- The JSM `--internal` / `--public` path, literal `\n` in argv, and any CLI flag or JSON-output change.

## Decisions

### D1. Parse with `marked`'s lexer and own the token → ADF mapper

**Choice:** depend on `marked@^18.1.0` and use only its lexer. The ADF mapping is our own code.

**Why `marked`:**

- It is one package with no dependencies, MIT-licensed, about 0.5 MB unpacked, published 18.1.0 on 2026-10-05, and downloaded about 98M times a week.
- GFM tables, strikethrough, task items and autolink literals are built in, and so is `breaks`.
- Its tokens are plain objects that map directly to ADF.
- A throwaway prototype of this design, written in scratch, confirmed the approach. It used marked 18.1.0, about 250 lines of mapper and 200 of renderer.
    - It produced the intended outline for all 66 corpus cases (recorded as `expected` in `audit-corpus.md`).
    - All 66 outputs validated against the schema.
    - All 66 survived `textToAdf → adfToText → textToAdf` unchanged.
    - Canonical documents round-tripped byte for byte.

**Alternatives considered:**

- **The mdast stack** (`mdast-util-from-markdown` + `mdast-util-gfm` + `micromark-extension-gfm`, with our own mapper).
    - It is stricter CommonMark (it was the audit's reference parser) and supports footnotes.
    - But it is 59 packages and about 4.6 MB, for the same mapper work. Soft breaks also arrive as `\n` inside text values and would need splitting.
    - Rejected: for a CLI that installs its runtime dependencies on every user's machine, one dependency-free package is the smaller supply-chain surface.
- **A turnkey library** (table in Context). Every candidate breaks at least one compatibility policy, or has a provenance or weight problem. Owning the mapper makes each policy explicit and testable.

**Supersedes** decision D1 of the archived `2026-05-01-fix-adf-code-fences` design ("hand-roll; no markdown library"). Its own revisit trigger, "two or three more missing block type bugs", is met: tables, nested lists, setext headings, task lists, and `~~~`, indented and in-list fences.

- That design's D4 (column-0 fence regex), D6 (single-paragraph quotes) and D7 (`---` / `***` only) go with it.
- Its D3 (an unterminated fence runs to the end) and D5 (one text node per code block, `content: []` when empty) carry over unchanged.
- `adfToText` stays hand-rolled: it renders a known node set and needs no parser.

### D2. Module layout and public API

- **New `atlassian/lib/markdown-to-adf.ts`**: normalization, the `Marked` instance, and block and inline mapping, including the nesting rules. Exports `markdownToAdf(text)`.
- **New `atlassian/lib/adf-to-markdown.ts`**: the renderer. Exports `adfToMarkdown(adf)`.
- **`atlassian/lib/adf.ts` becomes the facade.** It exports `textToAdf` and `adfToText` with today's signatures, delegating to the two modules. Every importer keeps its import path: `jira/lib/client.ts:6`, `confluence/lib/client.ts:13` and `confluence/lib/formatters.ts:10`, plus the client re-exports at `jira/lib/client.ts:33` and `confluence/lib/client.ts:26`.
- **`parseInlineMarkdown` is removed.**
    - Nothing outside `adf.ts` and its test uses it.
    - A standalone inline parser cannot see a document's link reference definitions, so it would disagree with inline content inside a document.
    - Its five tests become `textToAdf` tests.
- **`adf-types.ts`** gains `AdfMark` (`{ type: string; attrs?: Record<string, unknown> }`), used by `AdfNode.marks` and both modules. `AdfDocument` and `AdfNode` keep their shape for `jira/lib/types.ts:4-6` and `confluence/lib/types.ts:3`.
- **Packaging**: all new runtime code is `.ts` under `atlassian/`, which `atlassian/**/*.ts` already publishes.

**Alternative:** rewrite everything inside `adf.ts`. Rejected because the file would hold two unrelated algorithms of about 250 lines each, and the split keeps each direction testable on its own.

### D3. One `marked` instance, configured locally

The mapper creates one module-level `Marked` instance and only ever calls `lexer()` on it:

```ts
const markdown = new Marked({
    gfm: true, // tables, strikethrough, task items, autolink literals
    breaks: true, // a single newline inside a paragraph is a `br` token (D7)
    tokenizer: {
        // GFM footnotes are not supported: decline `[^label]:` definitions
        def(src) {
            return /^ {0,3}\[\^/.test(src) ? undefined : false;
        },
        // CommonMark ATX headings (replaces marked's own ATX rule; setext is `lheading`)
        heading(src) {
            const m = /^ {0,3}(#{1,6})(?=[ \t\n]|$)([^\n]*)(?:\n+|$)/.exec(src);
            if (!m) return undefined;
            let text = m[2].replace(/^[ \t]+|[ \t]+$/g, '');
            text = /^#+$/.test(text) ? '' : text.replace(/[ \t]+#+$/, '').replace(/[ \t]+$/, '');
            return {
                type: 'heading',
                raw: m[0],
                depth: m[1].length,
                text,
                tokens: this.lexer.inline(text),
            };
        },
    },
});
```

- **ATX headings follow CommonMark exactly.** This keeps the heading rule of **Robust markdown input for ADF conversion**.
    - marked's own ATX rule accepts any JavaScript whitespace after the `#` run. Verified with 18.1.0: `#<NBSP>x` and `#<U+2003>x` become headings.
    - It also `trim()`s the text, which drops a trailing NBSP.
    - The override accepts only a space, a tab or the end of the line after the run. It strips only spaces and tabs, and removes an optional closing `#` sequence only when a space or tab precedes it, so `## C#` keeps its `#`.
    - In the prototype, the override kept every corpus outline, every round trip, and every input from `fix-adf-converter-hang`'s scenarios. It never calls `marked.setOptions` or `marked.use`, which change state shared with any other `marked` user in the process. marklassian's soft-break workaround needed exactly that global.
- **Footnotes stay literal.** Without the `def` override, marked registers `[^1]: Source.` as a link reference definition and turns `[^1]` into a link to `Source.`. With it, both stay literal text, as the corpus case `inline-reference-link` records. In these overrides, returning `undefined` declines the input, and returning `false` defers to marked's own tokenizer.
- **Version**: `^18.1.0`.
    - Token shapes are part of marked's API and can change across majors. In 18.x, for example, a task item carries a separate `checkbox` token whose position depends on whether the list is loose (D10). The corpus and schema tests gate every upgrade.
    - marked's `engines` (`node >= 20`) is stricter than af's (`>= 16`). af runs on Bun through the `af` launcher, and npm only warns on an engines mismatch.

### D4. Normalize input before lexing

These steps run in order:

1. **Line endings.** `\r\n` and lone `\r` become `\n`.
2. **Byte-order mark.** One leading U+FEFF is stripped. These first two steps are `fix-adf-converter-hang`'s guarantees; marked would normalize CR itself, but not the BOM.
3. **U+2028 / U+2029.**
    - CommonMark and `fix-adf-converter-hang` treat them as ordinary characters. marked's block rules use JavaScript's `.`, which does not match them. Verified with 18.1.0 and the D3 override in place:
        - `- <U+2028>` lexes as an empty list item followed by a paragraph, so the character acts as a line ending;
        - a table row or a setext text line that contains one is not recognized.
    - ATX headings do not need the swap: the D3 override already makes `## a<U+2028>b` a heading. Plain marked, without the override, lexes that line as the paragraph `## a<U+2028>b`.
    - The mapper therefore swaps them before lexing for two sentinels. They are the first two noncharacters in U+FDD0–U+FDEF that the input contains neither literally nor as a numeric character reference (decimal or hex, any case, with or without leading zeros).
    - It swaps back in every string it emits: text, code body, language, `href` and `title`.
    - The swap always runs. U+2028 / U+2029 therefore never act as line endings, as `fix-adf-converter-hang` requires, and no decoded reference is rewritten.
    - If fewer than two candidates are free, the mapper throws an explicit error rather than skipping the swap. An input would need to use 31 of the 32 to trigger this.

Nothing else is altered. In particular, `\n` escape sequences are never interpreted.

### D5. Block mapping and the nesting rules

| marked token                                   | ADF                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heading` (ATX or setext)                      | `heading`, `attrs.level` = depth. ATX headings come from the D3 override, which strips closing `#`s, allows 0–3 spaces of indentation, and gives a marker-only line `content: []`. Setext headings come from marked's `lheading`.                                      |
| `paragraph`; block-level `text` in tight items | `paragraph`                                                                                                                                                                                                                                                            |
| `code` (fenced or indented)                    | `codeBlock`. `attrs.language` is the first word of the info string, omitted when empty and for indented code. The body is one text node, or `content: []` when empty.                                                                                                  |
| `hr`                                           | `rule`                                                                                                                                                                                                                                                                 |
| `blockquote`                                   | `blockquote`, children mapped in quote context. With no children, it holds one empty paragraph.                                                                                                                                                                        |
| `list`                                         | `bulletList` / `orderedList`. `attrs.order` = start when start ≠ 1.                                                                                                                                                                                                    |
| `list_item`                                    | `listItem`. With no children, it holds one empty paragraph. Task items: D10.                                                                                                                                                                                           |
| `table`                                        | `table` with `attrs: { isNumberColumnEnabled: false, layout: 'default' }`, as Atlassian's own markdown transformer emits. Header cells are `tableHeader` and body cells are `tableCell`; each holds one paragraph, empty when the cell is empty. Alignment is dropped. |
| `html` (block)                                 | Literal text (D8)                                                                                                                                                                                                                                                      |
| `space`, `def`                                 | Nothing                                                                                                                                                                                                                                                                |
| any other token                                | A paragraph of its `raw` text, so nothing is dropped                                                                                                                                                                                                                   |

Some blocks are not allowed where markdown can put them. They are handled so that their text survives and the output stays valid:

| Block                                  | Inside a list item                          | Inside a blockquote            |
| -------------------------------------- | ------------------------------------------- | ------------------------------ |
| heading                                | paragraph with the heading's inline content | same                           |
| blockquote                             | flattened: its children join the item       | flattened: nested quotes merge |
| rule, table, HTML block, unknown token | paragraph of its markdown source            | same                           |

"Paragraph of its markdown source" means `raw`, with trailing newlines trimmed and the lines joined by `hardBreak`.

**Alternative:** hoisting a table or rule out of the list. Rejected because it splits the list and reorders content.

### D6. `---` directly under text follows CommonMark

`Summary\n---` becomes a level-2 heading, and `Release notes\n===` a level-1 heading. A blank line before `---` keeps it a rule.

The underline takes the whole paragraph above it, not only its last line. With D7, a paragraph of several lines becomes one heading whose lines are joined by `hardBreak`. ATX syntax cannot hold such a heading, so `adfToText` writes it back in setext form (D11).

Rationale:

- The proposal makes block structure follow CommonMark.
- Agents write GitHub-flavored markdown, where this is an H2.
- marked does it natively. Special-casing it would need a custom `lheading` tokenizer and would make `---` and `===` behave differently.
- Today's output is literal text either way, so no output that works today changes meaning.

This is a visible change, and CLAUDE.md documents it. The same CommonMark rule makes a lone `-` under a text line a setext underline, so what looks like an empty bullet directly under a paragraph line turns that paragraph into a heading. An empty `* ` or `1. ` item cannot interrupt a paragraph, so it stays text after a hard break.

**Alternative:** treat `---` under text as a rule. Rejected: it diverges from GitHub, from CommonMark and from `===`.

### D7. Single newlines stay hard breaks

`breaks: true` turns every newline inside a paragraph, heading or list-item text into a `br` token, which maps to `hardBreak`. Trailing-two-space breaks and backslash breaks map the same way.

- **Rationale**: this is today's behaviour, and it keeps `**Status:** fixed` and `**PR:** …` on separate lines.
    - marklassian's `fixedPR:` bug shows the cost of a space.
    - md-adf's spaces merge `Key: value` lines.
- **Effect on marks**: a `hardBreak` never carries marks, so a mark that spans a break produces marked text on both sides of an unmarked `hardBreak`.

### D8. Raw HTML stays literal text

Inline and block `html` tokens become text taken verbatim from `token.raw`. For a block, trailing newlines are trimmed and lines are joined by `hardBreak`. HTML is never dropped and never interpreted.

Consequences:

- `<ISSUE-KEY>`, `Promise<void>`, `<kbd>` and `<!-- … -->` show exactly as typed. Comments are visible, as they are today.
- Markdown inside an HTML block, such as the line after `<details>` with no blank line between, stays literal. That is the CommonMark block rule.

**Alternatives considered:**

- Dropping HTML, as marklassian does: data loss.
- Interpreting a subset (`<br>`, `<details>` as an expand): a guess about intent, and new surface.

Character references: the mapper uses each text token's `text`, in which marked has decoded numeric references (`&#35;` → `#`) but left named references (`&amp;`) as typed. Link destinations keep named references as typed too, so `[x](https://example.com/?a=1&amp;b=2)` links to exactly that string. Decoding named references would need the HTML5 entity table, about 2,000 entries, so they stay literal. This is a known deviation from CommonMark.

One exception keeps `fix-adf-converter-hang`'s guarantee that no text node contains a carriage return.

- A numeric reference that decodes to U+000D (`&#13;`, `&#xD;`, any case or leading zeros) never reaches a text node.
- The mapper emits the reference's literal source text instead, as the current converter does.
- This applies wherever decoded text is emitted, including heading and link text.

### D9. Inline marks, links and images

Inline tokens are walked with the inherited mark list:

| Token                 | Result                                                                          |
| --------------------- | ------------------------------------------------------------------------------- |
| `strong`, `em`, `del` | Adds `strong` / `em` / `strike` to the inherited marks                          |
| `link`                | Adds `link` with `href`, plus `title` when present; empty link text: the URL    |
| `codespan`            | Text with `code`, plus the inherited `link` only                                |
| `text`, `escape`      | Text with the inherited marks                                                   |
| `br`                  | `hardBreak` with no marks                                                       |
| `html`                | Literal `raw` text with the inherited marks                                     |
| `image`               | Alt text, or the URL when the alt text is empty, with a `link` to the image URL |
| `checkbox`            | Skipped (D10)                                                                   |

- **The `code` mark combines only with `link`.**
    - Atlassian's mark docs say `code` can only be combined with `link`, and the schema's `code_inline_node` enforces it.
    - So `strong`, `em` and `strike` are dropped for the code span alone: ``**`x`**`` becomes code-only text, and ``**run `cmd` now**`` keeps "run" and "now" bold.
    - The alternative, dropping `code` and keeping the emphasis, loses the monospace signal that matters most in agent text.
- **No mark type is added twice.** This covers emphasis nested inside the same emphasis, and an image inside a link, where the outer link wins.
- **Merging and empty text.** Adjacent text nodes with equal marks are merged, and empty strings are never emitted.
- **Links:**
    - `href` is marked's destination, with backslash escapes resolved and no percent-encoding added. Balanced parentheses are kept.
    - A link whose text is empty, such as `[](https://…)`, gets its URL as text with the link mark, as an image without alt text does. Otherwise no text node would carry the mark, and the URL would be dropped.
    - `<https://…>` autolinks, bare GFM URLs, `www.` hosts (as `http://`) and e-mail addresses (as `mailto:`) become link marks whose text is the URL as written.
    - Emoji shortcodes and issue keys stay plain text.

### D10. Task lists fall back to ballot-box bullets

`- [ ] x` and `- [x] x` stay items of their own list type, `bulletList` or `orderedList`. The item's first paragraph starts with `☐ ` (U+2610 and a space) when open, or `☑ ` (U+2611 and a space) when done.

marked puts the checkbox in a separate `checkbox` token:

- in a tight list, as the item's first block token;
- in a loose list, as the first inline token of the first paragraph.

The mapper handles both placements. `- [ ]` with no text is not a task item and stays literal.

**Why not `taskList`:**

- Every `taskList` and `taskItem` needs an `attrs.localId`.
- Live acceptance is unverified. marklassian issue #10, one unconfirmed report, says Confluence v2 returns 400 for `taskList`. Atlassian's structure page lists `blockTaskItem` but not `taskList`, though that is a documentation gap rather than evidence of rejection.
- An unverified node risks a 400 on the whole write.

The glyphs render everywhere, read as checkboxes, are distinguishable from literal `[ ]`, and survive the round trip. `adfToText` still renders real `taskList` content (from the Jira UI) as `- [ ]` / `- [x]` (D11).

**Follow-up:** verify `taskList` / `taskItem` with generated `localId`s live, in a Jira description and comment and in a Confluence page and footer comment, and then switch the fallback in a separate change.

### D11. `adfToText` rendering rules

| ADF                                       | Markdown                                                                                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| top level                                 | Blocks joined by a blank line; blocks that render empty (for example media) are skipped                                                                                                                                               |
| `paragraph`                               | Inline content, with line-start escaping (D12)                                                                                                                                                                                        |
| `heading`                                 | `#` × level, a space, then the content; with no content, `#` × level alone. Hard breaks and closing `#` runs: detailed below                                                                                                          |
| `bulletList` / `orderedList`              | `- ` / `N. `, numbered from `attrs.order` (default 1). Later lines are indented by the marker width. An item's consecutive paragraphs are separated by a blank line; an empty item is the bare marker. Adjacent lists: detailed below |
| `taskList` / `taskItem` / `blockTaskItem` | `- [ ] ` / `- [x] ` (`DONE`); a nested `taskList` is indented two spaces                                                                                                                                                              |
| `codeBlock`                               | A backtick fence longer than any run of three or more backticks in the body (minimum three), followed by the language                                                                                                                 |
| `blockquote`                              | Children separated by a blank line, each line prefixed `> ` (a bare `>` on blank lines)                                                                                                                                               |
| `rule`                                    | `---`                                                                                                                                                                                                                                 |
| `table`                                   | GFM pipe table; detailed below                                                                                                                                                                                                        |
| marks                                     | `**`, `*`, `~~`, code spans, and `[text](href "title")`; detailed below                                                                                                                                                               |
| `hardBreak`                               | A newline; a space inside a table cell and inside a level 3–6 heading                                                                                                                                                                 |
| `mention`                                 | `attrs.text` (an `@` is added when missing), else `@` and `attrs.id`                                                                                                                                                                  |
| `emoji`                                   | `attrs.text`, else `attrs.shortName`                                                                                                                                                                                                  |
| `date`                                    | `attrs.timestamp` (milliseconds) as a UTC `YYYY-MM-DD` date; it carries no `attrs.text`, so the fallback below would drop it                                                                                                          |
| `inlineCard`; `blockCard` / `embedCard`   | `attrs.url` (or `attrs.data.url`); for the block cards, on its own line                                                                                                                                                               |
| any other node                            | Its `attrs.text` if it is inline; otherwise its children, inline children inline and block children joined by blank lines                                                                                                             |

**Lists:** a list directly after a sibling list of the same type switches to `* ` or `N) `, alternating. Markdown merges two adjacent lists that share a marker, so `- a` followed by `+ b`, which `textToAdf` reads as two lists, would otherwise come back as one.

**Headings:**

- ATX syntax has no line breaks. A level-1 or level-2 heading whose content contains a `hardBreak` is written in setext form: its lines, escaped like paragraph lines (D12), then a `===` or `---` line. `textToAdf` produces exactly these headings from a multi-line setext heading (D6), so they round-trip.
- At levels 3–6, which only Jira-UI content reaches, each `hardBreak` is written as a space. Leading and trailing `hardBreak` nodes in a heading are dropped.
- A closing-sequence look-alike is escaped: when the content ends in a `#` run preceded by a space or tab, or is only `#`s, the run gets a backslash (`## C \#`), so `textToAdf` does not strip it.

**Tables:**

- The first row is the header row, followed by a `| --- |` delimiter row.
- Rows are padded to the widest row.
- A cell is its blocks rendered inline and joined by spaces, with `|` escaped as `\|`.

**Marks:**

- A code span uses a backtick fence longer than any backtick run inside it, and is padded with spaces when needed.
- A link's `href` is wrapped in `<…>` when it contains whitespace or unbalanced parentheses.
- A mark spans consecutive text nodes, and marks that are already open stay open, the same ordering approach prosemirror-markdown uses. So `**See [the runbook](url)**` survives.
- `strong`, `em` and `strike` stay open around a code span, because ADF strips them from the code text itself.
- Whitespace at the edge of a mark run moves outside the delimiters.

`adfToText` treats a missing or non-array `content` as empty and never throws.

### D12. Round-trip contract and minimal escaping

- **Contract:**
    - Canonical markdown, which is what `adfToText` emits, converts and renders back byte for byte.
    - For every corpus input, `textToAdf(adfToText(textToAdf(x)))` equals `textToAdf(x)`.
- **What `adfToText` escapes**, only what structure requires:
    - `|` in table cells;
    - backtick fences sized to the content;
    - `<…>` destinations;
    - block markers at the start of paragraph lines;
    - a heading's closing-sequence look-alike (D11).
- **Block markers at line starts.** A paragraph's first line that would start a block gets a backslash before the marker's punctuation:
    - one to six `#`, or a `-`, `+` or `*`, followed by a space, a tab or the end of the line, so a paragraph that is only `-` is escaped too;
    - `>`, whatever follows it;
    - a fence: three or more backticks or tildes;
    - a rule or setext underline: a line of only `-`, `*`, `_` or `=` characters, spaces allowed;
    - `N.` / `N)` followed by a space, a tab or the end of the line, written as `N\.` / `N\)`.

    A later line in the same paragraph is escaped only for constructs that can interrupt a paragraph, and for a `-` or `=` line, which would turn the paragraph into a setext heading. For ordered markers that means only `1.` / `1)`. So `2024. It affects…` after a hard break stays unescaped, while a paragraph whose text is `1. not a list` renders as `1\. not a list`.

- **Running text is not escaped.** Inline `*`, `_`, `~`, `[`, `<` and `&` are left alone, keeping `af jira get` readable.
    - The price: text that originally needed a backslash escape can parse differently when fed back. For example, Jira-UI text `*not emphasis*` would come back as emphasis.
    - Alternative: escape every markdown-significant character, as prosemirror-markdown does. Rejected: it produces noisy output such as `snake\_case` and `2 \* 3` for the agents that read it.
- **Known gaps.** Line-start escaping covers converter output, with one exception, and most Jira-UI text:
    - A paragraph that `textToAdf` built from an HTML block, such as `<details>` directly followed by `# Title`, reads back as an HTML block, where the backslash added to `\# Title` stays literal. No corpus input does this, and GitHub shows such lines literally too.
    - In Jira-UI text, a line that starts with spaces is not escaped, so `   # x` reads back as a heading, and a first line indented by four spaces as indented code. A later line that opens an HTML block (`<div>`) ends the paragraph, and two lines shaped like a table header and delimiter row become a table.

### D13. Escape `|` in the worklog table cell

`formatWorklogs` (`jira/lib/formatters.ts:516`) currently builds the Comment cell as `adfToText(w.comment).replace(/\n/g, ' ').slice(0, 40)`. That breaks the row whenever the text contains `|`, which is now likely, because tables render with pipes. The fix escapes `|` as `\|` after truncating, so escapes do not eat the 40-character budget. It uses a small local helper, mirroring `escapePipe` in `bitbucket/lib/formatters.ts:615-617`, rather than importing across products. No spec delta is needed: the `jira-command` worklog-list scenario only says worklogs "are displayed".

### D14. Tests, fixtures and dev dependencies

**Schema snapshot: `test/fixtures/adf-schema-full.json`.**

- It is a byte-identical copy of `https://unpkg.com/@atlaskit/adf-schema@57.7.1/dist/json-schema/v1/full.json`: 73,655 bytes, sha256 `5128562b75278c8a83e7e3619a570205bc80d59696985ec31a7a7883cff66fbe`.
- It is vendored rather than installed as `@atlaskit/adf-schema`, because that package pulls in feature-gate, statsig, react-ufo, opentelemetry and lodash for one JSON file. A pinned snapshot is reproducible offline.
- It is added to `.prettierignore` and to `.cspell.json` `ignorePaths`, keeping it byte-identical to upstream. Verified in scratch: `prettier --check` flags its 2-space formatting, and cspell flags `subsup`, `rowspan` and `colwidth`.

**Corpus fixture: `test/fixtures/adf-corpus.json`.** It is the JSON array from `audit-corpus.md`, copied unchanged. It is prettier-formatted and listed in `.cspell.json` `ignorePaths`, because its inputs deliberately hold identifiers and non-words.

**Dev dependencies**: `ajv@^8.20.0` and `ajv-draft-04@^1.0.0`. The schema is draft-04, and ajv 8 needs the draft-04 class. `ajv-draft-04`'s peer dependency on `ajv` is optional, so `ajv` is listed explicitly. Usage, verified in scratch:

```ts
import AjvDraft04 from 'ajv-draft-04';
const Ajv = AjvDraft04.default; // CommonJS: module.exports is the class and also carries `default`
const validate = new Ajv({ allErrors: true, strictTuples: false }).compile(schema);
```

- This form type-checks under the repo's NodeNext settings with TypeScript 7.0.2 and runs under vitest 5.0.2.
- `strictTuples: false` silences two "items is 2-tuple" warnings that default strict mode logs for the tuple-form `content` of `blockTaskItem` and of the captioned `mediaSingle`.
- Compiling takes about 70 ms, once per test file.

**Shared test helpers: `test/helpers/adf.ts`.** It exports:

- `validateAdf(doc)`;
- `summarizeAdf(doc)`, the notation from `audit-corpus.md`;
- `adfProblems(doc, input?)`, which reports empty text, `\r` in text, a leaked sentinel, a duplicate mark type, and a `hardBreak` with marks. A leaked sentinel is a code point in U+FDD0–U+FDEF that `input` does not contain, literally or as a numeric reference.

It lives outside the published `atlassian/**` glob, so test-only code never ships.

**Test files:**

- `atlassian/lib/adf.corpus.test.ts`: for every corpus case, the outline equals `expected`, the output is schema-valid, there are no problems, and the round trip is equal.
- `atlassian/lib/adf.test.ts`: the spec scenarios as unit tests. Every `textToAdf` result is also schema-validated, and `adfToText` is tested on hand-built Jira-UI ADF.
- `jira/lib/formatters.test.ts`: worklog pipe escaping.

`fix-adf-converter-hang`'s deadline-based hang tests and empty-node tests keep running unchanged against the new converter.

## Risks / Trade-offs

- **[Visible behaviour changes]** These now follow GitHub rendering:
    - `---` under text becomes a heading (D6);
    - 4-space-indented lines after a blank line become code blocks;
    - `_x_` becomes italic;
    - indented `- ` lines become nested lists;
    - `~~x~~` becomes strikethrough;
    - pipe tables become real tables;
    - ordered lists keep their numbers;
    - task boxes become ☐ / ☑.

    → Mitigation: this is the rendering agents target. CLAUDE.md documents the policies and the setext rule, and the corpus pins each case.

- **[Jira or Confluence may reject or misrender shapes the schema allows]** These are table `attrs`, lists and code inside quotes, link `title`, headings with no content, headings that contain a `hardBreak` (D6), and `orderedList.attrs.order`. → Schema validation catches structural errors offline, and the live smoke test (task 9.4) covers each shape. Every fallback is local: drop the `title`, flatten quote content, omit the table `attrs`, or join a heading's lines with a space.
- **[marked majors change token shapes]** → The caret pin is on major 18, and the corpus and schema tests fail on drift. The mapper isolates its assumptions in one place: checkbox placement, block-level `text` tokens, and `start` being `''` for bullet lists.
- **[marked is not fully CommonMark-strict]** The audit's reference was micromark. → `audit-corpus.md` pins the expected outlines. Any discrepancy found later becomes a new corpus case.
- **[Pathological input]** marked uses regexes. → It has guards against known backtracking, including an inline link-parenthesis pre-check. Instead of spinning, its loop guard throws `Infinite loop on byte: N`. `textToAdf` lets that propagate, and every call site converts before sending, so nothing is written. `fix-adf-converter-hang`'s deadline tests run against the new code.
- **[Backslash-escaped text round-trips imperfectly]** → Documented in D12, with its known gaps. Line-start escaping covers the cases that change the structure of converter output.
- **[Named character references stay literal]** `&lt;ISSUE-KEY&gt;` shows as typed. → Rare in agent text; recorded in D8.
- **[marked ends a paragraph or list item at more `#` lines than CommonMark does]** Verified with 18.1.0 and the D3 override:
    - Directly under a paragraph line, `#<NBSP>x` ends that paragraph, because marked's check accepts any JavaScript whitespace after the `#`. The line becomes a second paragraph instead of continuing the first after a hard break. It is still not a heading.
    - Directly under a list item, a line that starts with `#` ends the list even with nothing but text after the `#`. So `- Fixed the race reported in` followed by `#4512 on Monday` puts the second line in a paragraph after the list, where CommonMark continues the item.
    - `-<NBSP>x` stays paragraph text, as in CommonMark.

    → Both cases are rare and lose no text. Only the heading rule is part of a requirement, and D3 enforces it.

- **[Dependency footprint]** → One runtime package with no dependencies. ajv (4 transitive packages) and ajv-draft-04 are dev-only.

## Migration Plan

1. Implement and archive `fix-adf-converter-hang` first. This change replaces its implementation but must keep its tests green.
2. Land this change in one PR. There is no data or configuration migration, and no CLI surface change.
3. Release notes call out the visible changes: setext headings, tables, nested lists, ordered numbering, task glyphs, and indented code.
4. Rollback is a revert of the PR, which also removes `marked`.

## Open Questions

- Do Jira (description, comment, worklog and transition comments) and Confluence (page body, footer comment) accept the new shapes and render them as intended? The shapes are tables with `isNumberColumnEnabled` / `layout`, lists and code blocks inside blockquotes, link `title`, empty headings or paragraphs, headings that contain a `hardBreak`, and `orderedList.attrs.order`. They are verified against the schema only. The live smoke test (task 9.4) answers this.
- When can `taskList` / `taskItem` replace the ballot-box fallback? This is a follow-up after live verification (D10).
- Should a small set of named character references (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&nbsp;`) be decoded? This is left out for now (D8).

<!-- cspell:words marklassian mdast micromark statsig opentelemetry ufo atlaskit Atlaskit noncharacters subsup rowspan colwidth prosemirror lheading unpkg codespan strikethrough autolinks misrender -->
