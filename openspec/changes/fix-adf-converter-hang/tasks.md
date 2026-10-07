## 1. Normalize line endings and the byte-order mark

- [ ] 1.1 In `atlassian/lib/adf.ts`, add a module-private `normalizeMarkdownInput(text)` (design D1). It:
    - removes one leading U+FEFF (`/^\uFEFF/`);
    - replaces `/\r\n?/g` with `\n`;
    - leaves every other character unchanged, including U+2028 and U+2029.
- [ ] 1.2 Call it at the start of `textToAdf`, before the `split('\n')` at `adf.ts:8`.
- [ ] 1.3 Run `bun run test atlassian/lib/adf.test.ts` (never `bun test`). The 28 existing tests still pass.

## 2. Share one ATX-heading predicate

- [ ] 2.1 Add a module-level `matchAtxHeading(line)` (design D2). It returns `null`, or `{ level, text }` when the line matches `/^(#{1,6})(?=[ \t]|$)/`.
    - `text` is the rest of the line with leading and trailing spaces and tabs removed.
    - Use `/^[ \t]+|[ \t]+$/g`, not `trim()`, so U+2028 and U+2029 survive.
- [ ] 2.2 Replace the heading regex at `adf.ts:74` with `matchAtxHeading(line)`, building the heading's content as `parseInlineMarkdown(heading.text)`.
- [ ] 2.3 Replace the paragraph guard `!/^#{1,6}\s+/.test(lines[i])` at `adf.ts:137` with `matchAtxHeading(lines[i]) === null`. Afterwards, `grep -n '#{1,6}' atlassian/lib/adf.ts` shows only the predicate's regex.
- [ ] 2.4 Run `bun run test atlassian/lib/adf.test.ts`. The existing tests still pass.

## 3. Add the defensive progress guard

- [ ] 3.1 In the block loop, keep the index at which the previous iteration started (design D3).
    - At the top of each iteration, if `i` equals it, throw ``new Error(`textToAdf: no block consumed line ${i + 1} (converter bug)`)``.
    - Report the line number only, never the line's content.
    - Add a one-line comment saying the guard is unreachable while the heading branch and the paragraph guard share `matchAtxHeading`.
- [ ] 3.2 Prove the guard once, then discard the edit.
    - Temporarily give the heading branch its old regex `/^(#{1,6})\s+(.+)$/` back, and leave the paragraph guard on `matchAtxHeading`.
    - Do not restore the old paragraph guard instead. With the new heading branch, `## ` is consumed as an empty heading, so nothing stalls and the command below exits `0`.
    - Run `timeout 10 bun -e 'import { textToAdf } from "./atlassian/lib/adf.ts"; textToAdf("intro\n\n## \nmore");'` from the repository root. `timeout` comes from coreutils (Homebrew on macOS).
    - It must exit `1` with `textToAdf: no block consumed line 3 (converter bug)` instead of hanging.
    - Put `matchAtxHeading` back in the heading branch.

## 4. Remove empty text nodes

- [ ] 4.1 In `parseInlineMarkdown`, delete the fallback that pushes `{ type: 'text', text }` when no node was produced (`adf.ts:220-223`) (design D4).
    - `parseInlineMarkdown('')` then returns `[]`.
    - Non-empty text without marks is still emitted by the remaining-text branch (`adf.ts:216-218`).
- [ ] 4.2 Rework the blockquote branch (`adf.ts:44-64`) (design D5):
    - Keep collecting lines that match `/^>\s?/`.
    - A bare line (`/^>\s*$/`) closes the current paragraph.
    - A run of bare lines, and bare lines at the start or end of the quote, add no paragraph.
    - Lines that carry text stay one paragraph joined by `hardBreak`, as today.
    - When no line carries text, emit `blockquote` with one `paragraph` whose `content` is `[]`.
- [ ] 4.3 Confirm the list branches need no change (design D6). `- `, `* `, `1. ` and the middle item of `- a\n- \n- b` now yield `listItem` → `paragraph` with `content: []`.
- [ ] 4.4 Run `bun run test atlassian/lib/adf.test.ts`. The existing tests still pass, including "should collapse consecutive > lines…" and the three round-trip tests.

## 5. Child-process hang harness and scenario tests

- [ ] 5.1 Create `test/fixtures/text-to-adf.ts` (design D8). It:
    - reads stdin with `readFileSync(0, 'utf8')` and `JSON.parse`s it;
    - throws unless the result is a string;
    - calls `textToAdf` imported from `../../atlassian/lib/adf.ts`;
    - writes `JSON.stringify(doc)` to stdout.

    Use only `node:fs` and `process`, with no `Bun` globals, so `tsc` type-checks the file. `tsc` treats the file as CommonJS, because `test/fixtures/package.json` has no `"type"` field, so do not use top-level `await` or `import.meta` in it (design D8). `test/` is outside the `package.json` `files` allowlist.

- [ ] 5.2 In `atlassian/lib/adf.test.ts`, add `convertInChild(input)`:
    - Resolve the fixture path from `import.meta.url`.
    - Run `spawnSync('bun', [fixture], { input: JSON.stringify(input), encoding: 'utf8', timeout: 5_000, killSignal: 'SIGKILL' })`.
    - On `ETIMEDOUT`, throw `textToAdf did not finish within 5000 ms for <JSON-encoded input>`.
    - On any other spawn error, throw that error's message.
    - On a non-zero exit, throw the child's stderr.
    - Otherwise return the parsed document.
- [ ] 5.3 Add `expectWellFormed(doc)`, which walks every text node and asserts that its text is non-empty and contains no `\r`. Call it on every output in the new tests, child and in-process alike.
- [ ] 5.4 Add a `describe` block for the inputs that hang today, plus the CRLF-without-heading and BOM inputs.
    - Each case calls `convertInChild` with a 15 s Vitest timeout and asserts its exact expected structure, taken from the spec scenario where one exists.
    - The inputs: `## `, `#\t`, `## \r`, `## x\r`, `## Summary\r\n\r\n- one\r\n- two\r\n`, the document of the "CRLF line endings" scenario, `para one\r\nline two\r\n\r\n- a\r\n- b\r\n`, `## Summary\rBody`, `intro\n## \noutro`, `## a\u2028b`, `## Title\u2028`, `## a\u2029b`, `## Title\u2029`, and `\ufeff## Title\nbody`.
    - Write special characters as escape sequences in the source, never as literal characters.
- [ ] 5.5 Add in-process cases, with exact expected structures, for the remaining scenarios. None of these inputs loops on today's converter.
    - Fenced code: the CRLF fenced code block.
    - Headings: `#`, `###   `, `######`, `##   Title \t`, `intro\n#`.
    - Paragraph text: `#hashtag`, `#123`, `#######`, and `#\u00A0Title`. The last one checks the space-or-tab rule of design D2. It was a heading before this change, and it is the only test that fails if the opening accepts `\s` instead of a space or tab.
    - Quotes: `> a\n>\n> b`, `> a\n> \n> b`, `> a\n>\n>\n> b`, `>\n> a\n>`, `>`, `> `, `>\n>`, `> line 1\n> line 2`.
    - Lists: `- `, `* `, `1. `, `- a\n- \n- b`.
    - Empty documents: `''` and `'\ufeff'`, which give `content: []`.
- [ ] 5.6 Add a `parseInlineMarkdown('')` test that expects `[]`.
- [ ] 5.7 Prove the harness once, then restore.
    - Run `git stash push -- atlassian/lib/adf.ts`, then `bun run test atlassian/lib/adf.test.ts`.
    - The hang cases fail with the deadline message, and the run completes in about a minute instead of freezing.
    - The cases whose output this change alters fail on their assertions. The cases whose output it keeps still pass: `#hashtag`, `#123`, `#######`, `> line 1\n> line 2` and the two empty documents.
    - Run `git stash pop`.

## 6. Verification

- [ ] 6.1 `bun run test` passes. At `b2ad5f1` the baseline is 42 files: 688 passed, 5 skipped.
- [ ] 6.2 `bun run lint`, `bun run format:check` and `bun run spell:check` pass.
- [ ] 6.3 Type-check the touched files.
    - `npx tsc --noEmit` already exits 1 at `b2ad5f1` because of errors in other files: `bun-upgrade.test.ts`, `npm-upgrade.test.ts`, `commands/bitbucket.test.ts`, `resources/copy-prompt-reporter.ts` and `sonar/lib/*.test.ts`.
    - `npx tsc --noEmit --pretty false 2>&1 | grep -E 'atlassian/lib/adf|test/fixtures/text-to-adf'` prints nothing. TypeScript 7 colors its output even when piped, so `--pretty false` keeps the grep reliable.
- [ ] 6.4 `npm pack --dry-run` lists no file under `test/`.
- [ ] 6.5 `openspec validate fix-adf-converter-hang --strict` passes.
- [ ] 6.6 (Optional; needs the user's go-ahead.) Live acceptance check, only on a scratch Jira issue and Confluence page the user names.
    - Send `#`, `>`, `- ` and a three-line list whose middle item is empty, all with real newlines, as:
        - a Jira comment;
        - a Jira description;
        - a Confluence page body.
    - Confirm that no request is rejected, and record the result under design Open Questions.
    - If this is skipped, these empty-content shapes ship unverified until `replace-markdown-adf-converter` task 9.4.

<!-- cspell:words ETIMEDOUT FEFF ufeff -->
