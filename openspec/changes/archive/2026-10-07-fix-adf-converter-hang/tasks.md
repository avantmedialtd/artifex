## 1. Normalize line endings and the byte-order mark

- [x] 1.1 In `atlassian/lib/adf.ts`, add a module-private `normalizeMarkdownInput(text)` (design D1). It:
    - removes one leading U+FEFF (`/^\uFEFF/`);
    - replaces `/\r\n?/g` with `\n`;
    - leaves every other character unchanged, including U+2028 and U+2029.
- [x] 1.2 Call it at the start of `textToAdf`, before the `split('\n')` at `adf.ts:8`.
- [x] 1.3 Run `bun run test atlassian/lib/adf.test.ts` (never `bun test`). The 28 existing tests still pass.

## 2. Share one ATX-heading predicate

- [x] 2.1 Add a module-level `matchAtxHeading(line)` (design D2). It returns `null`, or `{ level, text }` when the line matches `/^(#{1,6})(?=[ \t]|$)/`.
    - `text` is the rest of the line with leading and trailing spaces and tabs removed.
    - Strip them with an index scan over spaces and tabs, not `trim()`, so U+2028 and U+2029 survive. Do not use a trailing-whitespace regex such as `[ \t]+$`: it backtracks quadratically on a long run of spaces inside the text (see 7.1).
- [x] 2.2 Replace the heading regex at `adf.ts:74` with `matchAtxHeading(line)`, building the heading's content as `parseInlineMarkdown(heading.text)`.
- [x] 2.3 Replace the paragraph guard `!/^#{1,6}\s+/.test(lines[i])` at `adf.ts:137` with `matchAtxHeading(lines[i]) === null`. Afterwards, `grep -n '#{1,6}' atlassian/lib/adf.ts` shows only the predicate's regex.
- [x] 2.4 Run `bun run test atlassian/lib/adf.test.ts`. The existing tests still pass.

## 3. Add the defensive progress guard

- [x] 3.1 In the block loop, keep the index at which the previous iteration started (design D3).
    - At the top of each iteration, if `i` equals it, throw ``new Error(`textToAdf: no block consumed line ${i + 1} (converter bug)`)``.
    - Report the line number only, never the line's content.
    - Add a one-line comment saying the guard is unreachable while the heading branch and the paragraph guard share `matchAtxHeading`.
- [x] 3.2 Prove the guard once, then discard the edit.
    - Temporarily give the heading branch its old regex `/^(#{1,6})\s+(.+)$/` back, and leave the paragraph guard on `matchAtxHeading`.
    - Do not restore the old paragraph guard instead. With the new heading branch, `## ` is consumed as an empty heading, so nothing stalls and the command below exits `0`.
    - Run `timeout 10 bun -e 'import { textToAdf } from "./atlassian/lib/adf.ts"; textToAdf("intro\n\n## \nmore");'` from the repository root. `timeout` comes from coreutils (Homebrew on macOS).
    - It must exit `1` with `textToAdf: no block consumed line 3 (converter bug)` instead of hanging.
    - Put `matchAtxHeading` back in the heading branch.

## 4. Remove empty text nodes

- [x] 4.1 In `parseInlineMarkdown`, delete the fallback that pushes `{ type: 'text', text }` when no node was produced (`adf.ts:220-223`) (design D4).
    - `parseInlineMarkdown('')` then returns `[]`.
    - Non-empty text without marks is still emitted by the remaining-text branch (`adf.ts:216-218`).
- [x] 4.2 Rework the blockquote branch (`adf.ts:44-64`) (design D5):
    - Keep collecting lines that match `/^>\s?/`.
    - A bare line (`/^>\s*$/`) closes the current paragraph.
    - A run of bare lines, and bare lines at the start or end of the quote, add no paragraph.
    - Lines that carry text stay one paragraph joined by `hardBreak`, as today.
    - When no line carries text, emit `blockquote` with one `paragraph` whose `content` is `[]`.
- [x] 4.3 Confirm the list branches need no change (design D6). `- `, `* `, `1. ` and the middle item of `- a\n- \n- b` now yield `listItem` → `paragraph` with `content: []`.
- [x] 4.4 Run `bun run test atlassian/lib/adf.test.ts`. The existing tests still pass, including "should collapse consecutive > lines…" and the three round-trip tests.

## 5. Child-process hang harness and scenario tests

- [x] 5.1 Create `test/fixtures/text-to-adf.ts` (design D8). It:
    - reads stdin with `readFileSync(0, 'utf8')` and `JSON.parse`s it;
    - throws unless the result is a string;
    - calls `textToAdf` imported from `../../atlassian/lib/adf.ts`;
    - writes `JSON.stringify(doc)` to stdout.

    Use only `node:fs` and `process`, with no `Bun` globals, so `tsc` type-checks the file. `tsc` treats the file as CommonJS, because `test/fixtures/package.json` has no `"type"` field, so do not use top-level `await` or `import.meta` in it (design D8). `test/` is outside the `package.json` `files` allowlist.

- [x] 5.2 In `atlassian/lib/adf.test.ts`, add `convertInChild(input)`:
    - Resolve the fixture path from `import.meta.url`.
    - Run `spawnSync('bun', [fixture], { input: JSON.stringify(input), encoding: 'utf8', timeout: 5_000, killSignal: 'SIGKILL' })`.
    - On `ETIMEDOUT`, throw `textToAdf did not finish within 5000 ms for <JSON-encoded input>`.
    - On any other spawn error, throw that error's message.
    - On a non-zero exit, throw the child's stderr.
    - Otherwise return the parsed document.
- [x] 5.3 Add `expectWellFormed(doc)`, which walks every text node and asserts that its text is non-empty and contains no `\r`. Call it on every output in the new tests, child and in-process alike.
- [x] 5.4 Add a `describe` block for the inputs that hang today, plus the CRLF-without-heading and BOM inputs.
    - Each case calls `convertInChild` with a 15 s Vitest timeout and asserts its exact expected structure, taken from the spec scenario where one exists.
    - The inputs: `## `, `#\t`, `## \r`, `## x\r`, `## Summary\r\n\r\n- one\r\n- two\r\n`, the document of the "CRLF line endings" scenario, `para one\r\nline two\r\n\r\n- a\r\n- b\r\n`, `## Summary\rBody`, `intro\n## \noutro`, `## a\u2028b`, `## Title\u2028`, `## a\u2029b`, `## Title\u2029`, and `\ufeff## Title\nbody`.
    - Write special characters as escape sequences in the source, never as literal characters.
- [x] 5.5 Add in-process cases, with exact expected structures, for the remaining scenarios. None of these inputs loops on today's converter.
    - Fenced code: the CRLF fenced code block.
    - Headings: `#`, `###   `, `######`, `##   Title \t`, `intro\n#`.
    - Paragraph text: `#hashtag`, `#123`, `#######`, and `#\u00A0Title`. The last one checks the space-or-tab rule of design D2. It was a heading before this change, and it is the only test that fails if the opening accepts `\s` instead of a space or tab.
    - Quotes: `> a\n>\n> b`, `> a\n> \n> b`, `> a\n>\n>\n> b`, `>\n> a\n>`, `>`, `> `, `>\n>`, `> line 1\n> line 2`.
    - Lists: `- `, `* `, `1. `, `- a\n- \n- b`.
    - Empty documents: `''` and `'\ufeff'`, which give `content: []`.
- [x] 5.6 Add a `parseInlineMarkdown('')` test that expects `[]`.
- [x] 5.7 Prove the harness once, then restore.
    - Run `git stash push -- atlassian/lib/adf.ts`, then `bun run test atlassian/lib/adf.test.ts`.
    - The hang cases fail with the deadline message, and the run completes in about a minute instead of freezing.
    - The cases whose output this change alters fail on their assertions. The cases whose output it keeps still pass: `#hashtag`, `#123`, `#######`, `> line 1\n> line 2` and the two empty documents.
    - Run `git stash pop`.

## 6. Verification

- [x] 6.1 `bun run test` passes. At `b2ad5f1` the baseline is 42 files: 688 passed, 5 skipped.
- [x] 6.2 `bun run lint`, `bun run format:check` and `bun run spell:check` pass.
- [x] 6.3 Type-check the touched files.
    - `npx tsc --noEmit` already exits 1 at `b2ad5f1` because of errors in other files: `bun-upgrade.test.ts`, `npm-upgrade.test.ts`, `commands/bitbucket.test.ts`, `resources/copy-prompt-reporter.ts` and `sonar/lib/*.test.ts`.
    - `npx tsc --noEmit --pretty false 2>&1 | grep -E 'atlassian/lib/adf|test/fixtures/text-to-adf'` prints nothing. TypeScript 7 colors its output even when piped, so `--pretty false` keeps the grep reliable.
- [x] 6.4 `npm pack --dry-run` lists no file under `test/`.
- [x] 6.5 `openspec validate fix-adf-converter-hang --strict` passes.
- [ ] 6.6 (Optional; needs the user's go-ahead.) Live acceptance check, only on a scratch Jira issue and Confluence page the user names.
    - Send `#`, `>`, `- ` and a three-line list whose middle item is empty, all with real newlines, as:
        - a Jira comment;
        - a Jira description;
        - a Confluence page body.
    - Confirm that no request is rejected, and record the result under design Open Questions.
    - If this is skipped, these empty-content shapes ship unverified until `replace-markdown-adf-converter` task 9.4.

## 7. Follow-ups from adversarial verification

An independent verification pass (exhaustive and random fuzzing, a spec-conformance check, an old-versus-new corpus diff and a code review) found no correctness violations. It confirmed the issues below.

- [x] 7.1 Replace the heading-text strip regex with an index scan (design D2).
    - `/^[ \t]+|[ \t]+$/g` took about 35 s on `# a` + 200,000 spaces + `b` under Bun; the converter before this change took 1 ms.
    - Add a child-process case: a heading with 200,000 spaces inside its text converts within the deadline.
- [x] 7.2 Append inline nodes one at a time instead of spreading them into `push()` (design D9).
    - A single paragraph or quote line of about 250 KB of inline marks threw `RangeError: Maximum call stack size exceeded` under Node. This predates the change but contradicts "returns an ADF document for every input string".
    - Add an in-process test: a paragraph and a quote of 400,000 inline nodes.
- [x] 7.3 Pin "remove one leading byte-order mark": add in-process cases for two leading BOMs (the second stays as text) and a BOM inside text (kept). Without them, a mutant that strips every BOM passed the suite.
- [x] 7.4 Mutation-check the new tests: putting back the quadratic regex, the spread `push()`, a strip-every-BOM regex or a strip-every-leading-BOM regex each fails the matching test, and nothing else.
- [x] 7.5 Re-run 6.1-6.5.

<!-- cspell:words ETIMEDOUT FEFF ufeff -->
