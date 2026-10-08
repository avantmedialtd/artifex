import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { adfProblems, summarizeAdf, validateAdf } from '../../test/helpers/adf.ts';
import { textToAdf, adfToText } from './adf.ts';
import type { AdfDocument, AdfMark, AdfNode } from './adf-types.ts';

// Vitest cannot interrupt a synchronous loop in its own process, so inputs that
// used to make textToAdf loop forever are converted in a child process that is
// killed after this deadline. A reintroduced hang then fails instead of
// freezing the suite.
const CHILD_DEADLINE_MS = 5_000;
const fixture = fileURLToPath(new URL('../../test/fixtures/text-to-adf.ts', import.meta.url));

function convertInChild(input: string): AdfDocument {
    const result = spawnSync('bun', [fixture], {
        input: JSON.stringify(input),
        encoding: 'utf8',
        timeout: CHILD_DEADLINE_MS,
        killSignal: 'SIGKILL',
    });
    if (result.error) {
        if ((result.error as { code?: string }).code === 'ETIMEDOUT') {
            throw new Error(
                `textToAdf did not finish within ${CHILD_DEADLINE_MS} ms for ${JSON.stringify(input)}`,
            );
        }
        throw new Error(result.error.message);
    }
    if (result.status !== 0) {
        throw new Error(result.stderr || `fixture exited with ${result.status ?? result.signal}`);
    }
    return JSON.parse(result.stdout) as AdfDocument;
}

// Every textToAdf result must be well-formed: valid against the vendored ADF JSON
// schema, with none of the problems adfProblems lists (an empty or CR-bearing
// text node, a duplicate mark type, a hardBreak with marks and, given the input,
// a leaked sentinel). test/helpers/adf.ts holds the one definition of both.
function expectWellFormed(doc: AdfDocument, input?: string): void {
    expect(validateAdf(doc), 'ADF schema errors').toBeNull();
    expect(adfProblems(doc, input), 'output guarantees').toEqual([]);
}

/** textToAdf, with the result checked by expectWellFormed. */
function convert(input: string): AdfDocument {
    const result = textToAdf(input);
    expectWellFormed(result, input);
    return result;
}

/** The outline of a conversion, in the notation of the converter corpus. */
const outline = (input: string): string => summarizeAdf(convert(input));

/** Converts markdown, renders it and converts it again: the documents must be equal. */
function expectStable(input: string): AdfDocument {
    const adf = convert(input);
    expect(convert(adfToText(adf)), JSON.stringify(input)).toStrictEqual(adf);
    return adf;
}

// Every node of a document, depth first.
function allNodes(node: AdfNode | AdfDocument): AdfNode[] {
    const found: AdfNode[] = [];
    const visit = (current: AdfNode): void => {
        found.push(current);
        current.content?.forEach(visit);
    };
    (node as AdfNode).content?.forEach(visit);
    return found;
}

const textNodes = (node: AdfNode | AdfDocument): AdfNode[] =>
    allNodes(node).filter(child => child.type === 'text');

// Builders for the expected and hand-built documents below.
const strong: AdfMark = { type: 'strong' };
const em: AdfMark = { type: 'em' };
const strike: AdfMark = { type: 'strike' };
const code: AdfMark = { type: 'code' };
const link = (href: string, title?: string): AdfMark => ({
    type: 'link',
    attrs: title === undefined ? { href } : { href, title },
});
const txt = (text: string, ...marks: AdfMark[]): AdfNode =>
    marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text };
const br: AdfNode = { type: 'hardBreak' };
const para = (...content: AdfNode[]): AdfNode => ({ type: 'paragraph', content });
const heading = (level: number, ...content: AdfNode[]): AdfNode => ({
    type: 'heading',
    attrs: { level },
    content,
});
const listItem = (...content: AdfNode[]): AdfNode => ({ type: 'listItem', content });
const item = (...content: AdfNode[]): AdfNode => listItem(para(...content));
const bullets = (...items: AdfNode[]): AdfNode => ({ type: 'bulletList', content: items });
const ordered = (...items: AdfNode[]): AdfNode => ({ type: 'orderedList', content: items });
const orderedFrom = (order: number, ...items: AdfNode[]): AdfNode => ({
    type: 'orderedList',
    attrs: { order },
    content: items,
});
const quote = (...paragraphs: AdfNode[]): AdfNode => ({ type: 'blockquote', content: paragraphs });
const codeBlock = (text: string, language?: string): AdfNode => ({
    type: 'codeBlock',
    attrs: language ? { language } : {},
    content: text ? [txt(text)] : [],
});
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
const doc = (...content: AdfNode[]): AdfDocument => ({ type: 'doc', version: 1, content });

interface ConversionCase {
    name: string;
    input: string;
    expected: AdfDocument;
}

// Inputs that made textToAdf loop forever, plus the CRLF and byte-order-mark
// inputs. They run in a child process (see convertInChild).
const CHILD_PROCESS_CASES: ConversionCase[] = [
    { name: 'a marker followed by one space', input: '## ', expected: doc(heading(2)) },
    { name: 'a marker followed by a tab', input: '#\t', expected: doc(heading(1)) },
    { name: 'a marker, a space and a CR', input: '## \r', expected: doc(heading(2)) },
    { name: 'heading text followed by a CR', input: '## x\r', expected: doc(heading(2, txt('x'))) },
    {
        name: 'a CRLF heading and list',
        input: '## Summary\r\n\r\n- one\r\n- two\r\n',
        expected: doc(heading(2, txt('Summary')), bullets(item(txt('one')), item(txt('two')))),
    },
    {
        name: 'CRLF line endings',
        input: '## Summary\r\n\r\nFirst line\r\nsecond line\r\n\r\n- one\r\n- two\r\n',
        expected: doc(
            heading(2, txt('Summary')),
            para(txt('First line'), br, txt('second line')),
            bullets(item(txt('one')), item(txt('two'))),
        ),
    },
    {
        name: 'CRLF text without a heading',
        input: 'para one\r\nline two\r\n\r\n- a\r\n- b\r\n',
        expected: doc(
            para(txt('para one'), br, txt('line two')),
            bullets(item(txt('a')), item(txt('b'))),
        ),
    },
    {
        name: 'a lone CR line ending',
        input: '## Summary\rBody',
        expected: doc(heading(2, txt('Summary')), para(txt('Body'))),
    },
    {
        name: 'a marker-only heading between paragraphs',
        input: 'intro\n## \noutro',
        expected: doc(para(txt('intro')), heading(2), para(txt('outro'))),
    },
    {
        name: 'U+2028 inside heading text',
        input: '## a\u2028b',
        expected: doc(heading(2, txt('a\u2028b'))),
    },
    {
        name: 'U+2028 after heading text',
        input: '## Title\u2028',
        expected: doc(heading(2, txt('Title\u2028'))),
    },
    {
        name: 'U+2029 inside heading text',
        input: '## a\u2029b',
        expected: doc(heading(2, txt('a\u2029b'))),
    },
    {
        name: 'U+2029 after heading text',
        input: '## Title\u2029',
        expected: doc(heading(2, txt('Title\u2029'))),
    },
    {
        name: 'a leading byte-order mark',
        input: '\uFEFF## Title\nbody',
        expected: doc(heading(2, txt('Title')), para(txt('body'))),
    },
];

// The other scenarios of the robust-input requirement. None of these inputs
// looped on the old converter, so they run in process.
const IN_PROCESS_CASES: ConversionCase[] = [
    {
        name: 'CRLF inside a fenced code block',
        input: '```ts\r\nconst a = 1;\r\nconst b = 2;\r\n```\r\n',
        expected: doc({
            type: 'codeBlock',
            attrs: { language: 'ts' },
            content: [txt('const a = 1;\nconst b = 2;')],
        }),
    },
    { name: 'a lone # as an empty heading', input: '#', expected: doc(heading(1)) },
    { name: 'a marker and spaces as an empty heading', input: '###   ', expected: doc(heading(3)) },
    { name: 'six # as an empty heading', input: '######', expected: doc(heading(6)) },
    {
        name: 'heading text without surrounding spaces and tabs',
        input: '##   Title \t',
        expected: doc(heading(2, txt('Title'))),
    },
    {
        name: 'a heading line that ends a paragraph',
        input: 'intro\n#',
        expected: doc(para(txt('intro')), heading(1)),
    },
    { name: '#hashtag as paragraph text', input: '#hashtag', expected: doc(para(txt('#hashtag'))) },
    { name: '#123 as paragraph text', input: '#123', expected: doc(para(txt('#123'))) },
    { name: 'seven # as paragraph text', input: '#######', expected: doc(para(txt('#######'))) },
    {
        // Only a space or a tab opens a heading, not a non-breaking space.
        name: 'a non-breaking space after # as paragraph text',
        input: '#\u00A0Title',
        expected: doc(para(txt('#\u00A0Title'))),
    },
    {
        name: 'a bare > line between quoted paragraphs',
        input: '> a\n>\n> b',
        expected: doc(quote(para(txt('a')), para(txt('b')))),
    },
    {
        name: 'a bare "> " line between quoted paragraphs',
        input: '> a\n> \n> b',
        expected: doc(quote(para(txt('a')), para(txt('b')))),
    },
    {
        name: 'repeated bare quote lines',
        input: '> a\n>\n>\n> b',
        expected: doc(quote(para(txt('a')), para(txt('b')))),
    },
    {
        name: 'bare quote lines around a paragraph',
        input: '>\n> a\n>',
        expected: doc(quote(para(txt('a')))),
    },
    { name: 'a quote of a lone >', input: '>', expected: doc(quote(para())) },
    { name: 'a quote of a lone "> "', input: '> ', expected: doc(quote(para())) },
    { name: 'a quote of only bare lines', input: '>\n>', expected: doc(quote(para())) },
    {
        name: 'quoted lines with text as one paragraph',
        input: '> line 1\n> line 2',
        expected: doc(quote(para(txt('line 1'), br, txt('line 2')))),
    },
    { name: 'an empty - item', input: '- ', expected: doc(bullets(item())) },
    { name: 'an empty * item', input: '* ', expected: doc(bullets(item())) },
    { name: 'an empty 1. item', input: '1. ', expected: doc(ordered(item())) },
    {
        name: 'an empty item between items',
        input: '- a\n- \n- b',
        expected: doc(bullets(item(txt('a')), item(), item(txt('b')))),
    },
    {
        name: 'a second leading byte-order mark as text',
        input: '\uFEFF\uFEFF## Title',
        expected: doc(para(txt('\uFEFF## Title'))),
    },
    {
        name: 'a byte-order mark inside text',
        input: 'a\uFEFFb',
        expected: doc(para(txt('a\uFEFFb'))),
    },
    { name: 'an empty document', input: '', expected: doc() },
    { name: 'a document holding only a byte-order mark', input: '\uFEFF', expected: doc() },
];

describe('adf utilities', () => {
    describe('textToAdf', () => {
        it('should convert a plain paragraph', () => {
            const result = convert('Hello world');
            expect(result.type).toBe('doc');
            expect(result.version).toBe(1);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('paragraph');
            expect(result.content[0].content?.[0].text).toBe('Hello world');
        });

        it('should convert headings', () => {
            const result = convert('## My Heading');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('heading');
            expect(result.content[0].attrs?.level).toBe(2);
            expect(result.content[0].content?.[0].text).toBe('My Heading');
        });

        it('should convert unordered lists', () => {
            const result = convert('- Item 1\n- Item 2\n- Item 3');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('bulletList');
            expect(result.content[0].content).toHaveLength(3);
        });

        it('should convert ordered lists', () => {
            const result = convert('1. First\n2. Second');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('orderedList');
            expect(result.content[0].content).toHaveLength(2);
        });

        it('should handle multiple paragraphs', () => {
            const result = convert('Paragraph one\n\nParagraph two');
            expect(result.content).toHaveLength(2);
            expect(result.content[0].type).toBe('paragraph');
            expect(result.content[1].type).toBe('paragraph');
        });

        it('should handle empty string', () => {
            const result = convert('');
            expect(result.content).toHaveLength(0);
        });

        it('should convert a fenced code block with language', () => {
            const result = convert('```typescript\nconst x = 1;\n```');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('codeBlock');
            expect(result.content[0].attrs?.language).toBe('typescript');
            expect(result.content[0].content?.[0].text).toBe('const x = 1;');
        });

        it('should convert a fenced code block without language', () => {
            const result = convert('```\nplain code\n```');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('codeBlock');
            expect(result.content[0].attrs?.language).toBeUndefined();
            expect(result.content[0].content?.[0].text).toBe('plain code');
        });

        it('should preserve list/heading-like lines verbatim inside a fence', () => {
            const input = '```\n- not a list\n# not a heading\n1. not ordered\n```';
            const result = convert(input);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('codeBlock');
            expect(result.content[0].content?.[0].text).toBe(
                '- not a list\n# not a heading\n1. not ordered',
            );
        });

        it('should consume to end of input on an unterminated fence', () => {
            const result = convert('```\nline one\nline two');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('codeBlock');
            expect(result.content[0].content?.[0].text).toBe('line one\nline two');
        });

        it('should produce empty content for an empty fence body', () => {
            const result = convert('```\n```');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('codeBlock');
            expect(result.content[0].content).toEqual([]);
        });

        it('should convert a single-line blockquote', () => {
            const result = convert('> quoted text');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('blockquote');
            expect(result.content[0].content?.[0].type).toBe('paragraph');
            expect(result.content[0].content?.[0].content?.[0].text).toBe('quoted text');
        });

        it('should collapse consecutive > lines into one blockquote with hardBreaks', () => {
            const result = convert('> line 1\n> line 2');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('blockquote');
            const paragraph = result.content[0].content?.[0];
            expect(paragraph?.type).toBe('paragraph');
            expect(paragraph?.content?.[0].text).toBe('line 1');
            expect(paragraph?.content?.[1].type).toBe('hardBreak');
            expect(paragraph?.content?.[2].text).toBe('line 2');
        });

        it('should convert a horizontal rule', () => {
            const result = convert('---');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('rule');
        });

        it('should also convert *** as a horizontal rule', () => {
            const result = convert('***');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('rule');
        });

        it('should convert bold text', () => {
            expect(convert('This is **bold** text').content).toEqual([
                para(txt('This is '), txt('bold', strong), txt(' text')),
            ]);
        });

        it('should convert italic text', () => {
            expect(convert('This is *italic* text').content).toEqual([
                para(txt('This is '), txt('italic', em), txt(' text')),
            ]);
        });

        it('should convert code text', () => {
            expect(convert('Use `code` here').content).toEqual([
                para(txt('Use '), txt('code', code), txt(' here')),
            ]);
        });

        it('should convert links', () => {
            expect(convert('Visit [Google](https://google.com)').content).toEqual([
                para(txt('Visit '), txt('Google', link('https://google.com'))),
            ]);
        });

        it('should convert plain text without markdown', () => {
            expect(convert('Just plain text').content).toEqual([para(txt('Just plain text'))]);
        });

        // A numeric reference to U+000D keeps its source text (design D8): no text node holds a CR.
        describe('carriage-return references', () => {
            it('should keep a decimal reference in a paragraph as text', () => {
                expect(convert('a&#13;b').content).toEqual([para(txt('a&#13;b'))]);
            });

            it('should keep a hex reference in a paragraph as text', () => {
                expect(convert('a&#xD;b').content).toEqual([para(txt('a&#xD;b'))]);
            });

            it('should keep a reference at the end of a heading as text', () => {
                expect(convert('## Title&#13;').content).toEqual([heading(2, txt('Title&#13;'))]);
            });

            it('should keep a reference in link text as text', () => {
                expect(convert('[a&#13;b](https://example.com)').content).toEqual([
                    para(txt('a&#13;b', link('https://example.com'))),
                ]);
            });

            it('should keep references of any case and with leading zeros as text', () => {
                expect(convert('&#X0d; &#000013; &#x0000D;').content).toEqual([
                    para(txt('&#X0d; &#000013; &#x0000D;')),
                ]);
            });
        });
    });

    // One test per textToAdf scenario of the Shared ADF conversion requirement in
    // openspec/specs/atlassian-shared-config/spec.md.
    // "Output is valid ADF" runs over the corpus in adf.corpus.test.ts.
    describe('textToAdf spec scenarios', () => {
        it('Markdown to ADF conversion', () => {
            const result = convert(
                '# Title\n\nSome **bold**, *italic*, `code` and [a link](https://example.com).\n\n' +
                    '- one\n- two\n\n1. first\n2. second',
            );
            expect(result.content.map(node => node.type)).toEqual([
                'heading',
                'paragraph',
                'bulletList',
                'orderedList',
            ]);
            expect(result.content[1]).toEqual(
                para(
                    txt('Some '),
                    txt('bold', strong),
                    txt(', '),
                    txt('italic', em),
                    txt(', '),
                    txt('code', code),
                    txt(' and '),
                    txt('a link', link('https://example.com')),
                    txt('.'),
                ),
            );
        });

        it('Fenced code block with language', () => {
            expect(convert('```typescript\nconst x = 1;\n\nconst y = 2;\n```').content).toEqual([
                codeBlock('const x = 1;\n\nconst y = 2;', 'typescript'),
            ]);
        });

        it('Fenced code block without language', () => {
            const [block] = convert('```\nplain code\n```').content;
            expect(block.type).toBe('codeBlock');
            expect(block.attrs ?? {}).not.toHaveProperty('language');
            expect(block.content).toEqual([txt('plain code')]);
        });

        it('Code block contents are not parsed as other block types', () => {
            const body = '- not a list\n* not a list\n1. not ordered\n# not a heading';
            const result = convert('```\n' + body + '\n```');
            expect(result.content).toEqual([codeBlock(body)]);
            const types = allNodes(result).map(node => node.type);
            expect(types).not.toContain('bulletList');
            expect(types).not.toContain('orderedList');
            expect(types).not.toContain('heading');
        });

        it('Unterminated fence consumes to end of input', () => {
            expect(convert('```\nline one\nline two').content).toEqual([
                codeBlock('line one\nline two'),
            ]);
        });

        it('Fence directly after a paragraph line', () => {
            const result = convert('Here is the fix:\n```ts\nconst retries = 3;\n```');
            expect(result.content).toEqual([
                para(txt('Here is the fix:')),
                codeBlock('const retries = 3;', 'ts'),
            ]);
            for (const node of textNodes(result)) expect(node.text).not.toContain('`');
        });

        it('Fence variants and info strings', () => {
            expect(convert('~~~\ntilde fence\n~~~').content).toEqual([codeBlock('tilde fence')]);
            expect(convert('````markdown\n```js\nx()\n```\n````').content).toEqual([
                codeBlock('```js\nx()\n```', 'markdown'),
            ]);
            expect(convert('1. Install:\n   ```bash\n   npm ci\n   ```').content).toEqual([
                ordered(listItem(para(txt('Install:')), codeBlock('npm ci', 'bash'))),
            ]);
            expect(convert('```c++\nint main();\n```').content).toEqual([
                codeBlock('int main();', 'c++'),
            ]);
            expect(convert('```objective-c\n@end\n```').content).toEqual([
                codeBlock('@end', 'objective-c'),
            ]);
            expect(convert('```ts title="retry.ts"\nexport {};\n```').content).toEqual([
                codeBlock('export {};', 'ts'),
            ]);
        });

        it('Blockquote conversion', () => {
            expect(convert('> line 1\n> line 2').content).toEqual([
                quote(para(txt('line 1'), br, txt('line 2'))),
            ]);
            expect(convert('> Reviewer said:\n> - rename the flag').content).toEqual([
                quote(para(txt('Reviewer said:')), bullets(item(txt('rename the flag')))),
            ]);
            expect(convert('> Steps:\n> 1. build').content).toEqual([
                quote(para(txt('Steps:')), ordered(item(txt('build')))),
            ]);
            expect(convert('> Reviewer said:\n> ```\n> npm test\n> ```').content).toEqual([
                quote(para(txt('Reviewer said:')), codeBlock('npm test')),
            ]);
        });

        it('Nested blockquotes are flattened', () => {
            const result = convert('> outer\n>> inner');
            expect(result.content).toEqual([quote(para(txt('outer')), para(txt('inner')))]);
            for (const node of allNodes(result).filter(child => child.type === 'blockquote')) {
                expect(node.content?.map(child => child.type)).not.toContain('blockquote');
            }
        });

        it('Horizontal rule conversion', () => {
            for (const line of ['---', '***', '___', '- - -', '* * *', '_ _ _', '-----']) {
                expect(outline(line), line).toBe('hr');
                expect(outline(`Text.\n\n${line}\n\nMore.`), line).toBe(
                    'p["Text."] | hr | p["More."]',
                );
            }
            expect(outline('Section one.\n***\nSection two.')).toBe(
                'p["Section one."] | hr | p["Section two."]',
            );
            expect(outline('Section one.\n___\nSection two.')).toBe(
                'p["Section one."] | hr | p["Section two."]',
            );
        });

        it('Setext headings', () => {
            const result = convert('Summary\n---\nEverything passed.');
            expect(result.content).toEqual([
                heading(2, txt('Summary')),
                para(txt('Everything passed.')),
            ]);
            expect(allNodes(result).map(node => node.type)).not.toContain('rule');
            expect(convert('Release notes\n===').content).toEqual([
                heading(1, txt('Release notes')),
            ]);
            expect(convert('Summary of the fix\nand its rollout\n---').content).toEqual([
                heading(2, txt('Summary of the fix'), br, txt('and its rollout')),
            ]);
        });

        it('Heading syntax variants', () => {
            expect(convert('## Summary ##\n\n   ### Indented\n\n#123 is fixed').content).toEqual([
                heading(2, txt('Summary')),
                heading(3, txt('Indented')),
                para(txt('#123 is fixed')),
            ]);
        });

        it('Nested lists', () => {
            expect(convert('- Backend\n  - fixed auth refresh\n- Frontend').content).toEqual([
                bullets(
                    listItem(para(txt('Backend')), bullets(item(txt('fixed auth refresh')))),
                    item(txt('Frontend')),
                ),
            ]);
            expect(convert('1. Setup\n    - install deps').content).toEqual([
                ordered(listItem(para(txt('Setup')), bullets(item(txt('install deps'))))),
            ]);
        });

        it('Ordered list start number', () => {
            expect(convert('3. third\n4. fourth').content).toEqual([
                orderedFrom(3, item(txt('third')), item(txt('fourth'))),
            ]);
            expect(convert('1. first\n2. second').content[0]).not.toHaveProperty('attrs');
            expect(convert('1. Install:\n\n```bash\nnpm ci\n```\n\n2. Test:').content).toEqual([
                ordered(item(txt('Install:'))),
                codeBlock('npm ci', 'bash'),
                orderedFrom(2, item(txt('Test:'))),
            ]);
        });

        it('GFM table', () => {
            expect(
                convert('CI summary:\n| Job | Status |\n|:----|:------:|\n| `lint` | **pass** |')
                    .content,
            ).toEqual([
                para(txt('CI summary:')),
                table(
                    row(th(para(txt('Job'))), th(para(txt('Status')))),
                    row(td(para(txt('lint', code))), td(para(txt('pass', strong)))),
                ),
            ]);
            expect(convert('| a | b |\n|---|---|\n|  | x \\| y |').content).toEqual([
                table(
                    row(th(para(txt('a'))), th(para(txt('b')))),
                    row(td(para()), td(para(txt('x | y')))),
                ),
            ]);
        });

        it('Strike-through text', () => {
            const result = convert('The fix is ~~a retry~~ a lock.');
            expect(result.content).toEqual([
                para(txt('The fix is '), txt('a retry', strike), txt(' a lock.')),
            ]);
            for (const node of textNodes(result)) expect(node.text).not.toContain('~~');
        });

        it('Inline marks nest', () => {
            const critical = textNodes(convert('This is ***critical***.')).find(
                node => node.text === 'critical',
            );
            expect(critical?.marks?.map(mark => mark.type).sort()).toEqual(['em', 'strong']);
            expect(convert('**See [the runbook](https://example.com/runbook)**').content).toEqual([
                para(
                    txt('See ', strong),
                    txt('the runbook', link('https://example.com/runbook'), strong),
                ),
            ]);
        });

        it('The code mark combines only with link', () => {
            const inputs = [
                '**`af jira comment`** sends',
                'Note: **run `bun run test` before pushing**.',
                'See [`adf.ts`](https://example.com/adf.ts).',
            ];
            const [first, second, third] = inputs.map(input => convert(input).content);
            expect(first).toEqual([para(txt('af jira comment', code), txt(' sends'))]);
            expect(second).toEqual([
                para(
                    txt('Note: '),
                    txt('run ', strong),
                    txt('bun run test', code),
                    txt(' before pushing', strong),
                    txt('.'),
                ),
            ]);
            expect(third).toEqual([
                para(
                    txt('See '),
                    txt('adf.ts', link('https://example.com/adf.ts'), code),
                    txt('.'),
                ),
            ]);
            for (const input of [...inputs, '[**`x`**](https://example.com)', '~~*`y`*~~']) {
                for (const node of textNodes(convert(input))) {
                    const types = node.marks?.map(mark => mark.type) ?? [];
                    if (types.includes('code')) {
                        expect(types.filter(type => type !== 'code' && type !== 'link')).toEqual(
                            [],
                        );
                    }
                }
            }
        });

        it('Links, images, and bare URLs', () => {
            expect(convert('[Foo](https://en.wikipedia.org/wiki/Foo_(bar))').content).toEqual([
                para(txt('Foo', link('https://en.wikipedia.org/wiki/Foo_(bar)'))),
            ]);
            expect(convert('[docs](https://example.com "Docs")').content).toEqual([
                para(txt('docs', link('https://example.com', 'Docs'))),
            ]);
            const image = convert('![screenshot](https://example.com/shot.png)');
            expect(image.content).toEqual([
                para(txt('screenshot', link('https://example.com/shot.png'))),
            ]);
            for (const node of textNodes(image)) expect(node.text).not.toContain('!');
            expect(
                convert('Build log: https://ci.example.com/job/42 and <https://example.com/x>')
                    .content,
            ).toEqual([
                para(
                    txt('Build log: '),
                    txt('https://ci.example.com/job/42', link('https://ci.example.com/job/42')),
                    txt(' and '),
                    txt('https://example.com/x', link('https://example.com/x')),
                ),
            ]);
            expect(convert('[](https://example.com/empty)').content).toEqual([
                para(txt('https://example.com/empty', link('https://example.com/empty'))),
            ]);
        });

        it('Single newlines are hard breaks', () => {
            expect(convert('**Status:** fixed\n**PR:** 42').content).toEqual([
                para(txt('Status:', strong), txt(' fixed'), br, txt('PR:', strong), txt(' 42')),
            ]);
            // A mark spanning the break leaves the hardBreak itself unmarked.
            expect(convert('**one\ntwo**').content).toEqual([
                para(txt('one', strong), br, txt('two', strong)),
            ]);
        });

        it('Raw HTML is kept as literal text', () => {
            const line = 'Run af jira get <ISSUE-KEY>; it returns Promise<void>.';
            expect(convert(line).content).toEqual([para(txt(line))]);
            expect(convert('<details>\n<summary>Full log</summary>').content).toEqual([
                para(txt('<details>'), br, txt('<summary>Full log</summary>')),
            ]);
        });

        it('Task list items fall back to ballot boxes', () => {
            const result = convert('- [x] reproduce the bug\n- [ ] write a regression test');
            expect(result.content).toEqual([
                bullets(
                    item(txt('\u2611 reproduce the bug')),
                    item(txt('\u2610 write a regression test')),
                ),
            ]);
            const types = allNodes(result).map(node => node.type);
            expect(types).not.toContain('taskList');
            expect(types).not.toContain('taskItem');
        });

        it('Footnote syntax stays literal', () => {
            expect(convert('See note[^1].\n\n[^1]: Source.').content).toEqual([
                para(txt('See note[^1].')),
                para(txt('[^1]: Source.')),
            ]);
        });

        it('Content that ADF cannot nest is kept as text', () => {
            expect(
                convert(
                    '- # Heading\n- ***\n- | a | b |\n  |---|---|\n  | 1 | 2 |\n- > quoted\n  > text',
                ).content,
            ).toEqual([
                bullets(
                    item(txt('Heading')),
                    item(txt('***')),
                    item(txt('| a | b |'), br, txt('|---|---|'), br, txt('| 1 | 2 |')),
                    item(txt('quoted'), br, txt('text')),
                ),
            ]);
            expect(
                convert('> # Heading\n>\n> ***\n>\n> | a | b |\n> |---|---|\n> | 1 | 2 |').content,
            ).toEqual([
                quote(
                    para(txt('Heading')),
                    para(txt('***')),
                    para(txt('| a | b |'), br, txt('|---|---|'), br, txt('| 1 | 2 |')),
                ),
            ]);
        });
    });

    describe('adfToText', () => {
        it('should convert ADF paragraph to text', () => {
            const adf = convert('Hello world');
            const text = adfToText(adf);
            expect(text).toBe('Hello world');
        });

        it('should convert ADF heading to markdown', () => {
            const adf = convert('## Heading');
            const text = adfToText(adf);
            expect(text).toBe('## Heading');
        });

        it('should handle null input', () => {
            expect(adfToText(null)).toBe('');
        });

        it('should handle undefined input', () => {
            expect(adfToText(undefined)).toBe('');
        });

        it('should pass through string input', () => {
            expect(adfToText('plain text' as unknown as null)).toBe('plain text');
        });

        it('should round-trip bullet lists', () => {
            const original = '- Item 1\n- Item 2';
            const adf = convert(original);
            const text = adfToText(adf);
            expect(text).toBe(original);
        });

        it('should round-trip bold text', () => {
            const original = 'This is **bold** text';
            const adf = convert(original);
            const text = adfToText(adf);
            expect(text).toBe(original);
        });

        // The "Round-trip of fence, blockquote, and rule" scenario.
        it('should round-trip a fence + blockquote + rule document', () => {
            const original =
                '```typescript\nconst x = 1;\n```\n\n> a quote\n\n---\n\nFollow up paragraph';
            const adf = convert(original);
            const text = adfToText(adf);
            expect(text).toBe(original);
        });

        // The "Round-trip of canonical markdown" scenario: the form adfToText emits
        // converts and renders back byte for byte.
        it('should round-trip a canonical document with every supported construct', () => {
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
                '1) Install:',
                '   ```bash',
                '   npm ci',
                '   ```',
                '2) Test:',
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
                '| a \\| b | ~~flaky~~ |',
                '',
                'Text with **bold**, *em*, ***both***, ~~strike~~, `code`, a [link](https://example.com "Docs") and <https://ci.example.com/job/42>.',
                '**Status:** fixed',
                '',
                'Summary',
                'of the fix',
                '---',
                '',
                '## C \\#',
                '',
                '1\\. not a list',
                '',
                '- \u2610 write tests',
                '- \u2611 ship it',
                '',
                '* b',
                '',
                '<details>',
                '<summary>Full log</summary>',
            ].join('\n');
            const adf = convert(canonical);
            expect(adf.content.map(node => node.type)).toEqual([
                'heading',
                'heading',
                'bulletList',
                'orderedList',
                'orderedList',
                'codeBlock',
                'blockquote',
                'rule',
                'table',
                'paragraph',
                'heading',
                'heading',
                'paragraph',
                'bulletList',
                'bulletList',
                'paragraph',
            ]);
            expect(adfToText(adf)).toBe(canonical);
        });
    });

    // The adfToText scenarios of the Shared ADF conversion requirement, on hand-built
    // ADF shaped as Jira and Confluence return it. Where the scenario reads the output
    // back, textToAdf must rebuild the document.
    describe('adfToText spec scenarios', () => {
        it('ADF to markdown conversion', () => {
            const adf = doc(
                heading(2, txt('Summary')),
                para(
                    txt('Root cause: '),
                    txt('stale cache', strong),
                    txt(' in '),
                    txt('getUser()', code),
                    txt(', see '),
                    txt('the runbook', link('https://example.com/runbook')),
                    txt('.'),
                ),
                bullets(item(txt('fixed')), item(txt('tested', em))),
            );
            const markdown = adfToText(adf);
            expect(markdown).toBe(
                [
                    '## Summary',
                    '',
                    'Root cause: **stale cache** in `getUser()`, see [the runbook](https://example.com/runbook).',
                    '',
                    '- fixed',
                    '- *tested*',
                ].join('\n'),
            );
            expect(convert(markdown)).toStrictEqual(adf);
        });

        it('Mentions, emoji, and inline cards are rendered', () => {
            expect(
                adfToText(
                    doc(
                        para(
                            { type: 'mention', attrs: { id: 'abc123', text: '@Jane Doe' } },
                            txt(' '),
                            {
                                type: 'inlineCard',
                                attrs: { url: 'https://example.atlassian.net/browse/PROJ-1' },
                            },
                            txt(' '),
                            { type: 'emoji', attrs: { shortName: ':smile:' } },
                        ),
                        para({ type: 'mention', attrs: { id: 'abc123' } }),
                    ),
                ),
            ).toBe('@Jane Doe https://example.atlassian.net/browse/PROJ-1 :smile:\n\n@abc123');
            // With and without attrs.text, and a date (milliseconds, as a UTC day).
            expect(
                adfToText(
                    doc(
                        para(
                            { type: 'mention', attrs: { id: 'u1', text: 'Jane' } },
                            txt(' '),
                            { type: 'emoji', attrs: { shortName: ':tada:', text: '\uD83C\uDF89' } },
                            txt(' '),
                            { type: 'date', attrs: { timestamp: '1705276800000' } },
                            txt(' '),
                            { type: 'inlineCard', attrs: { data: { url: 'https://e.com/d' } } },
                        ),
                    ),
                ),
            ).toBe('@Jane \uD83C\uDF89 2024-01-15 https://e.com/d');
        });

        it('Task items are rendered', () => {
            expect(
                adfToText(
                    doc(
                        taskList(
                            task('TODO', txt('write tests')),
                            task('DONE', txt('ship it')),
                            taskList(task('TODO', txt('nested task'))),
                        ),
                    ),
                ),
            ).toBe('- [ ] write tests\n- [x] ship it\n  - [ ] nested task');
        });

        it('Tables are rendered as pipe tables', () => {
            const markdown = adfToText(
                doc(
                    table(
                        row(th(para(txt('Suite'))), th(para(txt('Result')))),
                        row(
                            td(para(txt('a | b'))),
                            td(para(txt('line one')), para(txt('line two'))),
                        ),
                    ),
                ),
            );
            expect(markdown).toBe(
                '| Suite | Result |\n| --- | --- |\n| a \\| b | line one line two |',
            );
            expect(convert(markdown).content).toEqual([
                table(
                    row(th(para(txt('Suite'))), th(para(txt('Result')))),
                    row(td(para(txt('a | b'))), td(para(txt('line one line two')))),
                ),
            ]);
        });

        it('Nested lists, start numbers, and strike are rendered', () => {
            const list = orderedFrom(
                3,
                listItem(para(txt('third')), bullets(item(txt('child')))),
                item(txt('fourth')),
            );
            expect(adfToText(doc(list))).toBe('3. third\n   - child\n4. fourth');
            expect(convert(adfToText(doc(list))).content).toEqual([list]);
            expect(adfToText(doc(para(txt('gone', strike))))).toBe('~~gone~~');
            // Adjacent lists of one type switch markers, so they read back as two lists.
            const twoBulletLists = doc(bullets(item(txt('a'))), bullets(item(txt('b'))));
            expect(adfToText(twoBulletLists)).toBe('- a\n\n* b');
            expect(convert(adfToText(twoBulletLists))).toStrictEqual(twoBulletLists);
            const twoOrderedLists = doc(ordered(item(txt('a'))), ordered(item(txt('b'))));
            expect(adfToText(twoOrderedLists)).toBe('1. a\n\n1) b');
            expect(convert(adfToText(twoOrderedLists))).toStrictEqual(twoOrderedLists);
        });

        it('Unrecognized nodes keep their text', () => {
            expect(
                adfToText(
                    doc(
                        {
                            type: 'panel',
                            attrs: { panelType: 'info' },
                            content: [para(txt('panel text'))],
                        },
                        {
                            type: 'decisionList',
                            attrs: { localId: 'd' },
                            content: [
                                {
                                    type: 'decisionItem',
                                    attrs: { localId: 'i', state: 'DECIDED' },
                                    content: [txt('use marked')],
                                },
                            ],
                        },
                        para(txt('Status: '), {
                            type: 'status',
                            attrs: { text: 'IN PROGRESS', color: 'blue' },
                        }),
                    ),
                ),
            ).toBe('panel text\n\nuse marked\n\nStatus: IN PROGRESS');
            // Missing or malformed content never throws.
            const malformed = {
                type: 'doc',
                version: 1,
                content: [
                    null,
                    { type: 'paragraph', content: 'not an array' },
                    { type: 'paragraph', content: [null, { type: 'text', text: 7 }] },
                    { type: 'bulletList' },
                    { type: 'panel', content: [{ type: 'text', text: 'kept' }] },
                ],
            } as unknown as AdfDocument;
            expect(adfToText(malformed)).toBe('kept');
        });

        it('Paragraph text that looks like block syntax is escaped', () => {
            const adf = doc(para(txt('1. not a list')), para(txt('# not a heading')));
            const markdown = adfToText(adf);
            expect(markdown).toBe('1\\. not a list\n\n\\# not a heading');
            expect(convert(markdown)).toStrictEqual(adf);
        });

        it('Headings that ATX syntax cannot hold are rendered', () => {
            const adf = doc(
                heading(2, txt('Summary'), br, txt('of the fix')),
                heading(2, txt('C #')),
            );
            const markdown = adfToText(adf);
            expect(markdown).toBe('Summary\nof the fix\n---\n\n## C \\#');
            expect(convert(markdown)).toStrictEqual(adf);
            expect(adfToText(doc(heading(3, txt('a'), br, txt('b'))))).toBe('### a b');
        });
    });

    describe('adfToText line-start escaping (design D12)', () => {
        it('should escape block markers that start a paragraph line, so the text reads back', () => {
            const adf = doc(
                para(txt('- a')),
                para(txt('+ b')),
                para(txt('> c')),
                para(txt('```js')),
                para(txt('~~~')),
                para(txt('***')),
                para(txt('===')),
                para(txt('1) x')),
                para(txt('2024. It affects')),
                para(txt('-')),
                para(txt('#')),
                para(
                    txt('Intro'),
                    br,
                    txt('# not a heading'),
                    br,
                    txt('- not an item'),
                    br,
                    txt('---'),
                ),
            );
            const markdown = adfToText(adf);
            expect(markdown).toBe(
                [
                    '\\- a',
                    '\\+ b',
                    '\\> c',
                    '\\```js',
                    '\\~~~',
                    '\\***',
                    '\\===',
                    '1\\) x',
                    '2024\\. It affects',
                    '\\-',
                    '\\#',
                    'Intro\n\\# not a heading\n\\- not an item\n\\---',
                ].join('\n\n'),
            );
            expect(convert(markdown)).toStrictEqual(adf);
        });

        it('should leave a later line that cannot interrupt a paragraph alone', () => {
            const adf = doc(
                para(
                    txt('The regression was introduced in the release of'),
                    br,
                    txt('2024. It affects every tenant.'),
                ),
            );
            const markdown = adfToText(adf);
            expect(markdown).toBe(
                'The regression was introduced in the release of\n2024. It affects every tenant.',
            );
            expect(convert(markdown)).toStrictEqual(adf);
        });

        it('should escape every line of a list item, where any line can open a block', () => {
            const adf = doc(bullets(item(txt('a'), br, txt('2024. It affects'), br, txt('*'))));
            const markdown = adfToText(adf);
            expect(markdown).toBe('- a\n  2024\\. It affects\n  \\*');
            expect(convert(markdown)).toStrictEqual(adf);
        });
    });

    // Converter output must survive textToAdf -> adfToText -> textToAdf (design D12).
    // These are regressions found by fuzzing the round trip.
    describe('round trips', () => {
        it('should keep a block after an HTML-looking item paragraph out of its HTML block', () => {
            expect(expectStable('- <ISSUE-KEY>\n\n  - nested').content).toEqual([
                bullets(listItem(para(txt('<ISSUE-KEY>')), bullets(item(txt('nested'))))),
            ]);
            expect(adfToText(convert('- <ISSUE-KEY>\n\n  - nested'))).toBe(
                '- <ISSUE-KEY>\n\n  - nested',
            );
            expectStable('- <ISSUE-KEY>\n\n  ```\n  code\n  ```');
            expectStable('- a\n\n  <div>\n\n  - b');
        });

        it('should write a paragraph read from an HTML block verbatim', () => {
            const adf = expectStable('<ISSUE-KEY>\n- one\n- two');
            expect(adf.content).toEqual([
                para(txt('<ISSUE-KEY>'), br, txt('- one'), br, txt('- two')),
            ]);
            expect(adfToText(adf)).toBe('<ISSUE-KEY>\n- one\n- two');
            expectStable('<details>\n<summary>Full log</summary>\n# not a heading');
            expectStable('<!--\n   \nnote\n-->');
            expectStable('- <!--\n     \n  note\n  -->');
            expectStable('> <!--\n>    \n> note\n> -->');
        });

        it('should write an unterminated HTML block that another block follows as a paragraph', () => {
            const adf = expectStable('> <script>\nlazy text');
            expect(adf.content).toEqual([quote(para(txt('<script>')), para(txt('lazy text')))]);
            expect(adfToText(adf)).toBe('> \\<script>\n>\n> lazy text');
            expect(adfToText(expectStable('> lazy text\n>\n> <script>'))).toBe(
                '> lazy text\n>\n> <script>',
            );
        });

        it('should escape the < of any other line that would open an HTML block', () => {
            expect(adfToText(expectStable('\\<div> **x**'))).toBe('\\<div> **x**');
            expect(adfToText(expectStable('a\n\\<div>'))).toBe('a\n\\<div>');
            expect(adfToText(expectStable('a\n\\<preview>'))).toBe('a\n\\<preview>');
            expect(adfToText(expectStable('- a\n  \\<ISSUE-KEY>'))).toBe('- a\n  \\<ISSUE-KEY>');
            expect(adfToText(expectStable('Fix\n\\<ISSUE-KEY>\n---'))).toBe(
                'Fix\n\\<ISSUE-KEY>\n---',
            );
            expect(adfToText(expectStable('Fix\n\\<1>\n---'))).toBe('Fix\n\\<1>\n---');
        });

        it('should escape a line that would read as a link reference definition', () => {
            // Unescaped, marked would take these lines as definitions and drop their text.
            const top = expectStable('\\[a]: https://x.test');
            expect(top.content).toEqual([
                para(txt('[a]: '), txt('https://x.test', link('https://x.test'))),
            ]);
            expect(adfToText(top)).toBe('\\[a]: <https://x.test>');
            const inItem = expectStable('- \\[a]: x');
            expect(inItem.content).toEqual([bullets(item(txt('[a]: x')))]);
            expect(adfToText(inItem)).toBe('- \\[a]: x');
            const inQuote = expectStable('> \\[a]: x');
            expect(inQuote.content).toEqual([quote(para(txt('[a]: x')))]);
            expect(adfToText(inQuote)).toBe('> \\[a]: x');
            // Footnote-style definitions stay text anyway (design D3).
            expect(adfToText(convert('[^1]: Source.'))).toBe('[^1]: Source.');
        });

        it('should escape a task box at the start of a list item', () => {
            const adf = expectStable('1. \\[x] done\n2. \\[ ] open');
            expect(adf.content).toEqual([ordered(item(txt('[x] done')), item(txt('[ ] open')))]);
            expect(adfToText(adf)).toBe('1. \\[x] done\n2. \\[ ] open');
        });

        it('should keep emphasis that ends or starts with a code span', () => {
            // Closed at the code span, the whitespace before it moved out of the mark.
            for (const input of [
                '1. **Install with `npm ci`**',
                'Note: **run `bun run test`**.',
                '*see `x`* now',
                '~~old `api`~~ new',
                '**`code` first**',
                '**`a` and `b`**',
            ]) {
                expect(adfToText(expectStable(input)), input).toBe(input);
            }
            expect(expectStable('1. **Install with `npm ci`**').content).toEqual([
                ordered(item(txt('Install with ', strong), txt('npm ci', code))),
            ]);
            expectStable('[**run `x`**](https://e.com)');
            expectStable('**run `x`\nnext**');
        });

        it('should keep emphasis on a line of delimiter characters', () => {
            // A backslash added to `*-*` as a thematic-break look-alike broke the emphasis.
            const adf = expectStable('*-*\n\n_-_\n\n**=**');
            expect(adf.content).toEqual([
                para(txt('-', em)),
                para(txt('-', em)),
                para(txt('=', strong)),
            ]);
        });

        it('should keep empty nested items from reading back as a rule', () => {
            const adf = expectStable('- - +');
            expect(adf.content).toEqual([bullets(listItem(bullets(listItem(bullets(item())))))]);
            expect(adfToText(adf)).toBe('-\n  - -');
            expectStable('* * -');
            // Such an item starts empty, so it cannot interrupt the paragraph before it.
            expect(adfToText(expectStable('- a\n  - - +'))).toBe('- a\n\n  -\n    - -');
        });

        it('should keep a byte-order mark at the start of the text', () => {
            for (const input of ['\uFEFF\uFEFF## Title', '\n\uFEFF## Title']) {
                expect(expectStable(input).content).toEqual([para(txt('\uFEFF## Title'))]);
            }
        });

        it('should keep U+2028 and U+2029 at the edge of a code language and a table cell', () => {
            expect(expectStable('```a\u2028\nx\n```').content).toEqual([codeBlock('x', 'a\u2028')]);
            expect(expectStable('| x\u2028 | y |\n|---|---|\n| \u2029 | z |').content).toEqual([
                table(
                    row(th(para(txt('x\u2028'))), th(para(txt('y')))),
                    row(td(para(txt('\u2029'))), td(para(txt('z')))),
                ),
            ]);
        });

        it('should give a deeper-indented line in a list item one hard break', () => {
            // marked appends such a line as code, and kept that code's line ending.
            const adf = expectStable(
                '1. Install the deps\n        then run the build\n   and the tests',
            );
            expect(adf.content).toEqual([
                ordered(
                    item(
                        txt('Install the deps'),
                        br,
                        txt('then run the build'),
                        br,
                        txt('and the tests'),
                    ),
                ),
            ]);
        });

        it('should keep converter output stable for HTML-looking lines anywhere', () => {
            const opening = [
                '<ISSUE-KEY>',
                '<div class="x">',
                '</div>',
                '<details>',
                '<preview>',
                '<pre>',
                '<!-- note -->',
                '<!--',
                '<?php',
                '<!DOCTYPE html>',
                '<![CDATA[',
                '<x:y>',
                '<1>',
                '\\<div> **x**',
            ];
            const following = [
                '- item',
                '2024. x',
                '# head',
                '> quote',
                '```',
                '===',
                '**bold**',
                '[a]: https://x.test',
                '[ ] task',
                '<div>',
                '<ISSUE-KEY>',
                '-->',
            ];
            const contexts: Array<(lines: string[]) => string> = [
                lines => lines.join('\n'),
                lines => lines.map((line, i) => (i === 0 ? '- ' : '  ') + line).join('\n'),
                lines => lines.map(line => '> ' + line).join('\n'),
                lines => lines.join('\n') + '\n---',
            ];
            for (const wrap of contexts) {
                for (const first of opening) {
                    for (const next of following) {
                        const input = wrap([first, next]);
                        const adf = convert(input);
                        expect(convert(adfToText(adf)), JSON.stringify(input)).toStrictEqual(adf);
                    }
                }
            }
        });
    });

    describe('robust markdown input', () => {
        describe('inputs that used to hang (child process)', () => {
            for (const { name, input, expected } of CHILD_PROCESS_CASES) {
                it(`should convert ${name}`, { timeout: 15_000 }, () => {
                    const result = convertInChild(input);
                    expectWellFormed(result, input);
                    expect(result).toEqual(expected);
                });
            }
        });

        describe('scenarios (in process)', () => {
            for (const { name, input, expected } of IN_PROCESS_CASES) {
                it(`should convert ${name}`, () => {
                    const result = textToAdf(input);
                    expectWellFormed(result, input);
                    expect(result).toEqual(expected);
                });
            }
        });

        describe('large inputs', () => {
            // A trailing-whitespace regex on the heading text took about 35 s here.
            it(
                'should convert a heading with a long run of spaces inside its text',
                { timeout: 15_000 },
                () => {
                    const headingText = 'a' + ' '.repeat(200_000) + 'b';
                    const input = '# ' + headingText;
                    const result = convertInChild(input);
                    expectWellFormed(result, input);
                    expect(result).toEqual(doc(heading(1, txt(headingText))));
                },
            );

            // marked tried its setext rule at every line of a list item, scanning to the end of
            // the item each time; under Bun, which the child runs, this took about 20 s. The
            // second input has an underline that a quote line keeps the rule from reaching.
            it('should convert a list item of 3,000 lines', { timeout: 15_000 }, () => {
                const lines = Array.from(
                    { length: 3_000 },
                    (_, i) => `PASS src/module${i}.test.ts`,
                );
                const text = item(txt('Test output:'), ...lines.flatMap(line => [br, txt(line)]));
                const body = '1. Test output:\n' + lines.map(line => '   ' + line).join('\n');
                for (const [input, expected] of [
                    [body, doc(ordered(text))],
                    [
                        body + '\n   > quoted\n   ---',
                        doc(
                            ordered(
                                listItem(
                                    ...(text.content ?? []),
                                    para(txt('quoted')),
                                    para(txt('---')),
                                ),
                            ),
                        ),
                    ],
                ] as const) {
                    const result = convertInChild(input);
                    expectWellFormed(result, input);
                    expect(result).toEqual(expected);
                }
            });

            // A rule, a tag line or a delimiter row above the underline, which the setext check
            // left to marked's rule, let the rule scan to it from every line again: 5,000 lines
            // took seconds. The schema check of these documents takes seconds, so the documents
            // are compared whole instead (they have the shapes of the test above).
            it(
                'should convert a list item of 3,000 lines above a rule and an underline',
                { timeout: 15_000 },
                () => {
                    const lines = Array.from(
                        { length: 3_000 },
                        (_, i) => `PASS src/module${i}.test.ts`,
                    );
                    const output = (count: number): AdfNode =>
                        para(
                            txt('Test output:'),
                            ...lines.slice(0, count).flatMap(line => [br, txt(line)]),
                        );
                    const body = '1. Test output:\n' + lines.map(line => '   ' + line).join('\n');
                    for (const [tail, expected] of [
                        ['***\n   ---', [output(3_000), para(txt('***')), para(txt('---'))]],
                        ['<div>\n   =', [output(3_000), para(txt('<div>'), br, txt('='))]],
                        // The delimiter row makes the line above it a table header.
                        [
                            '|-|\n   ---',
                            [
                                output(2_999),
                                para(txt(lines[2_999]), br, txt('|-|')),
                                para(txt('---')),
                            ],
                        ],
                    ] as const) {
                        const input = `${body}\n   ${tail}`;
                        const result = convertInChild(input);
                        expect(adfProblems(result, input), 'output guarantees').toEqual([]);
                        expect(result).toEqual(doc(ordered(listItem(...expected))));
                    }
                },
            );

            // Spreading this many inline nodes into push() threw a RangeError.
            it('should convert a paragraph and a quote of 400,000 inline nodes', () => {
                const line = '*a* '.repeat(200_000);
                const paragraph = textToAdf(line).content[0];
                expect(paragraph.type).toBe('paragraph');
                expect(paragraph.content).toHaveLength(400_000);
                const quote = textToAdf('> ' + line).content[0];
                expect(quote.type).toBe('blockquote');
                expect(quote.content?.[0].content).toHaveLength(400_000);
            });
        });

        // marked lexes a nested quote twice when lazy lines follow it, so a quote whose depth
        // drops one level per line took time exponential in its depth, and each level of quote
        // or list nesting is a recursive call. A quote cut short at a bare quote line re-ran the
        // quote rule over the lines after it. These run in a child process, so that a regression
        // fails at the deadline (design D15); each converts in under a second.
        describe('deep and repeated quotes and lists (child process)', () => {
            // One paragraph of the lines, separated by hard breaks.
            const lines = (texts: string[]): AdfNode =>
                para(...texts.flatMap((text, k) => (k === 0 ? [txt(text)] : [br, txt(text)])));
            const ladder = (depths: number[]): string =>
                depths.map(depth => '>'.repeat(depth) + 'a').join('\n');
            // A descending ladder whose deepest line opens a fenced code block.
            const fencedLadder = (depth: number): string[] => [
                '>'.repeat(depth) + ' ```',
                ...Array.from({ length: depth - 1 }, (_, k) => '>'.repeat(depth - 1 - k) + ' a'),
            ];
            const cases: ConversionCase[] = [
                {
                    // 3.5 to 7 s before the fix; 24 levels took 14 to 27 s.
                    name: 'a quote whose depth drops one level per line, 22 levels deep',
                    input: ladder(Array.from({ length: 22 }, (_, k) => 22 - k)),
                    expected: doc(quote(lines(Array.from({ length: 22 }, () => 'a')))),
                },
                {
                    // marked dropped the tokens of each first lex but still lexed their inline
                    // text, so the deepest paragraph was lexed hundreds of times: 8 s before the
                    // fix.
                    name: 'a ten-level ladder whose deepest paragraph holds emphasis that never closes',
                    input: [
                        '>'.repeat(10) + ' ' + '*a '.repeat(1_000),
                        ...Array.from({ length: 9 }, (_, k) => '>'.repeat(9 - k) + ' b'),
                    ].join('\n'),
                    expected: doc(
                        quote(lines(['*a '.repeat(1_000).trimEnd(), ...Array(9).fill('b')])),
                    ),
                },
                {
                    // Killed after 100 s before the fix.
                    name: 'a quote whose depth drops six levels per line, from 60',
                    input: ladder(Array.from({ length: 10 }, (_, k) => 60 - 6 * k)),
                    expected: doc(quote(lines(Array.from({ length: 10 }, () => 'a')))),
                },
                {
                    // Overflowed the stack: RangeError.
                    name: '9,000 nested quote markers',
                    input: '>'.repeat(9_000) + ' a',
                    expected: doc(quote(para(txt('a')))),
                },
                {
                    // Overflowed the mapper's stack: RangeError. Kept as written.
                    name: '7,000 nested list markers',
                    input: '- '.repeat(7_000) + 'a',
                    expected: doc(para(txt('- '.repeat(7_000) + 'a'))),
                },
                {
                    // The first line may open a fenced code block, so no line is cut and the
                    // quote work runs out. Kept as written.
                    name: 'nested quotes that would take too long to lex',
                    input: fencedLadder(30).join('\n'),
                    expected: doc(lines(fencedLadder(30))),
                },
                {
                    // Each bare quote line re-ran the quote rule over all the lines after it:
                    // 8 s before the fix.
                    name: '3,800 bare quote lines holding a tab, each before an unquoted line',
                    input: '>\t\nb\n'.repeat(3_800),
                    expected: doc(
                        ...Array.from({ length: 3_800 }).flatMap(() => [
                            quote(para()),
                            para(txt('b')),
                        ]),
                    ),
                },
                {
                    name: '3,166 bare quote lines holding two spaces, each before an unquoted line',
                    input: '>  \nb\n'.repeat(3_166),
                    expected: doc(
                        ...Array.from({ length: 3_166 }).flatMap(() => [
                            quote(para()),
                            para(txt('b')),
                        ]),
                    ),
                },
                {
                    name: '1,900 quotes ended by a bare quote line holding two spaces',
                    input: '> a\n>  \nb\n'.repeat(1_900),
                    expected: doc(
                        ...Array.from({ length: 1_900 }).flatMap(() => [
                            quote(para(txt('a'))),
                            para(txt('b')),
                        ]),
                    ),
                },
            ];
            for (const { name, input, expected } of cases) {
                it(`should convert ${name}`, { timeout: 15_000 }, () => {
                    const result = convertInChild(input);
                    expect(adfProblems(result, input), 'output guarantees').toEqual([]);
                    expect(result).toEqual(expected);
                });
            }
        });
    });

    // Defects an adversarial review found in the mapper; each also survives the round trip.
    describe('task boxes, code tabs and definitions', () => {
        it("should take the box of a task item from the item's own first paragraph", () => {
            const adf = expectStable('- [x] Phase 1\n\n  [x] migrated the DB\n- [ ] Phase 2');
            expect(adf.content).toEqual([
                bullets(
                    listItem(para(txt('\u2611 Phase 1')), para(txt('[x] migrated the DB'))),
                    item(txt('\u2610 Phase 2')),
                ),
            ]);
            expect(expectStable('- [ ] [x] a').content).toEqual([
                bullets(item(txt('\u2610 [x] a'))),
            ]);
        });

        it('should keep the tabs that indent code in a list item', () => {
            const adf = expectStable(
                '1. Add this rule:\n   ```make\n   build:\n   \tgo build ./...\n   ```',
            );
            expect(adf.content).toEqual([
                ordered(
                    listItem(
                        para(txt('Add this rule:')),
                        codeBlock('build:\n\tgo build ./...', 'make'),
                    ),
                ),
            ]);
            const reviewer = expectStable(
                '- Reviewer suggested:\n  > ```make\n  > build:\n  > \tgo build ./...\n  > ```',
            );
            expect(reviewer.content).toEqual([
                bullets(
                    listItem(
                        para(txt('Reviewer suggested:')),
                        codeBlock('build:\n\tgo build ./...', 'make'),
                    ),
                ),
            ]);
            // Flattened into the item from a quote, the tab read back as four spaces.
            expect(expectStable('- > ```\n  > \ta\n  > ```').content).toEqual([
                bullets(listItem(codeBlock('\ta'))),
            ]);
            // A list item code block from the Jira UI.
            const jira = doc(
                bullets(listItem(para(txt('Run:')), codeBlock('if x {\n\treturn\n}'))),
            );
            expect(convert(adfToText(jira))).toStrictEqual(jira);
        });

        it('should not read a link reference definition across a blank line', () => {
            expect(expectStable('[TODO: verify the numbers\n\nStatus]: open').content).toEqual([
                para(txt('[TODO: verify the numbers')),
                para(txt('Status]: open')),
            ]);
        });
    });
});
