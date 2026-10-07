<!-- cspell:disable -->

# Converter regression corpus

This is the 66-case corpus of agent-style markdown from the exploration audit that motivated this change. Every `input` is preserved exactly, as a JSON string, so CRLF line endings, tabs, backslashes and backticks survive formatting. The exploration's scratch files are temporary; this file is the durable copy.

The implementation copies the JSON array below, unchanged, into `test/fixtures/adf-corpus.json`, which `atlassian/lib/adf.corpus.test.ts` reads (see design D14).

## Fields

- `id`, `group`, `construct`: identification, as in the audit.
- `input`: the exact markdown passed to `textToAdf()`.
- `expected`: the outline of the ADF that `textToAdf()` must return, in the notation below. It was produced by a throwaway prototype of this design (marked 18.1.0 lexer plus the mapping rules in design.md) and then reviewed case by case against the spec. If an expectation ever conflicts with the spec, the spec wins and the expectation is corrected in the same change.
- `note`: why the expected result looks the way it does, where that is not obvious.

Across all 66 cases the prototype's output also validated against the ADF JSON schema (`@atlaskit/adf-schema` 57.7.1, `full.json`), and `textToAdf(adfToText(textToAdf(input)))` equalled `textToAdf(input)`.

## Notation

- Top-level blocks are joined with `" | "`, children with `", "`, and table rows with `"; "` (the quotes are not part of the separator).
- `p[…]` paragraph; `h2[…]` heading of that level; `ul[…]` bullet list; `ol[…]` ordered list, `ol(start=3)[…]` when `attrs.order` is set; `li[…]` list item; `quote[…]` blockquote; `hr` rule.
- `codeBlock(lang)"body"`: a code block with `attrs.language` (empty when absent) and its body as a JSON string.
- `table[…]`, `row[…]`, `th[…]` (tableHeader), `td[…]` (tableCell).
- Text is a JSON string. Marked text is `marks:"text"`, with mark types sorted alphabetically and joined with `+`; a link mark is written `link<href>` or `link<href "title">`.
- `⏎` is a `hardBreak`. An empty paragraph is `p[]`, and a heading with no text node is `h1[]`.
- Node types the notation does not name print as `type{attrs}[children]`.

Reference implementation (the test helper ports it as is):

```ts
type AdfNode = {
    type: string;
    content?: AdfNode[];
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

const q = (s: string) => JSON.stringify(s);

export function summarizeAdf(node: AdfNode): string {
    const kids = (sep = ', ') => (node.content ?? []).map(summarizeAdf).join(sep);
    switch (node.type) {
        case 'doc':
            return kids(' | ');
        case 'paragraph':
            return `p[${kids()}]`;
        case 'heading':
            return `h${node.attrs?.level}[${kids()}]`;
        case 'bulletList':
            return `ul[${kids()}]`;
        case 'orderedList':
            return `ol${node.attrs?.order !== undefined ? `(start=${node.attrs.order})` : ''}[${kids()}]`;
        case 'listItem':
            return `li[${kids()}]`;
        case 'codeBlock': {
            const body = (node.content ?? []).map(n => n.text ?? '').join('');
            return `codeBlock(${node.attrs?.language ?? ''})${q(body)}`;
        }
        case 'blockquote':
            return `quote[${kids()}]`;
        case 'rule':
            return 'hr';
        case 'hardBreak':
            return '⏎';
        case 'table':
            return `table[${kids('; ')}]`;
        case 'tableRow':
            return `row[${kids()}]`;
        case 'tableHeader':
            return `th[${kids()}]`;
        case 'tableCell':
            return `td[${kids()}]`;
        case 'text': {
            const marks = (node.marks ?? [])
                .map(m => {
                    if (m.type !== 'link') return m.type;
                    const title = m.attrs?.title ? ` "${m.attrs.title}"` : '';
                    return `link<${m.attrs?.href}${title}>`;
                })
                .sort();
            return marks.length ? `${marks.join('+')}:${q(node.text ?? '')}` : q(node.text ?? '');
        }
        default:
            return `${node.type}${node.attrs ? JSON.stringify(node.attrs) : ''}${node.content ? `[${kids()}]` : ''}`;
    }
}
```

## Cases

`````json
[
    {
        "id": "base-heading-list",
        "group": "baseline",
        "construct": "Heading + tight bullet list with bold label and inline code",
        "input": "## Summary\n\n- **Root cause:** stale cache in `getUser()`\n- **Fix:** invalidate on write",
        "expected": "h2[\"Summary\"] | ul[li[p[strong:\"Root cause:\", \" stale cache in \", code:\"getUser()\"]], li[p[strong:\"Fix:\", \" invalidate on write\"]]]"
    },
    {
        "id": "base-heading-after-paragraph",
        "group": "adjacency",
        "construct": "ATX heading directly after a paragraph line (no blank line)",
        "input": "Investigation notes below.\n## Details\nThe cache was stale.",
        "expected": "p[\"Investigation notes below.\"] | h2[\"Details\"] | p[\"The cache was stale.\"]",
        "note": "An ATX heading interrupts a paragraph."
    },
    {
        "id": "base-hr-blank-lines",
        "group": "baseline",
        "construct": "'---' horizontal rule surrounded by blank lines",
        "input": "Part one.\n\n---\n\nPart two.",
        "expected": "p[\"Part one.\"] | hr | p[\"Part two.\"]"
    },
    {
        "id": "base-fence-blank-lines",
        "group": "baseline",
        "construct": "Fenced code block surrounded by blank lines",
        "input": "Run this:\n\n```bash\nnpm ci\n```\n\nDone.",
        "expected": "p[\"Run this:\"] | codeBlock(bash)\"npm ci\" | p[\"Done.\"]"
    },
    {
        "id": "fence-after-paragraph",
        "group": "fence",
        "construct": "Triple-backtick fence immediately after a paragraph line (no blank line)",
        "input": "Here is the fix:\n```ts\nconst retries = 3;\nawait sync(retries);\n```\n\nDone.",
        "expected": "p[\"Here is the fix:\"] | codeBlock(ts)\"const retries = 3;\\nawait sync(retries);\" | p[\"Done.\"]",
        "note": "A fence interrupts a paragraph; no stray backticks."
    },
    {
        "id": "fence-after-paragraph-cascade",
        "group": "fence",
        "construct": "Fence after a paragraph line whose body ends in a list-like line (diff) — closing ``` re-opens a fence",
        "input": "Change this:\n```diff\n+ const timeout = 30_000;\n- const timeout = 5_000;\n```\n\nAfter that, re-run the pipeline.\n\n## Next steps\n\n- deploy to staging",
        "expected": "p[\"Change this:\"] | codeBlock(diff)\"+ const timeout = 30_000;\\n- const timeout = 5_000;\" | p[\"After that, re-run the pipeline.\"] | h2[\"Next steps\"] | ul[li[p[\"deploy to staging\"]]]",
        "note": "The diff line stays code, so the closing fence does not reopen a fence."
    },
    {
        "id": "fence-lang-objc",
        "group": "fence",
        "construct": "Fence whose language contains '-' (objective-c)",
        "input": "```objective-c\n- (void)viewDidLoad {\n    [super viewDidLoad];\n}\n```",
        "expected": "codeBlock(objective-c)\"- (void)viewDidLoad {\\n    [super viewDidLoad];\\n}\"",
        "note": "The language is taken verbatim from the info string."
    },
    {
        "id": "fence-lang-cpp",
        "group": "fence",
        "construct": "Fence whose language contains '+' (c++)",
        "input": "```c++\n#include <vector>\nint main() { return 0; }\n```",
        "expected": "codeBlock(c++)\"#include <vector>\\nint main() { return 0; }\""
    },
    {
        "id": "fence-lang-csharp-hash-body",
        "group": "fence",
        "construct": "Fence whose language contains '#' (c#), body has '# ' comment-like line",
        "input": "```c#\nvar x = 1;\n# not a heading\n```\n\nTrailing paragraph.",
        "expected": "codeBlock(c#)\"var x = 1;\\n# not a heading\" | p[\"Trailing paragraph.\"]",
        "note": "A `#` line inside the fence is code, not a heading."
    },
    {
        "id": "fence-info-string-attrs",
        "group": "fence",
        "construct": "Fence with info string attributes (```ts title=\"a.ts\")",
        "input": "```ts title=\"retry.ts\"\nexport const retries = 3;\n```",
        "expected": "codeBlock(ts)\"export const retries = 3;\"",
        "note": "The language is the first word of the info string."
    },
    {
        "id": "fence-in-list-item",
        "group": "fence",
        "construct": "Fence indented inside an ordered list item (CommonMark-correct 3-space indent)",
        "input": "1. Install:\n   ```bash\n   npm ci\n   ```\n2. Test:\n   ```bash\n   npm test\n   ```",
        "expected": "ol[li[p[\"Install:\"], codeBlock(bash)\"npm ci\"], li[p[\"Test:\"], codeBlock(bash)\"npm test\"]]",
        "note": "A fence indented under a list item is a code block inside that item."
    },
    {
        "id": "fence-tilde",
        "group": "fence",
        "construct": "Tilde fence (~~~)",
        "input": "~~~\nplain code\n~~~",
        "expected": "codeBlock()\"plain code\""
    },
    {
        "id": "fence-four-backticks",
        "group": "fence",
        "construct": "Four-backtick fence wrapping a markdown example",
        "input": "````markdown\n## Example\n```js\nx()\n```\n````",
        "expected": "codeBlock(markdown)\"## Example\\n```js\\nx()\\n```\"",
        "note": "Inner triple-backtick lines are body text of the four-backtick fence."
    },
    {
        "id": "quote-after-paragraph",
        "group": "adjacency",
        "construct": "Blockquote directly after a paragraph line",
        "input": "As the docs say:\n> API tokens expire after 365 days.",
        "expected": "p[\"As the docs say:\"] | quote[p[\"API tokens expire after 365 days.\"]]",
        "note": "A blockquote interrupts a paragraph."
    },
    {
        "id": "hr-stars-after-paragraph",
        "group": "adjacency",
        "construct": "'***' rule directly after a paragraph line",
        "input": "Section one text.\n***\nSection two text.",
        "expected": "p[\"Section one text.\"] | hr | p[\"Section two text.\"]",
        "note": "`***` under a paragraph line is a rule."
    },
    {
        "id": "setext-h2",
        "group": "adjacency",
        "construct": "'---' directly under a text line (setext H2 in CommonMark)",
        "input": "Summary\n---\nEverything passed.",
        "expected": "h2[\"Summary\"] | p[\"Everything passed.\"]",
        "note": "Design decision: `---` directly under text is a setext level-2 heading (CommonMark)."
    },
    {
        "id": "setext-h1",
        "group": "adjacency",
        "construct": "'===' directly under a text line (setext H1)",
        "input": "Release notes\n=============\n\nVersion 2 is out.",
        "expected": "h1[\"Release notes\"] | p[\"Version 2 is out.\"]",
        "note": "`===` under text is a setext level-1 heading."
    },
    {
        "id": "hr-variants",
        "group": "adjacency",
        "construct": "Rule variants '___', '* * *', '- - -'",
        "input": "a\n\n___\n\nb\n\n* * *\n\nc\n\n- - -\n\nd",
        "expected": "p[\"a\"] | hr | p[\"b\"] | hr | p[\"c\"] | hr | p[\"d\"]",
        "note": "Rule variants after blank lines."
    },
    {
        "id": "quote-multi-paragraph",
        "group": "adjacency",
        "construct": "Multi-paragraph blockquote ('>' blank separator line)",
        "input": "> First quoted paragraph.\n>\n> Second quoted paragraph.",
        "expected": "quote[p[\"First quoted paragraph.\"], p[\"Second quoted paragraph.\"]]",
        "note": "A bare `>` line separates paragraphs (fix-adf-converter-hang guarantee)."
    },
    {
        "id": "quote-with-list",
        "group": "adjacency",
        "construct": "Blockquote containing a list",
        "input": "> Reviewer said:\n> - rename the flag\n> - add a test",
        "expected": "quote[p[\"Reviewer said:\"], ul[li[p[\"rename the flag\"]], li[p[\"add a test\"]]]]",
        "note": "Lists are allowed inside an ADF blockquote."
    },
    {
        "id": "quote-nested",
        "group": "adjacency",
        "construct": "Nested blockquote ('>>')",
        "input": "> outer\n>> inner",
        "expected": "quote[p[\"outer\"], p[\"inner\"]]",
        "note": "ADF does not allow a blockquote inside a blockquote: the inner quote is flattened."
    },
    {
        "id": "soft-wrap",
        "group": "adjacency",
        "construct": "Hard-wrapped paragraph (single newlines = soft breaks in CommonMark)",
        "input": "This is a long sentence that the agent wrapped\nat a fixed column for readability.",
        "expected": "p[\"This is a long sentence that the agent wrapped\", ⏎, \"at a fixed column for readability.\"]",
        "note": "Policy: a single newline stays a hard break (CommonMark would render a space)."
    },
    {
        "id": "wrapped-line-starts-with-number",
        "group": "adjacency",
        "construct": "Wrapped paragraph whose continuation line starts with 'NNNN. '",
        "input": "The regression was introduced in the release of\n2024. It affects every tenant.",
        "expected": "p[\"The regression was introduced in the release of\", ⏎, \"2024. It affects every tenant.\"]",
        "note": "`2024.` cannot interrupt a paragraph (only `1.` can), so the line stays in the paragraph after a hard break."
    },
    {
        "id": "gfm-table",
        "group": "table",
        "construct": "GFM pipe table",
        "input": "| Check | Result |\n|-------|--------|\n| lint | pass |\n| tests | 2 failed |",
        "expected": "table[row[th[p[\"Check\"]], th[p[\"Result\"]]]; row[td[p[\"lint\"]], td[p[\"pass\"]]]; row[td[p[\"tests\"]], td[p[\"2 failed\"]]]]",
        "note": "Header row becomes tableHeader cells; each cell holds one paragraph."
    },
    {
        "id": "gfm-table-after-paragraph",
        "group": "table",
        "construct": "GFM table directly after a paragraph line, with alignment and inline code",
        "input": "CI summary:\n| Job | Status | Time |\n|:----|:------:|-----:|\n| `lint` | **pass** | 12s |",
        "expected": "p[\"CI summary:\"] | table[row[th[p[\"Job\"]], th[p[\"Status\"]], th[p[\"Time\"]]]; row[td[p[code:\"lint\"]], td[p[strong:\"pass\"]], td[p[\"12s\"]]]]",
        "note": "A table interrupts a paragraph; column alignment is not carried into ADF."
    },
    {
        "id": "list-nested-2space",
        "group": "list",
        "construct": "Nested bullet list, 2-space indent",
        "input": "- Backend\n  - fixed auth refresh\n  - added tests\n- Frontend\n  - new button",
        "expected": "ul[li[p[\"Backend\"], ul[li[p[\"fixed auth refresh\"]], li[p[\"added tests\"]]]], li[p[\"Frontend\"], ul[li[p[\"new button\"]]]]]",
        "note": "Nested bullet lists."
    },
    {
        "id": "list-nested-4space",
        "group": "list",
        "construct": "Bullets nested under ordered items, 4-space indent",
        "input": "1. Setup\n    - install deps\n    - configure env\n2. Deploy",
        "expected": "ol[li[p[\"Setup\"], ul[li[p[\"install deps\"]], li[p[\"configure env\"]]]], li[p[\"Deploy\"]]]",
        "note": "Bullets nested under ordered items."
    },
    {
        "id": "list-ordered-with-sub-bullets",
        "group": "list",
        "construct": "Ordered list with bold step titles and 3-space sub-bullets (typical agent plan)",
        "input": "1. **Investigate**\n   - checked the logs\n   - found a race in `refresh()`\n2. **Fix**\n   - added a mutex\n3. **Verify**",
        "expected": "ol[li[p[strong:\"Investigate\"], ul[li[p[\"checked the logs\"]], li[p[\"found a race in \", code:\"refresh()\"]]]], li[p[strong:\"Fix\"], ul[li[p[\"added a mutex\"]]]], li[p[strong:\"Verify\"]]]",
        "note": "Typical agent plan: ordered steps with sub-bullets."
    },
    {
        "id": "list-plus",
        "group": "list",
        "construct": "'+' bullets",
        "input": "+ first\n+ second",
        "expected": "ul[li[p[\"first\"]], li[p[\"second\"]]]",
        "note": "`+` bullets."
    },
    {
        "id": "list-paren-ordered",
        "group": "list",
        "construct": "'1)' ordered list",
        "input": "1) first\n2) second",
        "expected": "ol[li[p[\"first\"]], li[p[\"second\"]]]",
        "note": "`1)` ordered list."
    },
    {
        "id": "list-ordered-start-3",
        "group": "list",
        "construct": "Ordered list not starting at 1",
        "input": "3. third\n4. fourth",
        "expected": "ol(start=3)[li[p[\"third\"]], li[p[\"fourth\"]]]",
        "note": "A list that does not start at 1 carries attrs.order."
    },
    {
        "id": "list-ordered-loose",
        "group": "list",
        "construct": "Loose ordered list (blank line between items)",
        "input": "1. First step\n\n2. Second step\n\n3. Third step",
        "expected": "ol[li[p[\"First step\"]], li[p[\"Second step\"]], li[p[\"Third step\"]]]",
        "note": "Loose and tight lists map to the same ADF."
    },
    {
        "id": "list-ordered-interrupted-by-fence",
        "group": "list",
        "construct": "Ordered steps separated by unindented fences",
        "input": "1. Install:\n\n```bash\nnpm ci\n```\n\n2. Test:\n\n```bash\nnpm test\n```",
        "expected": "ol[li[p[\"Install:\"]]] | codeBlock(bash)\"npm ci\" | ol(start=2)[li[p[\"Test:\"]]] | codeBlock(bash)\"npm test\"",
        "note": "The second list keeps its number through attrs.order = 2."
    },
    {
        "id": "list-task",
        "group": "list",
        "construct": "Task list '- [ ]' / '- [x]'",
        "input": "- [x] reproduce the bug\n- [ ] write a regression test\n- [ ] ship the fix",
        "expected": "ul[li[p[\"☑ reproduce the bug\"]], li[p[\"☐ write a regression test\"]], li[p[\"☐ ship the fix\"]]]",
        "note": "Task-list fallback: bullet items prefixed with U+2611 (done) / U+2610 (open) and a space; no taskList."
    },
    {
        "id": "list-continuation-paragraph",
        "group": "list",
        "construct": "List item with an indented continuation paragraph",
        "input": "- Item one\n\n  More detail about item one.\n\n- Item two",
        "expected": "ul[li[p[\"Item one\"], p[\"More detail about item one.\"]], li[p[\"Item two\"]]]",
        "note": "An indented continuation paragraph stays in the list item."
    },
    {
        "id": "list-lazy-continuation",
        "group": "list",
        "construct": "List item with a lazy (unindented) continuation line",
        "input": "- Item one that wraps\nonto a second line\n- Item two",
        "expected": "ul[li[p[\"Item one that wraps\", ⏎, \"onto a second line\"]], li[p[\"Item two\"]]]",
        "note": "A lazy continuation line stays in the item, after a hard break."
    },
    {
        "id": "list-empty-item",
        "group": "list",
        "construct": "Empty bullet item ('- ')",
        "input": "- first\n- \n- third",
        "expected": "ul[li[p[\"first\"]], li[p[]], li[p[\"third\"]]]",
        "note": "An empty item becomes a list item with an empty paragraph (fix-adf-converter-hang guarantee)."
    },
    {
        "id": "inline-strike",
        "group": "inline",
        "construct": "~~strikethrough~~",
        "input": "The fix is ~~a retry~~ a lock.",
        "expected": "p[\"The fix is \", strike:\"a retry\", \" a lock.\"]",
        "note": "Strikethrough maps to the strike mark."
    },
    {
        "id": "inline-underscore",
        "group": "inline",
        "construct": "__bold__ and _italic_",
        "input": "This is __important__ and _subtle_.",
        "expected": "p[\"This is \", strong:\"important\", \" and \", em:\"subtle\", \".\"]",
        "note": "Underscore emphasis."
    },
    {
        "id": "inline-bold-italic",
        "group": "inline",
        "construct": "***bold-italic***",
        "input": "This is ***critical***.",
        "expected": "p[\"This is \", em+strong:\"critical\", \".\"]",
        "note": "Marks nest."
    },
    {
        "id": "inline-bold-wrapping-code",
        "group": "inline",
        "construct": "Bold wrapping inline code (**`cmd`**)",
        "input": "**`af jira comment`** sends the text as-is.",
        "expected": "p[code:\"af jira comment\", \" sends the text as-is.\"]",
        "note": "The code mark combines only with link: strong is dropped for the code span."
    },
    {
        "id": "inline-bold-containing-code",
        "group": "inline",
        "construct": "Bold sentence containing inline code",
        "input": "Note: **run `bun run test` before pushing**.",
        "expected": "p[\"Note: \", strong:\"run \", code:\"bun run test\", strong:\" before pushing\", \".\"]",
        "note": "Strong is dropped only for the code span inside it."
    },
    {
        "id": "inline-link-text-code",
        "group": "inline",
        "construct": "Link whose text is inline code ([`file.ts`](url))",
        "input": "See [`adf.ts`](https://github.com/org/repo/blob/main/atlassian/lib/adf.ts).",
        "expected": "p[\"See \", code+link<https://github.com/org/repo/blob/main/atlassian/lib/adf.ts>:\"adf.ts\", \".\"]",
        "note": "code + link is the one allowed combination."
    },
    {
        "id": "inline-link-in-bold",
        "group": "inline",
        "construct": "Link inside bold",
        "input": "**See [the runbook](https://example.com/runbook)**",
        "expected": "p[strong:\"See \", link<https://example.com/runbook>+strong:\"the runbook\"]",
        "note": "Marks nest across a link."
    },
    {
        "id": "inline-link-parens",
        "group": "inline",
        "construct": "Link URL containing parentheses",
        "input": "See [Foo](https://en.wikipedia.org/wiki/Foo_(bar)) for details.",
        "expected": "p[\"See \", link<https://en.wikipedia.org/wiki/Foo_(bar)>:\"Foo\", \" for details.\"]",
        "note": "Balanced parentheses stay in the URL."
    },
    {
        "id": "inline-link-title",
        "group": "inline",
        "construct": "Link with a title attribute",
        "input": "See [docs](https://example.com \"Docs\") please.",
        "expected": "p[\"See \", link<https://example.com \"Docs\">:\"docs\", \" please.\"]",
        "note": "The title goes to the link mark title attribute, not the URL."
    },
    {
        "id": "inline-bare-url",
        "group": "inline",
        "construct": "Bare URL and <autolink>",
        "input": "Build log: https://ci.example.com/job/42 and <https://example.com/x>",
        "expected": "p[\"Build log: \", link<https://ci.example.com/job/42>:\"https://ci.example.com/job/42\", \" and \", link<https://example.com/x>:\"https://example.com/x\"]",
        "note": "GFM bare URLs and <url> autolinks become links."
    },
    {
        "id": "inline-image",
        "group": "inline",
        "construct": "Image ![alt](url)",
        "input": "![screenshot](https://example.com/shot.png)",
        "expected": "p[link<https://example.com/shot.png>:\"screenshot\"]",
        "note": "Images become link-marked alt text; no stray `!`."
    },
    {
        "id": "inline-star-false-positive",
        "group": "inline",
        "construct": "Unpaired/arith asterisks (globs, multiplication)",
        "input": "Matches *.ts and *.tsx files; 2 * 3 * 4 = 24.",
        "expected": "p[\"Matches *.ts and *.tsx files; 2 * 3 * 4 = 24.\"]",
        "note": "Asterisks that cannot open or close emphasis stay literal."
    },
    {
        "id": "inline-backslash-escape",
        "group": "inline",
        "construct": "Backslash escapes (\\*, \\_, \\#)",
        "input": "Use \\*args, \\_private and \\# literally.",
        "expected": "p[\"Use *args, _private and # literally.\"]",
        "note": "Backslash escapes produce the literal character."
    },
    {
        "id": "inline-trailing-backslash-break",
        "group": "inline",
        "construct": "Hard line break via trailing backslash",
        "input": "line one\\\nline two",
        "expected": "p[\"line one\", ⏎, \"line two\"]",
        "note": "A trailing backslash is a hard break."
    },
    {
        "id": "inline-emphasis-across-lines",
        "group": "inline",
        "construct": "Bold spanning a wrapped line",
        "input": "**This warning wraps\nonto the next line**",
        "expected": "p[strong:\"This warning wraps\", ⏎, strong:\"onto the next line\"]",
        "note": "Emphasis spans the hard break; the hardBreak itself carries no marks."
    },
    {
        "id": "inline-emoji-shortcode",
        "group": "inline",
        "construct": "Emoji shortcode",
        "input": ":white_check_mark: tests pass",
        "expected": "p[\":white_check_mark: tests pass\"]",
        "note": "Emoji shortcodes stay literal."
    },
    {
        "id": "inline-reference-link",
        "group": "inline",
        "construct": "Reference-style link + footnote",
        "input": "See [the RFC][rfc] and note[^1].\n\n[rfc]: https://example.com/rfc\n[^1]: Source.",
        "expected": "p[\"See \", link<https://example.com/rfc>:\"the RFC\", \" and note[^1].\"] | p[\"[^1]: Source.\"]",
        "note": "Reference links resolve. GFM footnotes are not supported: `[^1]` and its definition stay literal text."
    },
    {
        "id": "heading-trailing-hashes",
        "group": "heading",
        "construct": "Heading with closing '#'s",
        "input": "## Summary ##",
        "expected": "h2[\"Summary\"]",
        "note": "The closing `#` sequence is stripped."
    },
    {
        "id": "heading-no-space",
        "group": "heading",
        "construct": "'#' without a following space",
        "input": "#123 is fixed\n#hashtag",
        "expected": "p[\"#123 is fixed\", ⏎, \"#hashtag\"]",
        "note": "`#` without a following space is not a heading."
    },
    {
        "id": "heading-empty-hash-space",
        "group": "heading",
        "construct": "Empty heading: line is exactly '# ' (hash + one space)",
        "input": "Intro\n\n# \n\nOutro",
        "expected": "p[\"Intro\"] | h1[] | p[\"Outro\"]",
        "note": "A marker-only heading has no text node (fix-adf-converter-hang guarantee)."
    },
    {
        "id": "crlf-no-heading",
        "group": "crlf",
        "construct": "CRLF line endings, list + paragraph (no heading)",
        "input": "Summary text\r\n\r\n- one\r\n- two\r\n",
        "expected": "p[\"Summary text\"] | ul[li[p[\"one\"]], li[p[\"two\"]]]",
        "note": "CRLF is normalized; no `\\r` in any text node."
    },
    {
        "id": "crlf-heading",
        "group": "crlf",
        "construct": "CRLF line endings with an ATX heading",
        "input": "## Summary\r\n\r\n- one\r\n- two\r\n",
        "expected": "h2[\"Summary\"] | ul[li[p[\"one\"]], li[p[\"two\"]]]",
        "note": "CRLF is normalized before parsing (former hang input)."
    },
    {
        "id": "indented-code-4space",
        "group": "indent",
        "construct": "4-space indented code block",
        "input": "Output:\n\n    $ af jira get PROJ-1\n    Error: **401** Unauthorized",
        "expected": "p[\"Output:\"] | codeBlock()\"$ af jira get PROJ-1\\nError: **401** Unauthorized\"",
        "note": "Indented code becomes a code block without a language; `**` inside stays literal."
    },
    {
        "id": "indented-code-tab",
        "group": "indent",
        "construct": "Tab-indented code block",
        "input": "Output:\n\n\tconst a = b * c * d;",
        "expected": "p[\"Output:\"] | codeBlock()\"const a = b * c * d;\"",
        "note": "Tab-indented code."
    },
    {
        "id": "html-details",
        "group": "html",
        "construct": "Raw HTML <details>/<summary> wrapping a fence",
        "input": "<details>\n<summary>Full log</summary>\n\n```\nError: boom\n    at main (x.ts:1)\n```\n\n</details>",
        "expected": "p[\"<details>\", ⏎, \"<summary>Full log</summary>\"] | codeBlock()\"Error: boom\\n    at main (x.ts:1)\" | p[\"</details>\"]",
        "note": "Raw HTML blocks become literal text paragraphs; the fence between them is still a code block."
    },
    {
        "id": "html-inline",
        "group": "html",
        "construct": "Inline HTML (<br>, <kbd>, <!-- comment -->)",
        "input": "Press <kbd>Ctrl</kbd>+<kbd>C</kbd><br>then retry. <!-- agent:run-42 -->",
        "expected": "p[\"Press <kbd>Ctrl</kbd>+<kbd>C</kbd><br>then retry. <!-- agent:run-42 -->\"]",
        "note": "Inline HTML, including comments, is kept as literal text."
    },
    {
        "id": "inline-angle-placeholders",
        "group": "html",
        "construct": "Angle-bracket placeholders / generics outside backticks (<ISSUE-KEY>, Promise<void>)",
        "input": "Run af jira get <ISSUE-KEY>; it returns Promise<void>. Set <your-token> first.",
        "expected": "p[\"Run af jira get <ISSUE-KEY>; it returns Promise<void>. Set <your-token> first.\"]",
        "note": "HTML-looking placeholders are kept verbatim, never dropped."
    },
    {
        "id": "key-value-lines",
        "group": "adjacency",
        "construct": "Consecutive '**Key:** value' lines (soft breaks before emphasis)",
        "input": "**Status:** fixed\n**PR:** https://bitbucket.org/ws/repo/pull-requests/42\n**Tests:** passing",
        "expected": "p[strong:\"Status:\", \" fixed\", ⏎, strong:\"PR:\", \" \", link<https://bitbucket.org/ws/repo/pull-requests/42>:\"https://bitbucket.org/ws/repo/pull-requests/42\", ⏎, strong:\"Tests:\", \" passing\"]",
        "note": "Hard breaks keep `**Key:** value` lines apart."
    },
    {
        "id": "composite-agent-update",
        "group": "composite",
        "construct": "Realistic agent status comment (headings, nested list, fence after text, table, tasks)",
        "input": "## Summary\n\nFixed the token refresh race. Root cause:\n```ts\nif (!token) refresh(); // not awaited\n```\n\n### Changes\n\n1. **Client**\n   - await `refresh()`\n   - add mutex\n2. **Tests**\n   - new regression test\n\n| Suite | Result |\n|-------|--------|\n| unit | pass |\n\n### Follow-ups\n\n- [ ] backport to 0.2.x\n- [x] update changelog",
        "expected": "h2[\"Summary\"] | p[\"Fixed the token refresh race. Root cause:\"] | codeBlock(ts)\"if (!token) refresh(); // not awaited\" | h3[\"Changes\"] | ol[li[p[strong:\"Client\"], ul[li[p[\"await \", code:\"refresh()\"]], li[p[\"add mutex\"]]]], li[p[strong:\"Tests\"], ul[li[p[\"new regression test\"]]]]] | table[row[th[p[\"Suite\"]], th[p[\"Result\"]]]; row[td[p[\"unit\"]], td[p[\"pass\"]]]] | h3[\"Follow-ups\"] | ul[li[p[\"☐ backport to 0.2.x\"]], li[p[\"☑ update changelog\"]]]",
        "note": "Fence after text, nested ordered and bullet lists, a table, and the task-list fallback."
    }
]
`````
