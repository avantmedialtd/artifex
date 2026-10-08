// cspell:words autolinks kwargs

import { describe, expect, it } from 'vitest';
import { textToAdf } from './adf.ts';
import { adfToMarkdown } from './adf-to-markdown.ts';
import type { AdfDocument, AdfMark, AdfNode } from './adf-types.ts';

// The renderer is tested on hand-built ADF, as Jira and Confluence return it.
// Reading the output back with textToAdf is covered by the converter tests,
// except in the regression tests that use expectRoundTrip.

const NBSP = String.fromCharCode(0xa0);
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const CR = String.fromCharCode(13);
const BALLOT_BOX = String.fromCharCode(0x2610);

const strong: AdfMark = { type: 'strong' };
const em: AdfMark = { type: 'em' };
const strike: AdfMark = { type: 'strike' };
const code: AdfMark = { type: 'code' };
const link = (href: string, title?: string): AdfMark => ({
    type: 'link',
    attrs: title === undefined ? { href } : { href, title },
});

const text = (value: string, ...marks: AdfMark[]): AdfNode =>
    marks.length > 0 ? { type: 'text', text: value, marks } : { type: 'text', text: value };
const br: AdfNode = { type: 'hardBreak' };
const p = (...content: (AdfNode | string)[]): AdfNode => ({
    type: 'paragraph',
    content: content.map(node => (typeof node === 'string' ? text(node) : node)),
});
const heading = (level: number, ...content: (AdfNode | string)[]): AdfNode => ({
    type: 'heading',
    attrs: { level },
    content: content.map(node => (typeof node === 'string' ? text(node) : node)),
});
const li = (...content: AdfNode[]): AdfNode => ({ type: 'listItem', content });
const ul = (...items: AdfNode[]): AdfNode => ({ type: 'bulletList', content: items });
const ol = (...items: AdfNode[]): AdfNode => ({ type: 'orderedList', content: items });
const olFrom = (order: unknown, ...items: AdfNode[]): AdfNode => ({
    type: 'orderedList',
    attrs: { order },
    content: items,
});
const quote = (...content: AdfNode[]): AdfNode => ({ type: 'blockquote', content });
const codeBlock = (body: string, language?: string): AdfNode => ({
    type: 'codeBlock',
    ...(language === undefined ? {} : { attrs: { language } }),
    content: body === '' ? [] : [text(body)],
});
const rule: AdfNode = { type: 'rule' };
const th = (...content: AdfNode[]): AdfNode => ({ type: 'tableHeader', content });
const td = (...content: AdfNode[]): AdfNode => ({ type: 'tableCell', content });
const row = (...cells: AdfNode[]): AdfNode => ({ type: 'tableRow', content: cells });
const table = (...rows: AdfNode[]): AdfNode => ({
    type: 'table',
    attrs: { isNumberColumnEnabled: false, layout: 'default' },
    content: rows,
});
const taskList = (...content: AdfNode[]): AdfNode => ({
    type: 'taskList',
    attrs: { localId: 'list' },
    content,
});
const task = (state: 'TODO' | 'DONE', ...content: AdfNode[]): AdfNode => ({
    type: 'taskItem',
    attrs: { localId: 'item', state },
    content,
});
const card = (url: string): AdfNode => ({ type: 'inlineCard', attrs: { url } });
const doc = (...content: AdfNode[]): AdfDocument => ({ type: 'doc', version: 1, content });
const render = (...content: AdfNode[]): string => adfToMarkdown(doc(...content));
/** Renders input that does not match the ADF types, as untrusted JSON may not. */
const renderUntyped = (value: unknown): string => adfToMarkdown(value as AdfDocument);

/**
 * Renders a document as `markdown`, which textToAdf reads back as `expected`:
 * the document itself unless markdown cannot hold it exactly.
 */
function expectRoundTrip(adf: AdfDocument, markdown: string, expected: AdfDocument = adf): void {
    expect(adfToMarkdown(adf)).toBe(markdown);
    expect(textToAdf(markdown)).toStrictEqual(expected);
}

/** Converts markdown, renders it and converts it again: the documents must be equal. */
function expectStable(input: string): void {
    const adf = textToAdf(input);
    expect(textToAdf(adfToMarkdown(adf)), JSON.stringify(input)).toStrictEqual(adf);
}

describe('adfToMarkdown', () => {
    describe('input', () => {
        it('returns an empty string for null or undefined', () => {
            expect(adfToMarkdown(null)).toBe('');
            expect(adfToMarkdown(undefined)).toBe('');
        });

        it('returns a string unchanged', () => {
            expect(adfToMarkdown('# plain text, not escaped')).toBe('# plain text, not escaped');
        });

        it('renders an empty document, and one without content, as an empty string', () => {
            expect(render()).toBe('');
            expect(renderUntyped({ type: 'doc', version: 1 })).toBe('');
            expect(renderUntyped({ type: 'doc', version: 1, content: 'oops' })).toBe('');
        });

        it('doubles a byte-order mark at the start, since the mapper drops one there', () => {
            expect(render(p(`${BYTE_ORDER_MARK}## Title`))).toBe(
                `${BYTE_ORDER_MARK}${BYTE_ORDER_MARK}## Title`,
            );
            expect(render(p(`a${BYTE_ORDER_MARK}`))).toBe(`a${BYTE_ORDER_MARK}`);
        });
    });

    describe('canonical form', () => {
        it('renders a fence, a blockquote and a rule as the markdown they come from', () => {
            expect(
                render(
                    codeBlock('const x = 1;', 'typescript'),
                    quote(p('a quote')),
                    rule,
                    p('Follow up paragraph'),
                ),
            ).toBe('```typescript\nconst x = 1;\n```\n\n> a quote\n\n---\n\nFollow up paragraph');
        });

        it('renders a document in canonical form', () => {
            const canonical = [
                '# Release notes',
                '',
                '## Changes',
                '',
                '- Backend',
                '  - fixed auth refresh',
                '  - added tests',
                '- Frontend',
                '',
                '3. third',
                '4. fourth',
                '   - nested',
                '',
                '```ts',
                'const retries = 3;',
                '```',
                '',
                '> First quoted paragraph.',
                '>',
                '> Second quoted paragraph.',
                '',
                '---',
                '',
                '| Suite | Result |',
                '| --- | --- |',
                '| unit | **pass** |',
                '| e2e | `skipped` |',
                '',
                'Text with **bold**, *em*, ~~strike~~, `code` and a [link](https://example.com).',
                '',
                'Summary',
                'of the fix',
                '---',
                '',
                '## C \\#',
                '',
                '1\\. not a list',
                '',
                '- a',
                '',
                '* b',
                '',
                '1. c',
                '',
                '1) d',
            ].join('\n');
            expect(
                render(
                    heading(1, 'Release notes'),
                    heading(2, 'Changes'),
                    ul(
                        li(p('Backend'), ul(li(p('fixed auth refresh')), li(p('added tests')))),
                        li(p('Frontend')),
                    ),
                    olFrom(3, li(p('third')), li(p('fourth'), ul(li(p('nested'))))),
                    codeBlock('const retries = 3;', 'ts'),
                    quote(p('First quoted paragraph.'), p('Second quoted paragraph.')),
                    rule,
                    table(
                        row(th(p('Suite')), th(p('Result'))),
                        row(td(p('unit')), td(p(text('pass', strong)))),
                        row(td(p('e2e')), td(p(text('skipped', code)))),
                    ),
                    p(
                        'Text with ',
                        text('bold', strong),
                        ', ',
                        text('em', em),
                        ', ',
                        text('strike', strike),
                        ', ',
                        text('code', code),
                        ' and a ',
                        text('link', link('https://example.com')),
                        '.',
                    ),
                    heading(2, 'Summary', br, 'of the fix'),
                    heading(2, 'C #'),
                    p('1. not a list'),
                    ul(li(p('a'))),
                    ul(li(p('b'))),
                    ol(li(p('c'))),
                    ol(li(p('d'))),
                ),
            ).toBe(canonical);
        });
    });

    describe('blocks', () => {
        it('renders an expand title as a paragraph before its body', () => {
            const expand = (type: string, title: unknown, ...content: AdfNode[]): AdfNode => ({
                type,
                attrs: { title },
                content,
            });
            expect(render(expand('expand', 'Full log', p('line one'), codeBlock('x')))).toBe(
                'Full log\n\nline one\n\n```\nx\n```',
            );
            expect(render(table(row(td(expand('nestedExpand', 'Why', p('because'))))))).toBe(
                '| Why because |\n| --- |',
            );
            expect(render(expand('expand', '# not a heading', p('body')))).toBe(
                '\\# not a heading\n\nbody',
            );
            expect(render(expand('expand', undefined, p('body only')))).toBe('body only');
            expect(render(expand('expand', '   ', p('body only')))).toBe('body only');
        });

        it('joins blocks by a blank line and skips blocks that render empty', () => {
            expect(
                render(
                    p('one'),
                    p(),
                    {
                        type: 'mediaSingle',
                        attrs: { layout: 'center' },
                        content: [{ type: 'media', attrs: { id: 'x', type: 'file' } }],
                    },
                    p('two'),
                ),
            ).toBe('one\n\ntwo');
        });

        it('keeps the whitespace of paragraph text', () => {
            expect(render(p('  indented'), p('Done.  '))).toBe('  indented\n\nDone.  ');
            expect(render(p('a\t', br, 'b'))).toBe('a\t\nb');
        });

        it('drops hard breaks at either end of a paragraph', () => {
            expect(render(p(br, 'a', br))).toBe('a');
        });

        it('renders headings with marks, without content and at clamped levels', () => {
            expect(render(heading(2, text('Bold', strong), ' title'))).toBe('## **Bold** title');
            expect(render(heading(2), heading(1, br))).toBe('##\n\n#');
            expect(render(heading(7, 'x'), heading(0, 'y'))).toBe('###### x\n\n# y');
            expect(renderUntyped(doc({ type: 'heading', content: [text('z')] }))).toBe('# z');
        });

        it('drops the hard breaks at either end of a heading', () => {
            expect(render(heading(2, br, 'x', br))).toBe('## x');
            expect(render(heading(4, br, 'x', br, 'y', br))).toBe('#### x y');
        });

        it('escapes a closing-sequence look-alike at the end of an ATX heading', () => {
            expect(
                render(
                    heading(2, 'C #'),
                    heading(2, 'a ##'),
                    heading(2, 'a\t#'),
                    heading(2, '###'),
                    heading(2, '#'),
                    heading(2, 'C#'),
                    heading(2, 'a #b'),
                ),
            ).toBe(
                [
                    '## C \\#',
                    '## a \\##',
                    '## a\t\\#',
                    '## \\###',
                    '## \\#',
                    '## C#',
                    '## a #b',
                ].join('\n\n'),
            );
        });

        it('writes a level-1 heading with a hard break in setext form', () => {
            expect(render(heading(1, 'Release', br, 'notes'))).toBe('Release\nnotes\n===');
        });

        it('escapes every line of a setext heading as one that can open a block', () => {
            expect(render(heading(2, 'x', br, '- y'))).toBe('x\n\\- y\n---');
            expect(render(heading(1, 'Title', br, '2024. It affects'))).toBe(
                'Title\n2024\\. It affects\n===',
            );
        });

        it('escapes a setext line of only pipes, colons and dashes, where the heading would end', () => {
            expectRoundTrip(doc(heading(2, 'a', br, '|')), 'a\n\\|\n---');
            expectRoundTrip(doc(heading(2, 'Options', br, '---|---')), 'Options\n\\---|---\n---');
            expectRoundTrip(doc(heading(1, 'a', br, '| |')), 'a\n\\| |\n===');
            expectRoundTrip(doc(heading(2, '|', br, 'a')), '\\|\na\n---');
            expectStable('a\n\\|\n---');
        });

        it('writes in ATX form a heading with a line that starts with three backticks', () => {
            // marked ends a setext heading there, and a code span cannot be escaped.
            expectRoundTrip(
                doc(heading(2, 'a', br, text('b``c', code))),
                '## a ```b``c```',
                doc(heading(2, 'a ', text('b``c', code))),
            );
            expectRoundTrip(
                doc(heading(1, text('``x', code), br, 'b')),
                '# ``` ``x ``` b',
                doc(heading(1, text('``x', code), ' b')),
            );
        });

        it('writes a carriage return in a code block as a line feed, which gets the prefix', () => {
            // marked ends a line at a lone carriage return too.
            const lines = (body: string): AdfNode => ({
                type: 'codeBlock',
                attrs: {},
                content: [text(body)],
            });
            expectRoundTrip(
                doc(quote(codeBlock(`a${CR}b`))),
                '> ```\n> a\n> b\n> ```',
                doc(quote(lines('a\nb'))),
            );
            expectRoundTrip(
                doc(ul(li(codeBlock(`a${CR}- b${CR}\nc`)))),
                '- ```\n  a\n  - b\n  c\n  ```',
                doc(ul(li(lines('a\n- b\nc')))),
            );
        });

        it('renders code blocks with fences sized to their body', () => {
            expect(render(codeBlock('plain'))).toBe('```\nplain\n```');
            expect(render(codeBlock(''), codeBlock('', 'ts'))).toBe('```\n```\n\n```ts\n```');
            expect(render(codeBlock('## Example\n```js\nx()\n```', 'markdown'))).toBe(
                '````markdown\n## Example\n```js\nx()\n```\n````',
            );
            expect(render(codeBlock('x\n', 'ts'))).toBe('```ts\nx\n\n```');
        });

        it('uses a tilde fence for a language that holds a backtick', () => {
            expect(render(codeBlock('x', 'a`b'))).toBe('~~~a`b\nx\n~~~');
        });

        it('trims a language of whitespace but not of U+2028, which the mapper keeps', () => {
            expect(render(codeBlock('x', ` ts${NBSP}`))).toBe('```ts\nx\n```');
            expect(render(codeBlock('x', `a${LINE_SEPARATOR}`))).toBe(
                `\`\`\`a${LINE_SEPARATOR}\nx\n\`\`\``,
            );
        });

        it('renders blockquotes with a bare > on blank lines', () => {
            expect(render(quote(p('a'), p('b')))).toBe('> a\n>\n> b');
            expect(render(quote(p('Reviewer said:'), ul(li(p('rename the flag')))))).toBe(
                '> Reviewer said:\n>\n> - rename the flag',
            );
            expect(render(quote(p('Run:'), codeBlock('npm ci', 'bash')))).toBe(
                '> Run:\n>\n> ```bash\n> npm ci\n> ```',
            );
        });

        it('renders a blockquote without text as a bare >', () => {
            expect(render(quote(p()), quote())).toBe('>\n\n>');
        });

        it('renders block cards and embed cards as their URL', () => {
            expect(
                render(
                    { type: 'blockCard', attrs: { url: 'https://example.com/a' } },
                    {
                        type: 'embedCard',
                        attrs: { url: 'https://example.com/b', layout: 'center' },
                    },
                    { type: 'blockCard', attrs: { data: { url: 'https://example.com/c' } } },
                ),
            ).toBe('https://example.com/a\n\nhttps://example.com/b\n\nhttps://example.com/c');
        });
    });

    describe('lists', () => {
        it('indents later lines by the width of the marker', () => {
            expect(render(olFrom(9, li(p('a', br, 'b')), li(p('c'), ul(li(p('d'))))))).toBe(
                '9. a\n   b\n10. c\n    - d',
            );
        });

        it('separates the paragraphs of an item by a blank line', () => {
            expect(render(ul(li(p('a'), p('b')), li(p('c'))))).toBe('- a\n\n  b\n- c');
        });

        it('renders an empty item as the bare marker', () => {
            expect(render(ul(li(p('a')), li(p()), li(p('c'))), ol(li()))).toBe('- a\n-\n- c\n\n1.');
        });

        it('keeps a fenced code block inside its item', () => {
            expect(render(ol(li(p('Install:'), codeBlock('npm ci', 'bash')), li(p('Test:'))))).toBe(
                '1. Install:\n   ```bash\n   npm ci\n   ```\n2. Test:',
            );
        });

        it('separates a nested list that cannot interrupt a paragraph by a blank line', () => {
            expect(render(ul(li(p('a'), olFrom(3, li(p('b'))))))).toBe('- a\n\n  3. b');
            expect(render(ul(li(p('a'), ul(li()))))).toBe('- a\n\n  -');
        });

        it('puts the marker on a line of its own when the item text starts with a space', () => {
            expect(render(ul(li(p(' a'), ul(li(p('b'))))))).toBe('-\n   a\n  - b');
        });

        it('puts the marker on a line of its own where its line would be a thematic break', () => {
            // `- - -`, the markers of empty nested items, would read back as a rule.
            expect(render(ul(li(ul(li(ul(li(p())))))))).toBe('-\n  - -');
            expect(render(ul(li(ul(li(p())))))).toBe('- -');
        });

        it('switches markers for adjacent lists of the same type, alternating', () => {
            expect(render(ul(li(p('a'))), ul(li(p('b'))), ul(li(p('c'))))).toBe(
                '- a\n\n* b\n\n- c',
            );
            expect(render(ol(li(p('a'))), olFrom(2, li(p('b'))), ol(li(p('c'))))).toBe(
                '1. a\n\n2) b\n\n1. c',
            );
            expect(render(ul(li(p('a'))), taskList(task('TODO', text('b'))))).toBe(
                '- a\n\n* [ ] b',
            );
        });

        it('keeps the default markers for lists that are not adjacent or not the same type', () => {
            expect(render(ul(li(p('a'))), p('x'), ul(li(p('b'))))).toBe('- a\n\nx\n\n- b');
            expect(render(ul(li(p('a'))), ol(li(p('b'))))).toBe('- a\n\n1. b');
        });

        it('switches markers for a list adjacent to one inside an unknown container', () => {
            expect(render(ul(li(p('a'))), { type: 'panel', content: [ul(li(p('b')))] })).toBe(
                '- a\n\n* b',
            );
        });

        it('starts at 1 when attrs.order is not a whole number of at least 0', () => {
            expect(
                render(
                    olFrom(0, li(p('zero'))),
                    p('-'),
                    olFrom(-1, li(p('a'))),
                    p('-'),
                    olFrom(2.5, li(p('b'))),
                    p('-'),
                    olFrom('3', li(p('c'))),
                ),
            ).toBe('0. zero\n\n\\-\n\n1. a\n\n\\-\n\n1. b\n\n\\-\n\n1. c');
        });

        it('renders done and open task items, empty ones and block task items', () => {
            expect(
                render(
                    taskList(task('DONE', text('done')), task('TODO'), {
                        type: 'blockTaskItem',
                        attrs: { localId: 'b', state: 'DONE' },
                        content: [p('block task')],
                    }),
                ),
            ).toBe('- [x] done\n- [ ]\n- [x] block task');
        });

        it('renders any other node in a task list as an item, keeping its text', () => {
            expect(
                renderUntyped(
                    doc(
                        taskList(
                            task('DONE', text('done')),
                            { type: 'blockCard', attrs: { url: 'https://example.com/card' } },
                            text('stray text'),
                        ),
                    ),
                ),
            ).toBe('- [x] done\n- [ ] https://example.com/card\n- [ ] stray text');
        });

        it('escapes the later lines of a task item, not the text after its box', () => {
            expect(render(taskList(task('TODO', text('# a'), br, text('2. b'))))).toBe(
                '- [ ] # a\n  2\\. b',
            );
        });

        it('escapes a task box that starts the text of a task item', () => {
            // Unescaped, marked strips two boxes from the later item and none from the one before.
            expectRoundTrip(
                doc(taskList(task('TODO', text('a')), task('TODO', text('[x] b')))),
                '- [ ] a\n- [ ] \\[x] b',
                doc(ul(li(p(`${BALLOT_BOX} a`)), li(p(`${BALLOT_BOX} [x] b`)))),
            );
        });
    });

    describe('tables', () => {
        it('pads rows to the widest row', () => {
            expect(render(table(row(th(p('A')), th(p('B'))), row(td(p('1')))))).toBe(
                '| A | B |\n| --- | --- |\n| 1 |  |',
            );
            expect(render(table(row(th(p('A'))), row(td(p('1')), td(p('2')))))).toBe(
                '| A |  |\n| --- | --- |\n| 1 | 2 |',
            );
        });

        it('renders a header row on its own', () => {
            expect(render(table(row(th(p('Only'))), row()))).toBe('| Only |\n| --- |\n|  |');
            expect(render(table(row(th(p('Only')))))).toBe('| Only |\n| --- |');
        });

        it('trims cells of whitespace but not of U+2028, which the mapper keeps', () => {
            expect(render(table(row(th(p(` a${NBSP}`)), th(p(`b${LINE_SEPARATOR}`)))))).toBe(
                `| a | b${LINE_SEPARATOR} |\n| --- | --- |`,
            );
        });

        it('renders cell content inline, hard breaks as spaces and pipes escaped', () => {
            expect(
                render(
                    table(
                        row(th(p('Job')), th(p('Status'))),
                        row(
                            td(p(text('lint', code))),
                            td(p(text('pass', strong), br, text('a|b', code))),
                        ),
                        row(td(ul(li(p('x')), li(p('y')))), td(codeBlock('a\nb'))),
                    ),
                ),
            ).toBe(
                [
                    '| Job | Status |',
                    '| --- | --- |',
                    '| `lint` | **pass** `a\\|b` |',
                    '| x y | `a b` |',
                ].join('\n'),
            );
        });

        it('skips a table without cells', () => {
            expect(render(p('a'), table(), table(row()), p('b'))).toBe('a\n\nb');
        });

        it('escapes a | after a backslash, so the row keeps its cells', () => {
            // marked, like GFM, ends a cell at a `|` after an even run of backslashes.
            expectRoundTrip(
                doc(table(row(th(p('h')), th(p('i'))), row(td(p('a\\|b')), td(p('c'))))),
                '| h | i |\n| --- | --- |\n| a\\\\\\|b | c |',
            );
            expectRoundTrip(doc(table(row(th(p('a\\|b'))))), '| a\\\\\\|b |\n| --- |');
            expectRoundTrip(
                doc(table(row(th(p(text('x', link('https://x.test/a\\|b'))))))),
                '| [x](https://x.test/a\\\\\\|b) |\n| --- |',
            );
            expectRoundTrip(
                doc(table(row(th(p(text('a\\\\|b', code)))))),
                '| `a\\\\\\|b` |\n| --- |',
            );
            expectStable('| h | i |\n| - | - |\n| a\\\\\\|b | c |');
            expectStable('| a\\\\\\|b |\n| - |\n| c |');
        });

        it('keeps the cells of a code span with a backslash before a |, losing that backslash', () => {
            // GFM unescapes `\|` before it reads a code span, so the span cannot hold `\|`.
            const command = (value: string): AdfNode =>
                td(p(text(`grep 'ERROR${value}WARN' app.log`, code)));
            expectRoundTrip(
                doc(
                    table(
                        row(th(p('Command')), th(p('Note'))),
                        row(command('\\|'), td(p('matches both'))),
                    ),
                ),
                [
                    '| Command | Note |',
                    '| --- | --- |',
                    "| `grep 'ERROR\\|WARN' app.log` | matches both |",
                ].join('\n'),
                doc(
                    table(
                        row(th(p('Command')), th(p('Note'))),
                        row(command('|'), td(p('matches both'))),
                    ),
                ),
            );
        });
    });

    describe('marks', () => {
        it('renders every mark kind', () => {
            expect(
                render(
                    p(
                        text('bold', strong),
                        ' ',
                        text('em', em),
                        ' ',
                        text('gone', strike),
                        ' ',
                        text('code', code),
                        ' ',
                        text('link', link('https://example.com')),
                        ' ',
                        text('docs', link('https://example.com', 'Docs')),
                    ),
                ),
            ).toBe(
                '**bold** *em* ~~gone~~ `code` [link](https://example.com) [docs](https://example.com "Docs")',
            );
        });

        it('nests marks, keeping open the marks that continue', () => {
            expect(render(p('This is ', text('critical', em, strong), '.'))).toBe(
                'This is ***critical***.',
            );
            expect(
                render(
                    p(
                        text('See ', strong),
                        text('the runbook', strong, link('https://example.com/runbook')),
                    ),
                ),
            ).toBe('**See [the runbook](https://example.com/runbook)**');
            expect(render(p(text('a ', em), text('b', em, strong), text(' c', em)))).toBe(
                '*a **b** c*',
            );
        });

        it('opens first the mark that runs longest, whatever the order of the marks', () => {
            expect(render(p(text('a', strong, em), text('b', em)))).toBe('***a**b*');
            expect(render(p(text('a', em, strong), text('b', strong)))).toBe('***a*b**');
        });

        it('opens a link inside the emphasis that ends with it', () => {
            expect(render(p(text('x', link('https://x.test'), strong)))).toBe(
                '**[x](https://x.test)**',
            );
            expect(render(p(text('https://x.test', link('https://x.test'), em, strong)))).toBe(
                '***<https://x.test>***',
            );
        });

        it('keeps strong, em and strike open around a code span', () => {
            expect(
                render(
                    p(
                        'Note: ',
                        text('run ', strong),
                        text('bun run test', code),
                        text(' before pushing', strong),
                        '.',
                    ),
                ),
            ).toBe('Note: **run `bun run test` before pushing**.');
            expect(render(p(text('af jira comment', code), ' sends the text as-is.'))).toBe(
                '`af jira comment` sends the text as-is.',
            );
            expect(
                render(p('See ', text('adf.ts', code, link('https://example.com/adf.ts')), '.')),
            ).toBe('See [`adf.ts`](https://example.com/adf.ts).');
        });

        it('keeps emphasis open over a code span where it ends or starts with whitespace', () => {
            expect(render(p(text('Install with ', strong), text('npm ci', code)))).toBe(
                '**Install with `npm ci`**',
            );
            expect(render(p(text('code', code), text(' first', strong)))).toBe('**`code` first**');
            expect(render(p(text('old ', strike), text('api', code), ' new'))).toBe(
                '~~old `api`~~ new',
            );
            expect(render(p(text('run ', em), text('x', code), br, text('next', em)))).toBe(
                '*run `x`*\n*next*',
            );
            // Between a backtick and a letter, a delimiter could neither close nor open.
            expect(render(p(text('run ', strong), text('x', code), 's'))).toBe('**run** `x`s');
            expect(render(p('a', text('x', code), text(' b', strong)))).toBe('a`x` **b**');
        });

        it('sizes code span fences to their content and pads them where needed', () => {
            expect(
                render(
                    p(text('a`b', code)),
                    p(text('`x`', code)),
                    p(text(' a ', code)),
                    p(text(' ', code)),
                    p(text('``` x', code)),
                ),
            ).toBe(['``a`b``', '`` `x` ``', '`  a  `', '` `', '```` ``` x ````'].join('\n\n'));
        });

        it('merges adjacent text with equal marks, so code spans never touch', () => {
            expect(render(p(text('a', code), text('b', code)))).toBe('`ab`');
        });

        it('wraps link destinations in <...> where markdown needs it', () => {
            expect(
                render(
                    p(text('x', link('https://example.com/a b'))),
                    p(text('y', link('https://example.com/a(b'))),
                    p(text('z', link('https://en.wikipedia.org/wiki/Foo_(bar)'))),
                    p(text('w', link('<x>'))),
                    p(text('v', link('https://example.com/a\\'))),
                ),
            ).toBe(
                [
                    '[x](<https://example.com/a b>)',
                    '[y](<https://example.com/a(b>)',
                    '[z](https://en.wikipedia.org/wiki/Foo_(bar))',
                    '[w](<\\<x\\>>)',
                    '[v](https://example.com/a\\\\)',
                ].join('\n\n'),
            );
        });

        it('escapes quotes and backslashes in a link title', () => {
            expect(render(p(text('w', link('https://example.com', 'Say "hi" \\'))))).toBe(
                '[w](https://example.com "Say \\"hi\\" \\\\")',
            );
        });

        it('writes a link whose text is its URL as an autolink', () => {
            expect(
                render(
                    p(
                        'Build log: ',
                        text(
                            'https://ci.example.com/job/42',
                            link('https://ci.example.com/job/42'),
                        ),
                        ' and ',
                        text('https://example.com/*x*', strong, link('https://example.com/*x*')),
                    ),
                    p(text('www.example.com', link('http://www.example.com'))),
                    p(text('a@b.co', link('mailto:a@b.co'))),
                ),
            ).toBe(
                [
                    'Build log: <https://ci.example.com/job/42> and **<https://example.com/*x*>**',
                    '[www.example.com](http://www.example.com)',
                    '[a@b.co](mailto:a@b.co)',
                ].join('\n\n'),
            );
        });

        it('keeps the [text](url) form for a URL in a setext line of its own', () => {
            expect(
                render(heading(2, 'Logs', br, text('https://x.test/1', link('https://x.test/1')))),
            ).toBe('Logs\n[https://x.test/1](https://x.test/1)\n---');
        });

        it('moves whitespace at the edge of an emphasis run outside its delimiters', () => {
            expect(render(p(text('bold ', strong), 'text'))).toBe('**bold** text');
            expect(render(p('a', text(' em ', em), 'b'))).toBe('a *em* b');
            expect(render(p(text(' ', strong), 'x'))).toBe(' x');
        });

        it('treats U+2028 at the edge of an emphasis run as text', () => {
            expect(render(p(text(`${LINE_SEPARATOR}a`, strong)))).toBe(`**${LINE_SEPARATOR}a**`);
        });

        it('closes marks at a hard break, which carries none', () => {
            expect(
                render(
                    p(text('This warning wraps', strong), br, text('onto the next line', strong)),
                ),
            ).toBe('**This warning wraps**\n**onto the next line**');
        });

        it('drops marks that markdown cannot write, and duplicate marks', () => {
            expect(
                render(
                    p(
                        text('under', { type: 'underline' }),
                        ' ',
                        text('red', { type: 'textColor', attrs: { color: '#ff0000' } }),
                        ' ',
                        text('twice', strong, strong),
                        ' ',
                        text('nowhere', { type: 'link', attrs: {} }),
                    ),
                ),
            ).toBe('under red **twice** nowhere');
        });

        it('puts emphasis inside the link text where a letter touches it outside', () => {
            // `a**[b](u)**c` reads back with literal `**`: a delimiter between a letter
            // and `[` or `)` can neither open nor close.
            expectRoundTrip(doc(p('a', text('b', link('u'), strong), 'c')), 'a[**b**](u)c');
            expectRoundTrip(
                doc(p('请看', text('文档', link('https://example.com'), strong), '了解详情。')),
                '请看[**文档**](https://example.com)了解详情。',
            );
            expectRoundTrip(
                doc(
                    p(
                        '请访问',
                        text('https://example.com/docs', link('https://example.com/docs'), strong),
                        '获取文档。',
                    ),
                ),
                '请访问[**https://example.com/docs**](https://example.com/docs)获取文档。',
            );
            expectRoundTrip(
                doc(p('詳細は', text('こちら', link('https://example.com'), em), 'を参照')),
                '詳細は[*こちら*](https://example.com)を参照',
            );
            expectRoundTrip(doc(p('a', text('b', link('u'), strike), 'c')), 'a[~~b~~](u)c');
            // With room outside, the link still opens inside the emphasis.
            expect(render(p('a ', text('b', link('u'), strong), ' c'))).toBe('a **[b](u)** c');
        });

        it('writes the em at both ends of a strong stretch with _, or else the strong with __', () => {
            // `***a* *b***` reads back as one em+strong span holding `* *`.
            expectRoundTrip(
                doc(p(text('a', em, strong), text(' ', strong), text('b', em, strong))),
                '**_a_ _b_**',
            );
            expectRoundTrip(
                doc(
                    p(
                        text('Warning:', em, strong),
                        text(' do not deploy on ', strong),
                        text('Fridays', em, strong),
                    ),
                ),
                '**_Warning:_ do not deploy on _Fridays_**',
            );
            // `_` cannot close between two letters.
            expectRoundTrip(
                doc(p(text('a', em, strong), text('b ', strong), text('c', em, strong))),
                '__*a*b *c*__',
            );
        });

        it('keeps a * in the text of emphasis from pairing with its delimiters', () => {
            expectRoundTrip(doc(p(text('a *b', em))), '*a \\*b*');
            expectRoundTrip(doc(p(text('Matches *.ts files', em))), '*Matches \\*.ts files*');
            expectRoundTrip(
                doc(p(text('Note: pass **kwargs', strong))),
                '**Note: pass \\*\\*kwargs**',
            );
            expectRoundTrip(doc(p('x', text('a *b', em), 'y')), 'x*a \\*b*y');
            expectRoundTrip(doc(p('2*3 ', text('a *b', em))), '2*3 *a \\*b*');
            // Bold italic too, in either mark order, with a letter or CJK text outside:
            // `_` inside the `*` run kept that run from opening or closing there.
            expectRoundTrip(doc(p('x', text('a * b', em, strong))), 'x***a \\* b***');
            expectRoundTrip(
                doc(p('x', text('a * b', strong, em))),
                'x***a \\* b***',
                doc(p('x', text('a * b', em, strong))),
            );
            expectRoundTrip(
                doc(p(text('注意*：*文档', em, strong), '了解')),
                '***注意\\*：\\*文档***了解',
            );
            // After punctuation a `*` run cannot close before `~`, and a `_` run can.
            expectRoundTrip(doc(p(text('a*?', strong), '~')), '__a\\*?__~');
            expectStable('__Note: 2*3=6.__~~old~~');
            expectStable('_Matches *.ts files._~/repo');
            // As does a `*` right outside, which would join the delimiter run.
            expectRoundTrip(doc(p(text('a', em), '*3')), '*a*\\*3');
            expectRoundTrip(doc(p('3**', text('a', strong))), '3\\*\\***a**');
        });

        it('gives a backslash to a literal *, _ or ~ or a backslash next to a delimiter', () => {
            expectRoundTrip(doc(p('x~', text('b', strike))), 'x\\~~~b~~');
            expectRoundTrip(doc(p(text('a~', strike), ' b')), '~~a\\~~~ b');
            // Before a run of another character that a `[` follows, a `*` or `_` keeps
            // it from opening.
            expectRoundTrip(doc(p('a**', text('b', link('u'), strong))), 'a\\*\\***[b](u)**');
            expectRoundTrip(doc(p('x_', text('b', link('u'), strike))), 'x\\_~~[b](u)~~');
            expectRoundTrip(doc(p('a\\', text('b', strong))), 'a\\\\**b**');
            expectRoundTrip(doc(p(text('a\\', strong), ' b')), '**a\\\\** b');
        });

        it('leaves the * or _ after an e-mail address or a URL before a delimiter alone', () => {
            // GFM autolinks no address that ends in `_`; a backslash before it would end the
            // address there and make it a link, and a URL would take the backslash in.
            for (const input of [
                '**a@b.test_**',
                'a@b.c_*a*',
                '*a@b.c_*',
                'mail me at me@example.com_**now**',
            ]) {
                expectStable(input);
            }
            expect(render(p(text('www.e.test_', strong)))).toBe('**www.e.test_**');
            // In link text, or where no address or URL ends, the backslash stays.
            expectStable('[see https://x.test/a\\_*(b)*](https://x.test/)');
            expectStable('x@y._*~~http://x~~');
        });

        it('pairs no backslash at the end of an autolink, whose text is literal', () => {
            const url = 'https://e.test/x\\';
            expectRoundTrip(doc(p(text(url, link(url)))), `<${url}>`);
            expectStable('Docs: https://e.test/x\\.');
            // In a table cell only an odd run of backslashes before a `|` needs `[url](url)`,
            // whose link text then escapes its brackets and parentheses.
            expectStable('http://x[](\\\\\\|)\n|-');
            const href = 'http://x[](\\|)';
            const cell = doc(table(row(th(p(text(href, link(href)))))));
            expect(textToAdf(adfToMarkdown(cell))).toStrictEqual(cell);
        });

        it('escapes link text taken from its URL where it would read as markup', () => {
            expectRoundTrip(
                doc(p(text('www.a]', link('http://www.a]')))),
                '[www.a\\]](http://www.a])',
            );
            expectRoundTrip(
                doc(
                    p(
                        'See ',
                        text(
                            'www.github.com/x/__init__.py',
                            link('http://www.github.com/x/__init__.py'),
                        ),
                        ' now',
                    ),
                ),
                'See [www.github.com/x/\\_\\_init\\_\\_.py](http://www.github.com/x/__init__.py) now',
            );
            expectRoundTrip(
                doc(p(text('https://e.com/`x`', link('https://e.com/`x`', 't')))),
                '[https://e.com/\\`x\\`](https://e.com/`x` "t")',
            );
            expectStable('See [www.example.com] for details.');
        });

        it('writes a line ending in a link title as a space and percent-encodes one in a URL', () => {
            expectRoundTrip(
                doc(p(text('t', link('https://x.test/', `a${CR}# b`)))),
                '[t](https://x.test/ "a # b")',
                doc(p(text('t', link('https://x.test/', 'a # b')))),
            );
            expectRoundTrip(
                doc(p(text('t', link(`https://x.test/a${CR}\nb`)))),
                '[t](https://x.test/a%0D%0Ab)',
                doc(p(text('t', link('https://x.test/a%0D%0Ab')))),
            );
        });

        it('writes an empty link destination before a title as <>', () => {
            expectRoundTrip(doc(p(text('x', link('', 't')))), '[x](<> "t")');
        });

        it('escapes a ! right before a link, which would make it an image', () => {
            expectRoundTrip(
                doc(p('Done!', text('release notes', link('https://e.com/notes')))),
                'Done\\![release notes](https://e.com/notes)',
            );
        });
    });

    describe('inline nodes', () => {
        it('renders mentions, emoji, dates and inline cards with and without attrs.text', () => {
            expect(
                render(
                    p(
                        { type: 'mention', attrs: { id: 'u1', text: 'Jane' } },
                        ' ',
                        { type: 'mention', attrs: { id: 'u2', text: '' } },
                        ' ',
                        { type: 'emoji', attrs: { shortName: ':smile:', text: '😄' } },
                        ' ',
                        { type: 'emoji', attrs: { shortName: ':tada:' } },
                        ' ',
                        { type: 'date', attrs: { timestamp: '1705276800000' } },
                        ' ',
                        { type: 'date', attrs: { timestamp: '1705363199000' } },
                        ' ',
                        { type: 'inlineCard', attrs: { data: { url: 'https://example.com/d' } } },
                    ),
                ),
            ).toBe('@Jane @u2 😄 :tada: 2024-01-15 2024-01-15 https://example.com/d');
        });

        it('renders other inline nodes as their attrs.text', () => {
            expect(
                render(
                    p(
                        { type: 'placeholder', attrs: { text: 'Type here' } },
                        ' ',
                        { type: 'futureInline', attrs: { text: 'kept' } },
                        { type: 'mediaInline', attrs: { id: 'm' } },
                    ),
                ),
            ).toBe('Type here kept');
        });

        it('renders a date it cannot read as its timestamp text', () => {
            expect(render(p({ type: 'date', attrs: { timestamp: 'soon' } }))).toBe('soon');
        });

        it('writes an inline card as <url> where the text after it would join the URL', () => {
            // GFM autolinking runs a bare URL on up to whitespace or `<`.
            const url = 'https://acme.atlassian.net/browse/PROJ-1';
            expectRoundTrip(
                doc(p('Fixed in ', card(url), "'s follow-up")),
                `Fixed in <${url}>'s follow-up`,
                doc(p('Fixed in ', text(url, link(url)), "'s follow-up")),
            );
            expectRoundTrip(
                doc(p(card('https://x.test/a'), card('https://x.test/b'), 'を修正')),
                '<https://x.test/a><https://x.test/b>を修正',
                doc(
                    p(
                        text('https://x.test/a', link('https://x.test/a')),
                        text('https://x.test/b', link('https://x.test/b')),
                        'を修正',
                    ),
                ),
            );
            expectRoundTrip(
                doc(p('a\\', card(url), 'b')),
                `a\\\\<${url}>b`,
                doc(p('a\\', text(url, link(url)), 'b')),
            );
            // Before whitespace, or punctuation that GFM gives back, it stays bare.
            expect(render(p(card(url), '. Next'), p('(', card(url), ')'))).toBe(
                `${url}. Next\n\n(${url})`,
            );
        });

        it('writes an inline card as <url> where GFM would cut its URL short', () => {
            // GFM gives back a URL's trailing punctuation and stops at an unbalanced `(`.
            for (const url of [
                'https://e.com/search?q=v2.',
                'https://e.com/wiki/Foo_(bar',
                'https://e.com/a_',
            ]) {
                expectRoundTrip(
                    doc(p('See ', card(url), ' for details')),
                    `See <${url}> for details`,
                    doc(p('See ', text(url, link(url)), ' for details')),
                );
            }
            expect(render(p('See ', card('https://e.com/wiki/Foo_(bar)'), ' now'))).toBe(
                'See https://e.com/wiki/Foo_(bar) now',
            );
        });
    });

    describe('line-start escaping', () => {
        it('escapes a paragraph that is exactly a block marker', () => {
            expect(render(p('-'), p('>x'), p('#'), p('1.'))).toBe('\\-\n\n\\>x\n\n\\#\n\n1\\.');
        });

        it('leaves a first line of mixed delimiter characters, often emphasis, alone', () => {
            // Neither a thematic break nor a setext underline; a backslash would break the emphasis.
            expect(render(p(text('-', em)), p(text('=', strong)), p('-*-'))).toBe(
                '*-*\n\n**=**\n\n-*-',
            );
            expect(render(p('--'), p('== '), p('_ _ _'))).toBe('\\--\n\n\\== \n\n\\_ _ _');
        });

        it('escapes every block marker on a first line', () => {
            expect(
                render(
                    p('+ x'),
                    p('* x'),
                    p('###### x'),
                    p('```js'),
                    p('~~~'),
                    p('***'),
                    p('==='),
                    p('- - -'),
                    p('1) x'),
                    p('2024. It affects'),
                ),
            ).toBe(
                [
                    '\\+ x',
                    '\\* x',
                    '\\###### x',
                    '\\```js',
                    '\\~~~',
                    '\\***',
                    '\\===',
                    '\\- - -',
                    '1\\) x',
                    '2024\\. It affects',
                ].join('\n\n'),
            );
        });

        it('leaves first lines alone that open no block', () => {
            expect(
                render(p('#hashtag'), p(`#${NBSP}x`), p('####### seven'), p('1234567890. x')),
            ).toBe(`#hashtag\n\n#${NBSP}x\n\n####### seven\n\n1234567890. x`);
        });

        it('escapes a later line only where it would interrupt the paragraph', () => {
            expect(
                render(
                    p('The regression was introduced in the release of', br, '2024. It affects'),
                    p('a', br, '1. b', br, '- c', br, '-', br, '*', br, '+'),
                    p('a', br, '# b', br, '#b', br, '> c', br, '```', br, '===', br, '***'),
                ),
            ).toBe(
                [
                    'The regression was introduced in the release of\n2024. It affects',
                    'a\n1\\. b\n\\- c\n\\-\n*\n+',
                    'a\n\\# b\n#b\n\\> c\n\\```\n\\===\n\\***',
                ].join('\n\n'),
            );
        });

        it('writes an empty line between hard breaks as a line of only a backslash', () => {
            // A blank line would end the paragraph; `\` is a hard break of its own.
            expectRoundTrip(doc(p('a', br, br, '2. b')), 'a\n\\\n2. b');
            expectRoundTrip(doc(p('a', br, br, br, 'b')), 'a\n\\\n\\\nb');
            expectRoundTrip(
                doc(ul(li(p('Run the build:', br, 'npm run build', br, br, 'npm test')))),
                '- Run the build:\n  npm run build\n  \\\n  npm test',
            );
            expectRoundTrip(doc(quote(p('a', br, br, '# b'))), '> a\n> \\\n> \\# b');
            expectRoundTrip(doc(heading(1, 'a', br, br, 'b')), 'a\n\\\nb\n===');
            // At either end they are dropped, so a backslash never ends a paragraph.
            expect(render(p(br, br, 'a', br, br))).toBe('a');
            expectStable('- a\n      b\n\n      c');
            expectStable('<details\n\n>');
        });

        it('pairs a backslash that ends a line, which would make a hard break of its own', () => {
            expectRoundTrip(
                doc(p('Logs are in C:\\temp\\', br, br, 'Next step')),
                'Logs are in C:\\temp\\\\\n\\\nNext step',
            );
            expectRoundTrip(doc(p('a\\', br, 'b')), 'a\\\\\nb');
            expectStable('- a\n      b\\\n\n      c');
            // Not at the end of a bare URL, whose backslashes GFM autolinking keeps.
            const url = 'https://ci.example.com/job/42/console\\';
            expectRoundTrip(
                doc(p('Build log: ', card(url), br, 'Next')),
                `Build log: ${url}\nNext`,
                doc(p('Build log: ', text(url, link(url)), br, 'Next')),
            );
        });

        it('escapes every line in a list item, where any line can open a block', () => {
            expect(render(ul(li(p('a', br, '2024. It affects', br, '*', br, `#${NBSP}x`))))).toBe(
                `- a\n  2024\\. It affects\n  \\*\n  \\#${NBSP}x`,
            );
        });

        it('escapes paragraphs in blockquotes', () => {
            expect(render(quote(p('> x', br, '- y')))).toBe('> \\> x\n> \\- y');
        });

        it('never escapes a code span that starts a line', () => {
            expect(render(p(text('# x', code)), p('a', br, text('- b', code)))).toBe(
                '`# x`\n\na\n`- b`',
            );
        });

        it('leaves running text unescaped', () => {
            const running = '*not emphasis* and snake_case, 2 * 3, [x], <tag>, &amp; ~ |';
            expect(render(p(running))).toBe(running);
        });

        it('escapes a line that would read as a link reference definition', () => {
            expect(render(p('[a]: https://x.test'), p('a', br, br, '[b]: c'))).toBe(
                '\\[a]: https://x.test\n\na\n\\\n[b]: c',
            );
            // A definition cannot interrupt a paragraph, and the mapper keeps footnotes as text.
            expect(render(p('see', br, '[a]: b'), p('[^1]: Source.'), p('[x] y'))).toBe(
                'see\n[a]: b\n\n[^1]: Source.\n\n[x] y',
            );
        });

        it('escapes a [ that nothing closes on its line', () => {
            // marked's definition label runs on over line endings and blank lines.
            expectRoundTrip(
                doc(p('[TODO: verify the numbers'), p('Owner: Jane'), p('Status]: open')),
                '\\[TODO: verify the numbers\n\nOwner: Jane\n\nStatus]: open',
            );
            expectRoundTrip(doc(p('[a', br, 'b]: c')), '\\[a\nb]: c');
            expectRoundTrip(doc(ul(li(p('[a', br, 'b]: c')))), '- \\[a\n  b]: c');
            expectRoundTrip(doc(quote(p('[a', br, 'b]: c'))), '> \\[a\n> b]: c');
            expectRoundTrip(doc(heading(2, '[a', br, 'b]: c')), '\\[a\nb]: c\n---');
            expect(render(p('[x] y'), p('[^1 open'))).toBe('[x] y\n\n[^1 open');
        });

        it('escapes a later line shaped like a table delimiter row', () => {
            // Under a line of text it would make that line a table header.
            expectRoundTrip(doc(p('a|b', br, '-|-')), 'a|b\n\\-|-');
            expectRoundTrip(
                doc(p('Summary:', br, '| Job | Status |', br, '|-----|--------|')),
                'Summary:\n| Job | Status |\n\\|-----|--------|',
            );
            expectRoundTrip(doc(p('a', br, ':-:')), 'a\n\\:-:');
            expectRoundTrip(
                doc(ul(li(p('Results:', br, '| Job |', br, '|---|')))),
                '- Results:\n  | Job |\n  \\|---|',
            );
            expectRoundTrip(doc(ul(li(p('a', br, '||', br, '-|')))), '- a\n  ||\n  \\-|');
            expectRoundTrip(doc(heading(2, 'a', br, ':-:')), 'a\n\\:-:\n---');
            expectStable(
                'Summary:\n    | Job | Status |\n    |-----|--------|\n    | lint | pass |',
            );
        });

        // textToAdf keeps a table in a list item or quote as a paragraph of its source, whose
        // cells hold markdown as text. Escaping its delimiter row made that markdown live.
        it('writes a table kept as text in a list item or quote verbatim', () => {
            const rows = ['| Job | Status |', '| --- | --- |', '| `lint` | **pass** |'];
            const source = p(...rows.flatMap((row, k) => (k === 0 ? [row] : [br, row])));
            expectRoundTrip(
                doc(ol(li(p('CI results:'), source))),
                '1. CI results:\n\n   ' + rows.join('\n   '),
            );
            expectRoundTrip(doc(quote(source)), '> ' + rows.join('\n> '));
            expectRoundTrip(doc(ul(li(p('||', br, '-|', br, '=')))), '- ||\n  -|\n  =');
            for (const input of [
                '1. CI results:\n   | Job | Status |\n   |-----|--------|\n   | `lint` | **pass** |',
                '> | Name | Path |\n> |---|---|\n> | root | C:\\\\ |',
                '- | a |\n  |---|\n  | x \\| y |',
                '- a\n|-\n   -',
            ]) {
                expectStable(input);
            }
            // Indented up to three spaces past the item's or quote's content, as marked
            // allows before a table.
            for (const input of [
                '>  | a |\n>  |-|\n>  | *b* |',
                '1. Results:\n\n    | Job | Status |\n    | --- | --- |\n    | `lint` | **pass** |',
                '- a\n\n   | b |\n   |-|\n   | *c* |',
            ]) {
                expectStable(input);
            }
            // Not where the header and the delimiter row disagree, as marked reads no table.
            expect(render(quote(p('| a | b |', br, '|---|')))).toBe('> | a | b |\n> \\|---|');
            // Nor where a card's URL would lose its link, nor right after a task box.
            const url = 'https://acme.atlassian.net/browse/PROJ-1';
            expectRoundTrip(
                doc(quote(p('| Ticket |', br, '|---|', br, '| ', card(url), ' |'))),
                `> | Ticket |\n> \\|---|\n> | ${url} |`,
                doc(quote(p('| Ticket |', br, '|---|', br, '| ', text(url, link(url)), ' |'))),
            );
            const boxed = { type: 'blockTaskItem', attrs: { localId: 'b', state: 'TODO' } };
            expectRoundTrip(
                doc(taskList({ ...boxed, content: [p('Step | Owner', br, '---|---')] })),
                '- [ ] Step | Owner\n  \\---|---',
                doc(ul(li(p('\u2610 Step | Owner', br, '---|---')))),
            );
        });

        it('escapes a task box that starts a line in a list item', () => {
            expect(render(ul(li(p('[ ] x')), li(p('[x] y')), li(p('a', br, '[X] z'))))).toBe(
                '- \\[ ] x\n- \\[x] y\n- a\n  \\[X] z',
            );
            expect(render(p('[ ] x'))).toBe('[ ] x');
        });
    });

    // A plain paragraph whose first line opens an HTML block reads back as that
    // block, with literal lines; any other line that would open one is escaped.
    describe('HTML blocks', () => {
        it('writes a plain paragraph that opens an HTML block verbatim', () => {
            expect(
                render(
                    p('<ISSUE-KEY>', br, '- one', br, '# two'),
                    p('<details>', br, '<summary>Log</summary>', br, '**not bold**'),
                ),
            ).toBe('<ISSUE-KEY>\n- one\n# two\n\n<details>\n<summary>Log</summary>\n**not bold**');
        });

        it('escapes the < of a paragraph with marks that opens an HTML block', () => {
            expect(render(p('<div> ', text('x', strong)))).toBe('\\<div> **x**');
        });

        it('escapes the < when the HTML block would end before the paragraph does', () => {
            expect(render(p('<!-- a -->', br, '- x'), p('<div>', br, br, '# x'))).toBe(
                '\\<!-- a -->\n\\- x\n\n\\<div>\n\\\n\\# x',
            );
        });

        it('separates the block after an HTML paragraph in a list item by a blank line', () => {
            expect(render(ul(li(p('<ISSUE-KEY>'), ul(li(p('nested'))))))).toBe(
                '- <ISSUE-KEY>\n\n  - nested',
            );
            expect(render(ul(li(p('<div>'), codeBlock('x'))))).toBe('- <div>\n\n  ```\n  x\n  ```');
        });

        it('writes an unterminated HTML block verbatim only as the last block of its container', () => {
            expect(render(quote(p('<script>'), p('lazy')))).toBe('> \\<script>\n>\n> lazy');
            expect(render(quote(p('lazy'), p('<script>')))).toBe('> lazy\n>\n> <script>');
            expect(render(p('<!-- open'), p('next'))).toBe('\\<!-- open\n\nnext');
            expect(render(p('next'), p('<!-- open', br, '- x'))).toBe('next\n\n<!-- open\n- x');
        });

        it('escapes a later line that would open an HTML block and end the paragraph', () => {
            expect(
                render(p('a', br, '<div>', br, '<preview>', br, '<DIV>', br, '<!-- c -->')),
            ).toBe('a\n\\<div>\n\\<preview>\n\\<DIV>\n\\<!-- c -->');
            // Only a list item lexes every line on its own, so only there does this one end it.
            expect(render(p('a', br, '<ISSUE-KEY>'), ul(li(p('a', br, '<ISSUE-KEY>'))))).toBe(
                'a\n<ISSUE-KEY>\n\n- a\n  \\<ISSUE-KEY>',
            );
        });

        it('escapes a setext heading line that is only <...>', () => {
            expect(render(heading(2, 'Fix', br, '<1>'), heading(2, 'Fix', br, '<ISSUE-KEY>'))).toBe(
                'Fix\n\\<1>\n---\n\nFix\n\\<ISSUE-KEY>\n---',
            );
            expect(
                render(
                    heading(
                        1,
                        'Logs',
                        br,
                        text('https://x.test/1', link('https://x.test/1')),
                        br,
                        '<b c>',
                    ),
                ),
            ).toBe('Logs\n[https://x.test/1](https://x.test/1)\n\\<b c>\n===');
        });
    });

    describe('robustness', () => {
        it('never throws on missing or malformed content, attrs and marks', () => {
            expect(
                renderUntyped({
                    type: 'doc',
                    version: 1,
                    content: [
                        null,
                        'stray string',
                        42,
                        { type: 'paragraph', content: 'not an array' },
                        {
                            type: 'paragraph',
                            content: [null, { type: 'text', text: 7 }, { type: 'text' }],
                        },
                        {
                            type: 'paragraph',
                            content: [{ type: 'text', text: 'kept', marks: 'bad' }],
                        },
                        { type: 'heading', attrs: 'bad', content: [{ type: 'text', text: 'h' }] },
                        { type: 'bulletList', content: [{ type: 'listItem' }, p('item')] },
                        { type: 'orderedList', attrs: null, content: [li(p('one'))] },
                        { type: 'table', content: [{ type: 'tableRow', content: 'bad' }] },
                        { type: 'codeBlock', attrs: { language: 7 }, content: [{ text: 'body' }] },
                        { type: 'blockquote', content: {} },
                        { type: 'taskList', content: [{ type: 'taskItem', attrs: 7 }] },
                        { content: [{ type: 'text', text: 'untyped' }] },
                        { type: 'mention' },
                        { type: 'date', attrs: { timestamp: 9e99 } },
                        { type: 'inlineCard', attrs: { data: 'bad' } },
                    ],
                }),
            ).toBe(
                [
                    'kept',
                    '# h',
                    '-\n- item',
                    '1. one',
                    '```\nbody\n```',
                    '>',
                    '- [ ]',
                    'untyped',
                ].join('\n\n'),
            );
        });

        it('renders the text of a document nested deeper than the call stack', () => {
            let node: AdfNode = p('deep text');
            for (let i = 0; i < 50_000; i++) node = quote(node);
            expect(render(node)).toBe('deep text');
        });

        it('does not loop on a document that contains itself', () => {
            const paragraph = { type: 'paragraph', content: [text('cycle')] as unknown[] };
            paragraph.content.push(paragraph);
            expect(renderUntyped(doc(paragraph as AdfNode))).toBe('cycle');
        });
    });
});
