## 1. Prerequisite

- [x] 1.1 Confirm that `fix-adf-converter-hang` is implemented before starting. If not, stop and implement that change first. All three checks must hold:
    - its `tasks.md` is fully checked, or it is archived under `openspec/changes/archive/`;
    - the **Robust markdown input for ADF conversion** requirement exists, in `openspec/specs/atlassian-shared-config/spec.md` or in that change's delta;
    - its hang tests (child process killed after a deadline) and empty-node tests pass under `bun run test`.

    Then note the exact node shapes its tests assert for a marker-only heading, a bare `>` quote and an empty list item (for example `content: []`), and keep those shapes in the new mapper.

## 2. Dependencies

- [x] 2.1 Add `marked` `^18.1.0` to `dependencies` in `package.json`. It is the only new runtime dependency and has no dependencies of its own (design D1, D3).
- [x] 2.2 Add `ajv` `^8.20.0` and `ajv-draft-04` `^1.0.0` to `devDependencies`. `ajv` is listed explicitly because `ajv-draft-04` declares it as an optional peer (design D14).
- [x] 2.3 Run `bun install` and keep the updated `bun.lock`.

## 3. Fixtures and test helpers

- [x] 3.1 Download `https://unpkg.com/@atlaskit/adf-schema@57.7.1/dist/json-schema/v1/full.json` to `test/fixtures/adf-schema-full.json` without reformatting it. Verify that it is 73,655 bytes with sha256 `5128562b75278c8a83e7e3619a570205bc80d59696985ec31a7a7883cff66fbe`.
- [x] 3.2 Add `test/fixtures/adf-schema-full.json` to `.prettierignore`. Add it and `test/fixtures/adf-corpus.json` to `ignorePaths` in `.cspell.json`.
- [x] 3.3 Create `test/fixtures/adf-corpus.json` by copying the JSON array from the "Cases" block of `openspec/changes/replace-markdown-adf-converter/audit-corpus.md` unchanged. Then:
    - run `npx prettier --write` on it;
    - check that it parses to 66 cases and that every `input` is identical to the one in `audit-corpus.md`.
- [x] 3.4 Create `test/helpers/adf.ts`. It lives outside the published `atlassian/**` glob (design D14) and exports:
    - `validateAdf(doc)`, which returns the ajv errors or `null`. Construct the validator as `AjvDraft04.default` from `import AjvDraft04 from 'ajv-draft-04'` with `{ allErrors: true, strictTuples: false }`. Compile once, reading the schema with `readFileSync` relative to `import.meta.url`.
    - `summarizeAdf(doc)`, a port of the reference implementation in `audit-corpus.md`.
    - `adfProblems(doc, input?)`, which lists:
        - empty text nodes;
        - text containing `\r`;
        - when `input` is given, text containing a leaked sentinel: a code point in U+FDD0–U+FDEF that `input` does not contain, literally or as a numeric reference;
        - a text node carrying the same mark type twice;
        - a `hardBreak` with marks.

    `adfProblems` covers everything the `expectWellFormed` helper from `fix-adf-converter-hang` checks in `atlassian/lib/adf.test.ts`. Either reimplement `expectWellFormed` on top of it or replace its callers, so there is one definition of "well-formed".

## 4. Markdown → ADF mapper (`atlassian/lib/markdown-to-adf.ts`)

- [x] 4.1 In `atlassian/lib/adf-types.ts`, add `AdfMark` (`{ type: string; attrs?: Record<string, unknown> }`) and use it for `AdfNode.marks`. Keep `AdfDocument` and `AdfNode` shape-compatible for `jira/lib/types.ts` and `confluence/lib/types.ts`.
- [x] 4.2 Implement input normalization (design D4):
    - `\r\n` and lone `\r` become `\n`;
    - one leading U+FEFF is stripped;
    - U+2028 / U+2029 are swapped before lexing for two sentinels, and back in every emitted string (text, code body, language, `href`, `title`). The sentinels are the first two noncharacters in U+FDD0–U+FDEF that the input contains neither literally nor as a numeric reference (decimal or hex, any case, leading zeros allowed);
    - the swap runs whenever the input contains U+2028 or U+2029, and sentinels are picked only then. If fewer than two candidates are free, throw an explicit error;
    - add tests: U+2028 in a list item, a table row and a setext text line, in an input that also contains U+FDD0 literally and as `&#xFDD0;`. Each must keep U+2028 as an ordinary character and leave the U+FDD0 occurrences unchanged.

    Write these four characters as `\u` escapes in source and tests, never as literal characters. A literal U+2028 inside a regular-expression literal is a syntax error.

- [x] 4.3 Create the module-level `Marked` instance from design D3, with `gfm: true` and `breaks: true` and two tokenizer overrides:
    - `def` returns `undefined` for `[^…]` labels and `false` otherwise;
    - `heading` implements CommonMark ATX headings: a space, a tab or the end of the line after the `#` run, only spaces and tabs trimmed, and an optional closing `#` sequence removed only when a space or tab precedes it.

    Only ever call `.lexer()` on the instance, and never call `marked.setOptions` or `marked.use`. Test `#<U+00A0>x` (a paragraph), `## Title<U+00A0>` (text keeps the NBSP), `## C#` and `### foo #`.

    Implementation added four more overrides (`inlineText`, `blockquote`, `code`, `lheading`); design D15 records why.

- [x] 4.4 Map block tokens as in the design D5 table:
    - `heading`, keeping `content: []` for a marker-only heading;
    - `paragraph` and block-level `text`;
    - `code`: the language is the first word of the info string, there is no language for indented code, and the content is `content: []` when the body is empty;
    - `hr`;
    - `blockquote`: one empty paragraph when it has no children;
    - `list`: `attrs.order` only when `start` is a number other than 1, since `start` is `''` for bullet lists;
    - `list_item`: one empty paragraph when it has no children;
    - `table`: `attrs: { isNumberColumnEnabled: false, layout: 'default' }`, `tableHeader` for the header row and `tableCell` for body rows, one paragraph per cell, alignment dropped;
    - block `html`: literal text (design D8);
    - `space` and `def`: skipped;
    - any other token: a paragraph of its `raw` text.
- [x] 4.5 Apply the nesting rules from design D5, keeping track of whether the current context is the document, a list item or a blockquote:
    - a heading inside a list item or blockquote becomes a paragraph with the heading's inline content;
    - a blockquote inside a blockquote or list item is flattened into its parent;
    - a rule, table, HTML block or unknown token there becomes a paragraph of its `raw` text, with trailing newlines trimmed and lines joined by `hardBreak`.
- [x] 4.6 Implement the task-list fallback (design D10):
    - remove the `checkbox` token both where tight items carry it (first block token) and where loose items carry it (first inline token of the first paragraph);
    - prefix the item's first paragraph with `☐ ` (U+2610) or `☑ ` (U+2611), followed by a space, merging into a leading unmarked text node;
    - never emit `taskList` or `taskItem`.
- [x] 4.7 Map inline tokens with an inherited mark list (design D9):
    - `strong`, `em` and `del` (as `strike`);
    - `link`, with `href` and, when non-empty, `title`; a link whose text is empty gets its `href` as text, with the link mark;
    - `codespan`, which gets `code` plus only an inherited `link`;
    - `text` and `escape`, using the token's `text`. A numeric reference that decodes to U+000D keeps its literal source text (design D8);
    - `br` becomes a `hardBreak` without marks;
    - `html` becomes literal `raw` text;
    - `image` becomes its alt text (or its URL when the alt text is empty) with a `link` to the image. An image inside a link keeps the outer link.

    Never add a mark type twice. Merge adjacent text nodes whose marks are equal, and never emit an empty string.

- [x] 4.8 Turn the `textToAdf` half of `atlassian/lib/adf.ts` into the facade (design D2):
    - `textToAdf` keeps today's signature and delegates to `markdownToAdf`;
    - delete the old line loop and `parseInlineMarkdown`, after a grep confirms there are still no users outside `adf.ts` and `adf.test.ts`. Its five tests move to `textToAdf` in 7.2;
    - delete the `parseInlineMarkdown('')` test that `fix-adf-converter-hang` adds along with the function. Its guarantee, no empty text node, is checked on every output by `adfProblems`.

## 5. ADF → markdown renderer (`atlassian/lib/adf-to-markdown.ts`)

- [x] 5.1 Render blocks as in the design D11 table:
    - top-level blocks joined by a blank line, skipping blocks that render empty;
    - paragraphs;
    - headings, with only the hashes when there is no content (design D11):
        - at levels 1–2, content with a `hardBreak` in setext form: its lines escaped as in 5.6, then a `===` or `---` line;
        - at levels 3–6, each `hardBreak` as a space;
        - leading and trailing `hardBreak` nodes dropped;
        - a trailing `#` run after a space or tab, or content of only `#`s, escaped with a backslash (`## C \#`);
    - code blocks, with a fence longer than any run of three or more backticks in the body;
    - blockquotes, with `> ` prefixes and a bare `>` on blank lines;
    - rules as `---`;
    - `blockCard` / `embedCard` as their URL;
    - any other node: its inline children inline, or its block children joined by blank lines.
- [x] 5.2 Render lists:
    - `- ` and `N. ` markers, numbered from `attrs.order`;
    - `* ` and `N) ` instead, alternating, for a list directly after a sibling list of the same type, so `textToAdf` reads two lists back (`- a` then `+ b` gives two `bulletList`s);
    - continuation lines indented by the marker width;
    - a blank line between consecutive paragraphs of one item;
    - an empty item as the bare marker.

    Render `taskList` / `taskItem` / `blockTaskItem` as `- [ ] ` / `- [x] `, with a nested `taskList` indented two spaces.

- [x] 5.3 Render tables as GFM pipe tables:
    - the first row is the header row, followed by a `| --- |` delimiter row;
    - rows are padded to the widest row;
    - each cell's blocks are rendered inline and joined by spaces, with `hardBreak` as a space and `|` escaped as `\|`.
- [x] 5.4 Render inline marks as mark runs (design D11):
    - already-open marks stay open (active-first ordering);
    - `strong`, `em` and `strike` stay open around a code span;
    - whitespace at the edges of a run moves outside the delimiters;
    - code spans use a backtick fence sized to their content, padded with spaces when needed;
    - links render as `[text](href "title")`, with `<…>` around an `href` that contains whitespace or unbalanced parentheses.
- [x] 5.5 Render inline nodes:
    - `mention` as `attrs.text` (adding `@` when it is missing), or `@` and `attrs.id`;
    - `emoji` as `attrs.text` or `attrs.shortName`;
    - `date` as its `attrs.timestamp` in UTC `YYYY-MM-DD` form;
    - `inlineCard` as `attrs.url` or `attrs.data.url`;
    - any other inline node as its `attrs.text`.
- [x] 5.6 Escape block markers at the start of paragraph lines (design D12):
    - first lines:
        - one to six `#`, or a `-`, `+` or `*`, followed by a space, a tab or the end of the line;
        - `>`, whatever follows it;
        - fences of three or more backticks or tildes;
        - lines of only `-`, `*`, `_` or `=` characters, spaces allowed;
        - ordered markers followed by a space, a tab or the end of the line, written as `N\.` / `N\)`;
    - later lines: only constructs that can interrupt a paragraph, plus `-` and `=` lines that would make a setext heading, so the ordered marker is escaped only for `1.` / `1)`;
    - running text is not escaped.

    Paragraphs whose whole text is `-`, `>x`, `#` or `1.` must read back unchanged.

- [x] 5.7 Make the renderer robust:
    - a missing or non-array `content` counts as empty;
    - string input is returned unchanged;
    - `null` / `undefined` return `''`;
    - it never throws (`confluence/lib/formatters.ts:61-66` relies on this).
- [x] 5.8 Finish the facade (design D2): `adfToText` in `atlassian/lib/adf.ts` keeps today's signature and delegates to `adfToMarkdown`, and the old renderer is deleted. Every importer keeps its import path.

## 6. Jira worklog formatter

- [x] 6.1 In `formatWorklogs` (`jira/lib/formatters.ts:516`), escape `|` as `\|` after the newline flattening and the 40-character truncation, through a small local helper (design D13).
- [x] 6.2 Add `formatWorklogs` tests to `jira/lib/formatters.test.ts`: a worklog comment containing an ADF table, and one containing the text `a | b`, each render a row with exactly five cells.

## 7. Tests

- [x] 7.1 Add `atlassian/lib/adf.corpus.test.ts`. For every case in `test/fixtures/adf-corpus.json`:
    - `summarizeAdf(textToAdf(input))` equals `expected`;
    - `validateAdf` returns `null`;
    - `adfProblems` is empty;
    - `textToAdf(adfToText(adf))` deep-equals `adf`.

    If an expectation conflicts with the spec, fix the expectation and record why in the PR description.

- [x] 7.2 Update the `textToAdf` part of `atlassian/lib/adf.test.ts`:
    - keep the existing fence, quote, rule, list, empty-input and empty-fence tests;
    - replace the `parseInlineMarkdown` tests with equivalent `textToAdf` tests;
    - add one test per `textToAdf` scenario in the spec delta;
    - add carriage-return reference tests: `a&#13;b`, `a&#xD;b`, `## Title&#13;` and `[a&#13;b](https://example.com)`. Each keeps the reference as literal text and has no `adfProblems`;
    - assert that every result passes `validateAdf` and has no `adfProblems`.
- [x] 7.3 Add `adfToText` tests on hand-built Jira-UI ADF:
    - mentions, emoji and inline cards, with and without `attrs.text`, and a `date`;
    - nested task lists;
    - tables with a `|` in a cell and a multi-paragraph cell;
    - an ordered start with a nested list, and strike;
    - unrecognized nodes (`panel`, `decisionList`, `status`) and malformed `content`;
    - line-start escaping;
    - headings with a `hardBreak` at levels 2 and 3, and a heading ending in ` #`;
    - two adjacent `bulletList`s and two adjacent `orderedList`s, which must read back as two lists each;
    - the canonical-form byte-equal round trip, extending today's "should round-trip a fence + blockquote + rule document" test with nested lists, a start number, a two-paragraph quote, a table and every mark.
- [x] 7.4 Keep `fix-adf-converter-hang`'s hang and empty-node tests passing.
    - Its child-process fixture `test/fixtures/text-to-adf.ts` imports `textToAdf` from `atlassian/lib/adf.ts`, which the facade keeps, so the `convertInChild` deadline tests run against the new mapper unchanged.
    - Run its hang and empty-node tests unchanged. They pin the **Robust markdown input for ADF conversion** requirement, which this change keeps, so a failure is a mapper bug to fix, not an expectation to update. The only `fix-adf-converter-hang` test removed is the `parseInlineMarkdown('')` test (task 4.8).
- [x] 7.5 Run the existing Jira, Confluence and command tests. They must pass, except where an expectation encodes an ADF shape that this change deliberately changes.

## 8. Documentation

- [x] 8.1 Update `CLAUDE.md`:
    - In the project structure, list `atlassian/lib/markdown-to-adf.ts` and `atlassian/lib/adf-to-markdown.ts`, with `adf.ts` as the facade.
    - In the shared Atlassian infrastructure list, describe the converter:
        - the `marked` GFM lexer with af's own mapper, and the policies: single newline = hard break, raw HTML literal, `code` only with links, nested quotes flattened, task items as ☐ / ☑ bullets;
        - that `---` directly under text makes a heading, so a separator needs a blank line before it;
        - that tests validate every output against the vendored ADF schema and the regression corpus.
- [x] 8.2 Add any words that `bun run spell:check` flags in the changed files to `words` in `.cspell.json`.

## 9. Verification

- [x] 9.1 Run `bun run test` (Vitest; never `bun test`) and fix any failures.
- [x] 9.2 Run `bun run lint`, `bun run format:check` and `bun run spell:check`.
- [x] 9.3 Run the remaining checks:
    - `npx tsc --noEmit --pretty false` reports no errors under `atlassian/`, `jira/`, `confluence/` or `test/`. At HEAD there are already 29 errors in 6 unrelated files, so the command as a whole still fails.
    - `openspec validate replace-markdown-adf-converter --strict` passes.
    - Archive dry run, because `validate` does not catch a renamed or dropped scenario in a MODIFIED block:
        - copy `openspec/` to a temporary directory;
        - there, run `openspec archive fix-adf-converter-hang -y` (if it is not archived yet), then `openspec archive replace-markdown-adf-converter -y`;
        - both must succeed. Delete the copy afterwards.
    - `npm pack --dry-run` lists the two new `atlassian/lib` modules and no `test/` files.
- [x] 9.4 Run a live smoke test on Jira, only with the user's go-ahead and only on a scratch issue the user names (AM-15).
    - Send the corpus case `composite-agent-update`, plus a table, a list and a code block inside a blockquote, a link with a title, an empty heading (`#`), a two-line setext heading and a list starting at 3, as:
        - a Jira comment;
        - a Jira description.
    - Confirm that no request is rejected and that `af jira get` reads it back faithfully.
    - Record the results under design Open Questions. If a shape is rejected, apply the local fallback listed in design Risks.
- [x] 9.5 Finish the live smoke test, with the user's go-ahead:
    - send the same content as the body of a scratch Confluence page the user names, and as a footer comment on it, and confirm that no request is rejected and that `af confluence get` reads it back faithfully;
    - confirm in the Jira UI that the content renders as intended (the user did).

    Record the results under design Open Questions.
- [x] 9.6 Look at the scratch Confluence page in the browser, above all the highlighting of its `ts` code blocks, which Confluence's server-rendered HTML labels as Java (the user did).

## 10. Adversarial review

- [x] 10.1 Run an adversarial review of the converter. Independent probes cover spec conformance, mapper robustness, round-trip fidelity, the rendering of Jira- and Confluence-authored ADF, and integration and packaging. A finding counts only once a skeptic has reproduced it from scratch and checked it against design.md.
- [x] 10.2 Fix the confirmed mapper defects, each with a regression test (design D15):
    - the quote depth cap, the quote work limit, and the nesting limits with the literal fallback;
    - the setext pre-check stops;
    - the `list` override (task boxes, code tabs);
    - the `def` blank-line rule;
    - the quote raw rebuild and the inline-queue pruning.
- [x] 10.3 Fix the confirmed renderer defects, each with a regression test (design D15):
    - table-cell pipe escaping;
    - the delimiter-row, open-label, setext and task-box escapes;
    - emphasis delimiters;
    - backslash lines for consecutive hard breaks;
    - URL-text escaping;
    - CR normalization;
    - inline cards as `<url>`;
    - verbatim tables in list items and quotes.
- [x] 10.4 Add the review's realistic cases to the corpus, and update `adf.corpus.test.ts` and design D14.
- [x] 10.5 Re-run the review against the fixes, diffing the output against the previous code, and record the edge cases that remain (design D12 known gaps, Risks).

## Follow-ups (not part of this change)

- Split very long paragraphs before lexing, so a single paragraph of about 86,000 lines or more no longer stalls under Bun (design Risks, "Very large inputs under Bun").
- Bound `marked`'s remaining quadratic paths (unclosable emphasis openers, long e-mail-like runs) if a real Confluence page ever approaches those sizes.
- `parseErrorMessage` in `atlassian/lib/request.ts` prints a Confluence v2 error body (`{"errors":[{"title":…,"detail":…}]}`) as `0: [object Object]`; read `title` and `detail` instead.
- Narrow the round-trip limits for Jira-UI text: delimiter characters in running text, and the emphasis forms marked cannot express (design D12 known gaps, and Risks "Round-trip limits for Jira-UI text").

<!-- cspell:words codespan noncharacters lheading unclosable -->
