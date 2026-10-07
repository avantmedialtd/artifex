## Context

`textToAdf` (`atlassian/lib/adf.ts:7-165`) converts every Jira and Confluence body that af writes:

- Jira: `jira/lib/client.ts:158,212,272,286,497,512,639`;
- Confluence: `confluence/lib/client.ts:89,130,135,195`.

It splits the input on `\n` (`adf.ts:8`) and walks the lines in one block loop (`adf.ts:12-158`). Each branch claims the lines it recognizes: fence, blockquote, rule, heading, bullet list, ordered list, and finally paragraph.

Termination depends on every branch consuming at least one line, and two regexes break that:

- **Heading branch** (`adf.ts:74`): `/^(#{1,6})\s+(.+)$/`.
- **Paragraph guard** (`adf.ts:137`): `/^#{1,6}\s+/`, which refuses heading-like lines.

The guard accepts lines that the heading regex rejects:

- a marker followed by exactly one whitespace character and nothing else (`## `, `#\t`). With two or more, the regex backtracks and yields a heading whose text is whitespace;
- a heading line containing `\r`, U+2028 or U+2029, which `.` cannot match.

Such a line is consumed by neither branch, `i` never advances, and the process spins. Conversion runs before the write request, so nothing is written:

- Jira comments, worklogs and issue descriptions hang before any request, and so do Confluence comments (`confluence/lib/client.ts:195`).
- A few paths hang after read-only lookups:
    - `af jira transition` first fetches the transition list (`jira/lib/client.ts:614`);
    - Jira `create` / `update` with `--field` may first fetch field metadata (`commands/jira.ts:489`, `:546`);
    - Confluence `create` / `update` first read the space or the page (`confluence/lib/client.ts:88`, `:121`).

Both command handlers already turn a thrown error into `Error: …` and exit `1` (`commands/jira.ts:1312-1319`, `commands/confluence.ts:459-467`).

The other defects in scope:

- `parseInlineMarkdown('')` returns one empty text node (`adf.ts:220-223`). Bare `>` lines (`adf.ts:46-62`) and empty list items (`adf.ts:87-128`) reach it.
- CRLF input keeps `\r` in text nodes, including code-block text.
- A leading U+FEFF hides a first-line heading. `commands/confluence.ts:71` reads `--body-file` verbatim, so the BOM reaches the converter.

Constraints:

- No new dependencies, and the CLI surface stays unchanged.
- Tests run with `bun run test` (Vitest 5 in a Node process, `vitest.config.ts`). CI uses `oven-sh/setup-bun` and runs `bun run test` (`.github/workflows/ci.yml`).
- `replace-markdown-adf-converter` will later rewrite the converter and modify **Shared ADF conversion**. The guarantees added here therefore live in their own requirement and must hold for any implementation.

## Goals / Non-Goals

**Goals:**

- `textToAdf` returns for every input string. A future defect fails loudly instead of hanging.
- CRLF and lone CR become LF, and one leading BOM is dropped, before parsing.
- The heading rule follows CommonMark ATX headings for the cases in scope. The heading branch and the paragraph guard share one predicate and cannot disagree.
- No text node is empty or contains `\r`. Blocks without text become nodes with `content: []`, which is the ADF-valid form.
- Bare `>` lines separate quote paragraphs, as in CommonMark.
- Regression tests cannot freeze the suite when a hang returns.

**Non-Goals:**

- The other fidelity gaps, all left to `replace-markdown-adf-converter`:
    - fences, quotes and rules that interrupt a paragraph;
    - nested lists, tables and ordered-list start numbers;
    - inline mark nesting;
    - closing `#` sequences on headings and 1-3 spaces of indentation before `#`;
    - a bare `-`, `*` or `1.` with no following space. CommonMark reads it as an empty list item; it stays paragraph text here, as today, which is valid ADF.
- Treating U+2028 / U+2029 as line endings, or removing any character other than CR and one leading BOM.
- `adfToText`, the JSM `--internal` / `--public` path (no ADF), and new input sources (`add-multiline-body-input`).
- A JSON-schema validator in the test suite. `replace-markdown-adf-converter` adds one as a dev dependency.

## Decisions

### D1. Normalize inside `textToAdf`, before splitting

`textToAdf` first removes one leading U+FEFF, then replaces `/\r\n?/g` with `\n`. Everything else, including U+2028, U+2029 and any later U+FEFF, passes through unchanged.

- **Why here:** `textToAdf` is the single choke point for all eleven call sites. CR also arrives through argv (`--add "$(cat crlf.md)"` keeps every `\r`), not only through future file or stdin input.
- **Why these characters:** they are exactly CommonMark's line endings (LF, CR, CRLF). A leading BOM is an encoding artifact that micromark and cmark also drop. U+2028 and U+2029 are ordinary characters in CommonMark, so turning them into breaks would change content.
- **Alternatives considered:**
    - Normalize in each caller, or only in the new input helper of `add-multiline-body-input`: misses argv input and duplicates the logic.
    - Normalize U+2028 / U+2029 as well: not CommonMark, and it alters text.
    - Normalization alone, without D2: `## ` and `#\t` still hang with pure LF input, so this is not enough.

### D2. One shared ATX-heading predicate

A module-level `matchAtxHeading(line)` returns `{ level, text }` or `null`:

- **Opening:** `/^(#{1,6})(?=[ \t]|$)/`, that is 1-6 `#` at column 0 followed by a space, a tab or the end of the line. Normalization has already removed every line terminator from a line.
- **Text:** the rest of the line with leading and trailing spaces and tabs removed. It may be empty, and it may contain U+2028 / U+2029 anywhere.
    - The strip is an index scan over spaces and tabs.
    - The first implementation used `/^[ \t]+|[ \t]+$/g`. Verification found it backtracks quadratically: `[ \t]+$` re-scans a long internal run of spaces from every start position, so `# a` + 200,000 spaces + `b` took about 35 s, against 1 ms before this change (task 7.1).
- **Scope in the requirement:** the rule applies outside code blocks and HTML blocks. A converter that recognizes CommonMark closing sequences (`## Title ##`) also drops them from the text.
    - This converter has no HTML blocks and does not strip closing sequences, so for it only fence bodies are excluded.
    - Both clauses keep the requirement true under `replace-markdown-adf-converter`. There, markdown inside an HTML block stays literal, and closing sequences are stripped.

The heading branch (`adf.ts:74`) and the paragraph guard (`adf.ts:137`) both call it. A paragraph's first line is then always accepted by the paragraph loop: the heading predicate and both list regexes have already rejected it in their own branches, and it is non-blank. So every iteration consumes at least one line by construction.

"Whitespace" means what CommonMark says: space or tab after the opening sequence, and space or tab stripped from the content. This was checked against micromark, the CommonMark reference implementation:

| Input                                                      | CommonMark result                 |
| ---------------------------------------------------------- | --------------------------------- |
| `#`, `## `, `#\t`, `###   `, `######`                      | empty headings                    |
| `#######`, `#hashtag`, `#123`, `#<NBSP>Title`, `#<U+2028>` | paragraphs                        |
| `## a<U+2028>b`                                            | heading with text `a<U+2028>b`    |
| `## Title<U+2028>`                                         | heading with text `Title<U+2028>` |

Visible consequences, all matching CommonMark:

- `#` … `######` alone become empty headings instead of literal text.
- In `intro\n#`, the `#` line ends the paragraph and becomes an empty heading.
- `###   ` becomes a heading with no text node instead of the text `' '`.
- Trailing spaces and tabs leave heading text.
- `#<NBSP>Title` becomes paragraph text instead of a heading.

Alternatives considered:

- **Keep JS `\s` after the marker (today's semantics).** Rejected: `#<U+2028>` and `#<NBSP>` would become headings, while CommonMark and micromark make them paragraphs. The proposal promises CommonMark.
- **Use JS `trim()` on the heading text.** Rejected: it also strips U+2028, U+2029, NBSP and U+FEFF at the ends, which CommonMark keeps.
- **Strip with a regex such as `/^[ \t]+|[ \t]+$/g`, `/[ \t]*$/` or `/^[ \t]*(.*?)[ \t]*$/`.** Rejected: each backtracks quadratically on a long internal run of spaces or tabs.
- **Relax the heading regex (`(.*)` with the `s` flag) and keep two regexes.** Rejected: two patterns can drift apart again.
- **Force `i++` when the paragraph loop collects nothing.** Rejected: it silently drops the line and hides the bug.

### D3. Defensive progress guard

The block loop remembers the index at which the previous iteration started. If an iteration starts at the same index, it throws `Error('textToAdf: no block consumed line <n> (converter bug)')`, where `n` is 1-based.

- The check runs at the top of the loop, so it also covers every `continue` path.
- The message names the line number but not the line's content, because bodies can be sensitive.
- Under D2 the guard is unreachable. It exists so that a future regression fails with exit `1` and a clear message instead of a hang.
- Verified in a prototype. The heading branch was given back its old regex while the paragraph guard kept `matchAtxHeading`. `textToAdf('intro\n\n## \nmore')` then threw `… line 3 …` instead of spinning.
    - Restoring only the old guard regex does not reproduce a stall on that input: the new heading branch consumes `## `, and the call returns normally.

Alternatives considered:

- **An iteration cap:** the limit is arbitrary, and it still burns CPU first.
- **Silently skipping the line:** it loses content.

### D4. `parseInlineMarkdown('')` returns `[]`

Remove the fallback at `adf.ts:220-223`. Non-empty text with no marks is already emitted whole by the "remaining text" branch (`adf.ts:216-218`), so only `''` ever reached the fallback. Every match group in the inline regex is non-empty, so no other branch can emit an empty text node.

Empty headings (D2), empty quote paragraphs (D5) and empty list items (D6) therefore get `content: []`.

Alternatives considered:

- **A placeholder (space or zero-width) text node:** it alters content.
- **A post-pass that filters empty nodes:** it hides where they come from.

### D5. Bare `>` lines separate quote paragraphs

The quote branch keeps collecting lines that start with `>`. A bare line, `/^>\s*$/` (so `>` and `> ` alike), closes the current paragraph:

- A run of bare lines is one separator.
- Leading and trailing bare lines add no paragraph.
- A quote of only bare lines becomes `blockquote[paragraph(content: [])]`, because ADF requires `blockquote.content` to have at least one item.

Consecutive quoted lines that carry text still form one paragraph joined by `hardBreak`, as the existing **Blockquote conversion** scenario describes. That scenario speaks of lines beginning with `> `, and a bare `> ` with a trailing space also begins with `> `. The new requirement therefore states that it refines the scenario: the single paragraph applies to plain-text quoted lines with no bare line between them. `replace-markdown-adf-converter` rewrites the scenario in those terms.

The bare-line test uses JavaScript `\s`, like the existing strip regex `/^>\s?/`, so a line whose body is empty after the strip is always a separator, never an empty line body.

- A quoted line holding only other Unicode whitespace, such as `>` followed by a non-breaking space, is therefore also a separator. CommonMark would keep that character as paragraph text.
- The requirement defines a bare line as `>` followed by nothing or only spaces and tabs, so it leaves this edge open. The parser-based converter can follow CommonMark there.

Alternatives considered:

- **A `hardBreak` per bare line:** valid ADF, but not CommonMark.
- **Dropping an all-bare quote:** it silently loses a block the author wrote.
- **`blockquote` with `content: []`:** schema-invalid.

### D6. Empty list items keep their slot

`- `, `* ` and `1. ` already reach `parseInlineMarkdown('')`. With D4 they become `listItem[paragraph(content: [])]` without any change to the list branches.

- `listItem.content` needs at least one item, and the empty paragraph provides it.
- `- a\n- \n- b` keeps three items, so numbering and order are preserved.

Alternatives considered:

- **Dropping the item:** it shifts numbering.
- **Placeholder text:** it alters content.

### D7. ADF validity, checked against the published schema

The schema checked is `@atlaskit/adf-schema` 57.7.1 `full.json` (https://unpkg.com/@atlaskit/adf-schema@57.7.1/dist/json-schema/v1/full.json):

| Definition                  | Constraint                    |
| --------------------------- | ----------------------------- |
| `text_node.text`            | `minLength: 1`                |
| `paragraph_node.content`    | no `minItems`                 |
| `heading_node.content`      | no `minItems`; `level` is 1-6 |
| `blockquote_node.content`   | `minItems: 1`                 |
| `listItem_node.content`     | `minItems: 1`                 |
| `bulletList`, `orderedList` | `content` has `minItems: 1`   |

Every shape emitted by D2 and D4-D6 is therefore valid.

During planning, a prototype of D1-D6 was run over the 66-case agent-markdown audit corpus plus 39 adversarial inputs, and the output was validated with `ajv-draft-04`:

- 0 schema errors;
- 0 empty text nodes;
- 0 text nodes containing `\r`.

61 of the 66 corpus outputs were byte-identical to today's. Every difference fell in an intended category:

- former hangs;
- CRLF and BOM handling;
- empty text nodes;
- bare `>` separation;
- marker-only headings;
- trimmed heading text;
- `#<NBSP>`.

### D8. Hang tests run in a child process with a kill deadline

Vitest cannot interrupt a synchronous loop. In a planning experiment, an in-process `textToAdf('## ')` test with a 1 s Vitest timeout froze the run until it was killed from outside at 20 s.

The suite therefore converts each hang input in a child process:

- **Fixture:** `test/fixtures/text-to-adf.ts` reads one JSON-encoded string from stdin (`readFileSync(0, 'utf8')`), calls `textToAdf`, and writes the document as JSON to stdout.
    - `test/` is outside the `package.json` `files` allowlist; `npm pack --dry-run` lists nothing under `test/`.
    - `tsc --noEmit` covers the fixture. It type-checks in the repository layout, because `@types/node` reaches the program through `vitest.config.ts`.
    - `test/fixtures/package.json` is an npm-upgrade fixture. A `.ts` file beside it does not affect `integration.test.ts`.
    - That `package.json` has no `"type"` field, so `tsc` classifies the fixture as CommonJS. The fixture still type-checks: `module: NodeNext` lets a CommonJS file import an ES module, and Bun runs it as ESM either way. It must not use top-level `await` or `import.meta`, which fail with TS1309 and TS1470. Both points were checked with TypeScript 7.0.2 in a copy of the repository layout.
- **Helper in `atlassian/lib/adf.test.ts`:**
    - It runs `spawnSync('bun', [fixture], { input: JSON.stringify(input), encoding: 'utf8', timeout: 5_000, killSignal: 'SIGKILL' })`. The fixture path is resolved from `import.meta.url`.
    - On `ETIMEDOUT` the test fails with `textToAdf did not finish within 5000 ms for <input>`.
    - Any other spawn error or a non-zero exit fails with the error or the child's stderr.
    - These cases set a 15 s Vitest timeout, so Vitest's own timer never races the kill deadline.
- **Why `bun`:** the fixture imports TypeScript, which `bun` runs directly.
    - Node strips types natively only from 22.18 / 23.6, and CI does not pin a Node version (`ci.yml` has no `setup-node` step). A Node child or worker could therefore need a transform.
    - CI installs Bun, and `integration.test.ts` already spawns `bun` from Vitest (`:20`, `:79`).
- **Why JSON on stdin:** `Bun.stdin.text()` strips a leading BOM (`readFileSync(0)` keeps it). Raw stdin would make the BOM case pass vacuously. JSON also carries `\r`, U+2028 and U+2029 exactly.
- **Assertions:**
    - Each case asserts its expected structure, not only the generic text-node checks. The BOM input passed those checks against the unfixed converter, because a paragraph with the literal text `<U+FEFF>## Title` violates neither of them.
    - Every output from both the child and the in-process tests also goes through one helper. It asserts that every text node is non-empty and contains no `\r`.
- **Proof run during planning:**
    - Against the unfixed `adf.ts` with a 2 s deadline, all 9 hang inputs in that prototype failed with the deadline message. The run finished in 18 s and left no stray processes. The CRLF-without-heading input failed on the `\r` assertion. Task 5.4 lists 12 hang inputs, so with the 5 s deadline the same proof takes about a minute.
    - A deliberately looping script failed in 1.5 s.
    - Against the fixed prototype, each child case took about 11 ms.

Inputs that never looped on today's converter run in-process; the D3 guard bounds them. Examples are empty list items, bare `>` lines, `#` alone and `#hashtag`. Each was checked against the current code, so stashing the fix to prove the harness cannot freeze the suite.

Alternatives considered:

- **`worker_threads` with `terminate()`:** the worker would need its own TypeScript loading.
- **One child for the whole batch:** one hang hides which input caused it.
- **Running hang inputs in-process:** freezes the suite.

### D9. Inline nodes are appended one at a time

The paragraph branch and the quote branch add each line's inline nodes with a small `appendAll` loop, not `push(...nodes)`.

- Spreading an array into `push()` passes every element as an argument. Past an engine limit this throws `RangeError: Maximum call stack size exceeded`.
- Under Node that happened at about 250 KB of inline marks on one line (about 520,000 nodes). Under Bun it happened at about 1.3 MB.
- The defect predates this change. It is fixed here because the requirement promises a document for every input string (task 7.2).
- Headings and list items assign the parsed array directly, so they never had the problem.

## Risks / Trade-offs

- **[`#<NBSP>Title` changes from heading to paragraph]** A macOS Option+Space typo can produce this. → It now matches CommonMark and GitHub rendering, so what an author previews is what Jira shows. It is rare in agent output. The proposal's Impact lists it, and a requirement scenario pins it, so `replace-markdown-adf-converter`, whose ATX override already does the same, cannot flip it back.
    - One interaction is worse than before. Paragraphs do not yet stop at fences, quotes or rules (a gap left to `replace-markdown-adf-converter`). A `##<NBSP>Title` line directly followed by a fence therefore now absorbs the fence into one paragraph, and the code is inline-parsed. Before, the line was a heading and the fence stayed a code block.
    - It needs both a non-ASCII space after `#` and no blank line before the fence. The converter rewrite removes it.
- **[Heading text loses trailing spaces and tabs, and `###   ` loses its `' '` text node]** → Both are invisible, and both match CommonMark and `marked`.
- **[`adfToText` prints a multi-paragraph quote as consecutive `> ` lines without a separator, and an empty heading as `## `]** `af jira get` shows the quoted paragraphs run together. → No content is lost. Upgrading `adfToText` is in `replace-markdown-adf-converter`.
- **[Jira's live validator is untested for `heading` / `paragraph` with `content: []`]** No live writes were allowed during planning. → The shapes are valid against the JSON schema. They also match the ProseMirror node specs in `@atlaskit/adf-schema` 57.7.1, whose default and Jira schemas both give `heading` and `paragraph` the content expression `inline*` (empty allowed). Today's empty text node is schema-invalid. See Open Questions.
- **[The hang tests require `bun` on `PATH`]** → CI provides it, and the existing integration test already depends on it. A missing `bun` fails loudly (`ENOENT`) rather than skipping.
- **[A reintroduced hang makes each hang case wait 5 s]** → The suite stays bounded at about 5 s per case and fails rather than freezing.
- **[Cross-change: `replace-markdown-adf-converter` builds on `marked`, whose lexer diverges from this requirement]** Observed with `marked` 18.1.0, the version that change pins:
    - `## a<U+2028>b` and `## Title<U+2028>` (and U+2029) are lexed as paragraphs;
    - a leading BOM is not stripped;
    - `#<NBSP>x` is a heading;
    - `>` alone gives a blockquote with no children, and a lone `- `, `* ` or `1. ` gives a list item with no children.

    → That change's design already maps each case:
    - it normalizes line endings and the BOM as D1 does;
    - it swaps U+2028 / U+2029 out before lexing;
    - it overrides ATX headings to follow CommonMark;
    - it gives an empty blockquote or list item one empty paragraph.

    This change's deadline and empty-node tests keep running against the new converter.

## Migration Plan

- There is no data or configuration migration. Conversion output changes only for the inputs listed above, and no API or CLI surface changes.
- Archive this change before `replace-markdown-adf-converter`, which builds on it. `add-multiline-body-input` depends on it too.
- Rollback is a revert of the change. The only cost is that the hang and the invalid empty text nodes come back.

## Open Questions

- Does live Jira (and Confluence) accept `heading` and `paragraph` nodes with `content: []`, including inside `listItem` and `blockquote`? They are schema-valid, but this was not exercised against a live site. Optional task 6.6 checks it with the user's go-ahead. Otherwise it is deferred to `replace-markdown-adf-converter` task 9.4, and these shapes ship unverified until then.

<!-- cspell:words micromark cmark atlaskit unpkg NBSP ETIMEDOUT ENOENT SIGKILL hashtag -->
