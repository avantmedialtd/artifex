## 1. Implement fenced code block support

- [x] 1.1 Add fence-opening regex (`/^```(\w*)\s*$/`) check as the first block branch in `textToAdf`'s line loop in `atlassian/lib/adf.ts`
- [x] 1.2 Collect lines until a closing fence (`/^```\s*$/`) or end of input
- [x] 1.3 Emit `{ type: 'codeBlock', attrs: language ? { language } : {}, content: [{ type: 'text', text: body }] }`; emit `content: []` for empty bodies
- [x] 1.4 Bypass `parseInlineMarkdown` for code body — content is verbatim

## 2. Implement blockquote support

- [x] 2.1 Add `> ` line check after the fence branch in `textToAdf`
- [x] 2.2 Collect consecutive `> ` lines and strip the prefix
- [x] 2.3 Emit a `blockquote` node containing one `paragraph`; insert `hardBreak` nodes between collected lines (mirroring existing multi-line paragraph logic)

## 3. Implement horizontal rule support

- [x] 3.1 Add `/^(-{3,}|\*{3,})\s*$/` check after the blockquote branch
- [x] 3.2 Emit `{ type: 'rule' }` and advance one line

## 4. Tests

- [x] 4.1 Add `textToAdf` test: fenced block with `typescript` language tag produces `codeBlock` with `attrs.language === 'typescript'`
- [x] 4.2 Add `textToAdf` test: fenced block with no language produces `codeBlock` with no `language` attr
- [x] 4.3 Add `textToAdf` test: fence body containing `- foo`, `# bar`, `1. baz` produces a single `codeBlock` (no list/heading nodes) with body preserved
- [x] 4.4 Add `textToAdf` test: unterminated fence consumes to end of input
- [x] 4.5 Add `textToAdf` test: empty fence body produces `codeBlock` with empty `content`
- [x] 4.6 Add `textToAdf` test: blockquote line(s) produce a `blockquote` containing one `paragraph`
- [x] 4.7 Add `textToAdf` test: standalone `---` line produces a `rule` node
- [x] 4.8 Add round-trip test: fence + blockquote + rule survive `adfToText(textToAdf(x))` byte-equal
- [x] 4.9 Add regression test: existing heading/list/paragraph/inline-mark tests still pass unchanged

## 5. Verify

- [x] 5.1 Run `bun run test` — all `adf.test.ts` cases green
- [x] 5.2 Run `bun run lint` and `bun run format:check`
- [x] 5.3 Manually verify with `af jira create` (or update) using a description containing a fenced code block — render in the Jira UI matches the source markdown
