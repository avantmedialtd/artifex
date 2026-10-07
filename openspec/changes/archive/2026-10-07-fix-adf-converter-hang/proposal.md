# Fix the `textToAdf` infinite loop and invalid empty text nodes

## Why

`textToAdf` (`atlassian/lib/adf.ts`) converts markdown to ADF for every Jira and Confluence body write. That covers:

- issue descriptions;
- comments, worklog comments and transition comments;
- Confluence pages and footer comments.

JSM `--internal` / `--public` comments bypass it: they are sent unconverted, and Jira Service Management renders them as wiki markup. On some inputs, `textToAdf` never returns.

The cause is a disagreement between two regexes:

- The heading regex (`adf.ts:74`, `/^(#{1,6})\s+(.+)$/`) rejects two kinds of heading-like line:
    - a marker followed only by whitespace (`## `, `#\t`, `## \r`);
    - a line where `\r` (from a CRLF file), U+2028 or U+2029 appears after the heading text starts (`## Summary\r`, `## a<U+2028>b`). The regex's `.` cannot match these characters.
- A terminator that sits in the whitespace between the marker and the text is absorbed by `\s+`, so that line parses fine.
- The paragraph guard (`adf.ts:137`, `/^#{1,6}\s+/`) refuses every rejected line too.

So no branch consumes the line, the loop index never advances, and the process spins forever. Each of these is reproducible today:

- `af jira comment KEY --add "## "` hangs before sending any request.
- `af jira comment KEY --add "$(cat notes.md)"` hangs when `notes.md` has CRLF line endings and a heading.
- `af confluence create|update --body-file doc.md` hangs on the same kind of file. The file is read verbatim at `commands/confluence.ts:71`. The hang comes after a read-only lookup, and nothing is written.

Nothing is written in any of these cases, but the command never exits. An agent's tool call simply times out, with no error explaining why.

There is a second defect in the same converter. A bare `>` line, alone or between quoted lines, and an empty list item (`- `, `* `, `1. `) produce `{ "type": "text", "text": "" }`; this comes from the `parseInlineMarkdown` fallback at `adf.ts:221-223`. Atlassian's ADF schema requires text nodes to be non-empty, so Jira will most likely reject such a body with a generic HTTP 400.

CRLF input without such a heading does not hang, but every CRLF-terminated line keeps its `\r`:

- the line's last text node ends in `\r`, or a separate `"\r"` text node follows a trailing mark;
- code-block text keeps a `\r` before each newline.

A UTF-8 BOM at the start of a file turns a leading `## Title` into literal paragraph text.

**Why now:** `add-multiline-body-input` will add file and stdin input to every prose flag. That brings CRLF files, Windows clipboard text and BOM-prefixed files into every ADF write path, so this fix is a prerequisite for that change.

## What Changes

- **`textToAdf` always terminates.**
    - Every iteration of the block loop consumes at least one line. A defensive guard turns any future non-advancing iteration into an error rather than a hang.
    - Heading recognition follows CommonMark, the same rule the parser-based converter in `replace-markdown-adf-converter` will apply, so these results will not change again.
        - Outside code blocks, `#{1,6}` followed by a space, a tab or the end of the line is always a heading.
        - Its text is the rest of the line, which may be empty or contain U+2028 / U+2029.
        - A marker followed only by spaces or tabs, or nothing at all (`## `, `#\t`, `#`), becomes a heading with no text node.
- **Line endings are normalized before conversion.**
    - `\r\n` and lone `\r` (CommonMark's line endings) become `\n`.
    - A leading U+FEFF byte-order mark is stripped.
    - Other characters, including U+2028 and U+2029, are left as they are.
- **Output never contains empty text nodes.** The mappings follow CommonMark:
    - a bare `>` line between quoted lines ends the current paragraph, so the blockquote holds several paragraphs;
    - a quote consisting only of bare `>` lines becomes a blockquote with one empty paragraph;
    - an empty list item becomes a list item whose paragraph has no content.
- **Regression tests:**
    - **Hang inputs:** `## `, `#\t`, `## \r`, `## Summary\r\n…`, `## x\r`, U+2028 or U+2029 inside or after the heading text (`## a<U+2028>b`, `## Title<U+2028>`), CRLF documents with and without headings, and BOM-prefixed headings.
        - Each runs in a child process or worker that is killed after a deadline.
        - Vitest's per-test timeout cannot interrupt a synchronous loop, so a hang would otherwise freeze the whole suite instead of failing.
    - **Empty-node inputs:** `>` alone, `> a\n>\n> b`, `- `, `* `, `1. `, and `- a\n- \n- b`.
    - Every output is asserted to contain no empty text node and no `\r` in any text node.

Explicitly **not** part of this change:

- Other converter fidelity gaps: fences directly after a paragraph, nested lists, tables, ordered-list numbering, trailing `#`s on headings and inline-mark nesting. These are in `replace-markdown-adf-converter`.
- New input sources such as `--*-file` or stdin. These are in `add-multiline-body-input`.
- Any change to `adfToText`.

## Capabilities

### New Capabilities

<!-- None: this adds a requirement to an existing capability. -->

### Modified Capabilities

- `atlassian-shared-config`: adds a new requirement, **Robust markdown input for ADF conversion**. It covers:
    - termination;
    - normalization of CRLF and lone-CR line endings and of a leading BOM;
    - CommonMark-consistent handling of marker-only headings, bare `>` lines and empty list items, with no empty text nodes.

    It is a separate requirement rather than an edit to **Shared ADF conversion**. `replace-markdown-adf-converter` rewrites that requirement, and a separate requirement keeps these guarantees from being overwritten when that change is archived. The new requirement refines the existing **Blockquote conversion** scenario: its single paragraph applies to plain-text quoted lines with no bare `>` line between them.

## Impact

- **Code:**
    - `atlassian/lib/adf.ts`: `textToAdf`, the heading branch, the paragraph guard, the blockquote branch, and the `parseInlineMarkdown` fallback;
    - `atlassian/lib/adf.test.ts`, plus a small fixture script for the child-process hang tests.
- **Write paths that benefit:**
    - `jira/lib/client.ts:158,212,272,286,497,512,639`: description, comments, worklogs and transition comments.
    - `confluence/lib/client.ts:89,130,195`: pages and comments. Line 135 converts the constant `''` and is unaffected.
- **Behaviour:**
    - Inputs that used to hang now convert.
    - CRLF input no longer leaves `\r` in text nodes.
    - BOM-prefixed headings render as headings.
    - Bodies containing an empty list item or a bare `>` line stop producing invalid ADF.
    - A line that is only `#` (up to `######`) becomes an empty heading instead of the literal text `#`, as in CommonMark.
    - `#` followed by a non-breaking space or another non-ASCII space, rather than a space or tab, stays paragraph text, as in CommonMark; it used to become a heading.
- **Dependencies:** none. **CLI surface:** unchanged.
