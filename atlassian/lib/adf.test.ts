import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { textToAdf, adfToText, parseInlineMarkdown } from './adf.ts';
import type { AdfDocument, AdfNode } from './adf-types.ts';

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

// Every output must have non-empty text nodes without carriage returns.
function expectWellFormed(doc: AdfDocument): void {
    const visit = (node: AdfNode): void => {
        if (node.type === 'text') {
            expect(node.text?.length ?? 0, 'empty text node').toBeGreaterThan(0);
            expect(node.text, 'carriage return in a text node').not.toContain('\r');
        }
        node.content?.forEach(visit);
    };
    doc.content.forEach(visit);
}

// Builders for the expected documents below.
const txt = (text: string): AdfNode => ({ type: 'text', text });
const br: AdfNode = { type: 'hardBreak' };
const para = (...content: AdfNode[]): AdfNode => ({ type: 'paragraph', content });
const heading = (level: number, ...content: AdfNode[]): AdfNode => ({
    type: 'heading',
    attrs: { level },
    content,
});
const item = (...content: AdfNode[]): AdfNode => ({
    type: 'listItem',
    content: [para(...content)],
});
const bullets = (...items: AdfNode[]): AdfNode => ({ type: 'bulletList', content: items });
const ordered = (...items: AdfNode[]): AdfNode => ({ type: 'orderedList', content: items });
const quote = (...paragraphs: AdfNode[]): AdfNode => ({ type: 'blockquote', content: paragraphs });
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
            const result = textToAdf('Hello world');
            expect(result.type).toBe('doc');
            expect(result.version).toBe(1);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('paragraph');
            expect(result.content[0].content?.[0].text).toBe('Hello world');
        });

        it('should convert headings', () => {
            const result = textToAdf('## My Heading');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('heading');
            expect(result.content[0].attrs?.level).toBe(2);
            expect(result.content[0].content?.[0].text).toBe('My Heading');
        });

        it('should convert unordered lists', () => {
            const result = textToAdf('- Item 1\n- Item 2\n- Item 3');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('bulletList');
            expect(result.content[0].content).toHaveLength(3);
        });

        it('should convert ordered lists', () => {
            const result = textToAdf('1. First\n2. Second');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('orderedList');
            expect(result.content[0].content).toHaveLength(2);
        });

        it('should handle multiple paragraphs', () => {
            const result = textToAdf('Paragraph one\n\nParagraph two');
            expect(result.content).toHaveLength(2);
            expect(result.content[0].type).toBe('paragraph');
            expect(result.content[1].type).toBe('paragraph');
        });

        it('should handle empty string', () => {
            const result = textToAdf('');
            expect(result.content).toHaveLength(0);
        });

        it('should convert a fenced code block with language', () => {
            const result = textToAdf('```typescript\nconst x = 1;\n```');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('codeBlock');
            expect(result.content[0].attrs?.language).toBe('typescript');
            expect(result.content[0].content?.[0].text).toBe('const x = 1;');
        });

        it('should convert a fenced code block without language', () => {
            const result = textToAdf('```\nplain code\n```');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('codeBlock');
            expect(result.content[0].attrs?.language).toBeUndefined();
            expect(result.content[0].content?.[0].text).toBe('plain code');
        });

        it('should preserve list/heading-like lines verbatim inside a fence', () => {
            const input = '```\n- not a list\n# not a heading\n1. not ordered\n```';
            const result = textToAdf(input);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('codeBlock');
            expect(result.content[0].content?.[0].text).toBe(
                '- not a list\n# not a heading\n1. not ordered',
            );
        });

        it('should consume to end of input on an unterminated fence', () => {
            const result = textToAdf('```\nline one\nline two');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('codeBlock');
            expect(result.content[0].content?.[0].text).toBe('line one\nline two');
        });

        it('should produce empty content for an empty fence body', () => {
            const result = textToAdf('```\n```');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('codeBlock');
            expect(result.content[0].content).toEqual([]);
        });

        it('should convert a single-line blockquote', () => {
            const result = textToAdf('> quoted text');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('blockquote');
            expect(result.content[0].content?.[0].type).toBe('paragraph');
            expect(result.content[0].content?.[0].content?.[0].text).toBe('quoted text');
        });

        it('should collapse consecutive > lines into one blockquote with hardBreaks', () => {
            const result = textToAdf('> line 1\n> line 2');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('blockquote');
            const paragraph = result.content[0].content?.[0];
            expect(paragraph?.type).toBe('paragraph');
            expect(paragraph?.content?.[0].text).toBe('line 1');
            expect(paragraph?.content?.[1].type).toBe('hardBreak');
            expect(paragraph?.content?.[2].text).toBe('line 2');
        });

        it('should convert a horizontal rule', () => {
            const result = textToAdf('---');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('rule');
        });

        it('should also convert *** as a horizontal rule', () => {
            const result = textToAdf('***');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('rule');
        });
    });

    describe('parseInlineMarkdown', () => {
        it('should handle bold text', () => {
            const nodes = parseInlineMarkdown('This is **bold** text');
            expect(nodes).toHaveLength(3);
            expect(nodes[1].marks?.[0].type).toBe('strong');
            expect(nodes[1].text).toBe('bold');
        });

        it('should handle italic text', () => {
            const nodes = parseInlineMarkdown('This is *italic* text');
            expect(nodes).toHaveLength(3);
            expect(nodes[1].marks?.[0].type).toBe('em');
            expect(nodes[1].text).toBe('italic');
        });

        it('should handle code text', () => {
            const nodes = parseInlineMarkdown('Use `code` here');
            expect(nodes).toHaveLength(3);
            expect(nodes[1].marks?.[0].type).toBe('code');
            expect(nodes[1].text).toBe('code');
        });

        it('should handle links', () => {
            const nodes = parseInlineMarkdown('Visit [Google](https://google.com)');
            expect(nodes).toHaveLength(2);
            expect(nodes[1].marks?.[0].type).toBe('link');
            expect(nodes[1].marks?.[0].attrs?.href).toBe('https://google.com');
            expect(nodes[1].text).toBe('Google');
        });

        it('should handle plain text without markdown', () => {
            const nodes = parseInlineMarkdown('Just plain text');
            expect(nodes).toHaveLength(1);
            expect(nodes[0].text).toBe('Just plain text');
        });

        it('should return no nodes for empty input', () => {
            expect(parseInlineMarkdown('')).toEqual([]);
        });
    });

    describe('adfToText', () => {
        it('should convert ADF paragraph to text', () => {
            const adf = textToAdf('Hello world');
            const text = adfToText(adf);
            expect(text).toBe('Hello world');
        });

        it('should convert ADF heading to markdown', () => {
            const adf = textToAdf('## Heading');
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
            const adf = textToAdf(original);
            const text = adfToText(adf);
            expect(text).toBe(original);
        });

        it('should round-trip bold text', () => {
            const original = 'This is **bold** text';
            const adf = textToAdf(original);
            const text = adfToText(adf);
            expect(text).toBe(original);
        });

        it('should round-trip a fence + blockquote + rule document', () => {
            const original =
                '```typescript\nconst x = 1;\n```\n\n> a quote\n\n---\n\nFollow up paragraph';
            const adf = textToAdf(original);
            const text = adfToText(adf);
            expect(text).toBe(original);
        });
    });

    describe('robust markdown input', () => {
        describe('inputs that used to hang (child process)', () => {
            for (const { name, input, expected } of CHILD_PROCESS_CASES) {
                it(`should convert ${name}`, { timeout: 15_000 }, () => {
                    const result = convertInChild(input);
                    expectWellFormed(result);
                    expect(result).toEqual(expected);
                });
            }
        });

        describe('scenarios (in process)', () => {
            for (const { name, input, expected } of IN_PROCESS_CASES) {
                it(`should convert ${name}`, () => {
                    const result = textToAdf(input);
                    expectWellFormed(result);
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
                    const result = convertInChild('# ' + headingText);
                    expectWellFormed(result);
                    expect(result).toEqual(doc(heading(1, txt(headingText))));
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
    });
});
