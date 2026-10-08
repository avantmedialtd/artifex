// cspell:words FDEF lheading noncharacters xfdd xmpp
// Unit tests for the markdown to ADF mapper: input normalization, the marked instance and its
// tokenizer overrides, and the details of block and inline mapping. The spec scenarios and the
// robust-input cases run through the textToAdf facade in adf.test.ts, and the converter corpus in
// adf.corpus.test.ts. Every conversion checked through `convert` is also validated against the
// vendored ADF JSON schema and the output guarantees of adfProblems.

import { Lexer, marked } from 'marked';
import { describe, expect, it } from 'vitest';
import { adfProblems, validateAdf } from '../../test/helpers/adf.ts';
import type { AdfDocument, AdfMark, AdfNode } from './adf-types.ts';
import { inlineTextLength, markdownToAdf, mayHaveSetextUnderline } from './markdown-to-adf.ts';

// Converts markdown and checks what every result must meet: valid ADF, and no empty or
// CR-bearing text, duplicate mark type, hardBreak with marks or leaked sentinel.
function convert(input: string): AdfDocument {
    const result = markdownToAdf(input);
    expect(validateAdf(result), 'ADF schema errors').toBeNull();
    expect(adfProblems(result, input)).toEqual([]);
    return result;
}

// Builders for expected documents, in the shapes atlassian/lib/adf.test.ts uses.
const strong: AdfMark = { type: 'strong' };
const link = (href: string, title?: string): AdfMark => ({
    type: 'link',
    attrs: title ? { href, title } : { href },
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
const quote = (...paragraphs: AdfNode[]): AdfNode => ({ type: 'blockquote', content: paragraphs });
const codeBlock = (text: string, language?: string): AdfNode => ({
    type: 'codeBlock',
    attrs: language ? { language } : {},
    content: text ? [txt(text)] : [],
});
const cell = (type: 'tableHeader' | 'tableCell', ...content: AdfNode[]): AdfNode => ({
    type,
    content: [para(...content)],
});
const row = (...cells: AdfNode[]): AdfNode => ({ type: 'tableRow', content: cells });
const table = (...rows: AdfNode[]): AdfNode => ({
    type: 'table',
    attrs: { isNumberColumnEnabled: false, layout: 'default' },
    content: rows,
});
const doc = (...content: AdfNode[]): AdfDocument => ({ type: 'doc', version: 1, content });

describe('markdownToAdf', () => {
    describe('large inputs', () => {
        // marked's own inline text rule needed 5 s under Bun and 17 s under Node for the first
        // two inputs; the mapper's linear replacement needs milliseconds.
        it('should convert a heading with a long run of spaces inside its text quickly', () => {
            const headingText = 'a' + ' '.repeat(200_000) + 'b';
            const started = performance.now();
            const result = markdownToAdf('# ' + headingText);
            expect(performance.now() - started).toBeLessThan(2_000);
            expect(result).toEqual(doc(heading(1, txt(headingText))));
        });

        it('should convert a paragraph with a long run of spaces inside its text quickly', () => {
            const text = 'a' + ' '.repeat(200_000) + 'b';
            const started = performance.now();
            const result = markdownToAdf(text);
            expect(performance.now() - started).toBeLessThan(2_000);
            expect(result).toEqual(doc(para(txt(text))));
        });

        // marked tried its setext rule at every line of a list item, each time scanning to the
        // end of the item. The deadline test under Bun, where this was slowest, is in adf.test.ts.
        it('should convert a list item of many lines quickly', () => {
            const lines = Array.from({ length: 5_000 }, (_, i) => `PASS src/module${i}.test.ts`);
            const started = performance.now();
            const result = markdownToAdf(
                '1. Tests:\n' + lines.map(line => '   ' + line).join('\n'),
            );
            expect(performance.now() - started).toBeLessThan(2_000);
            expect(result).toEqual(
                doc(ordered(item(txt('Tests:'), ...lines.flatMap(line => [br, txt(line)])))),
            );
        });

        // With a rule, a tag line or a delimiter row above an underline, the rule scanned to that
        // line from every line of the item: 5,000 lines took seconds.
        it('should convert a list item of many lines above a rule and an underline quickly', () => {
            const lines = Array.from({ length: 5_000 }, (_, i) => `ok ${i} - test passed`);
            const body = '- Test output:\n' + lines.map(line => '  ' + line).join('\n');
            const output = (count: number): AdfNode =>
                para(
                    txt('Test output:'),
                    ...lines.slice(0, count).flatMap(line => [br, txt(line)]),
                );
            const last = lines[lines.length - 1];
            for (const [tail, expected] of [
                ['***\n  ---', [output(5_000), para(txt('***')), para(txt('---'))]],
                ['<div>\n  ===', [output(5_000), para(txt('<div>'), br, txt('==='))]],
                // The delimiter row makes the line above it a table header (design D5).
                ['|-|\n  ---', [output(4_999), para(txt(last), br, txt('|-|')), para(txt('---'))]],
            ] as const) {
                const started = performance.now();
                const result = markdownToAdf(`${body}\n  ${tail}`);
                expect(performance.now() - started, tail).toBeLessThan(2_000);
                expect(result).toEqual(doc(bullets(listItem(...expected))));
            }
            // The review's inputs: lazy lines, and pasted test output.
            const lazy = Array.from({ length: 5_000 }, () => [br, txt('b')]).flat();
            for (const [tail, ...after] of [
                ['***\n  ---', para(txt('***')), para(txt('---'))],
                ['<div>\n  =', para(txt('<div>'), br, txt('='))],
            ] as const) {
                const started = performance.now();
                const result = markdownToAdf('- a\n' + 'b\n'.repeat(5_000) + '  ' + tail);
                expect(performance.now() - started, tail).toBeLessThan(2_000);
                expect(result).toEqual(doc(bullets(listItem(para(txt('a'), ...lazy), ...after))));
            }
            const passed = Array.from({ length: 800 }, () => [br, txt('ok 1 - test_x passed')]);
            const started = performance.now();
            const result = markdownToAdf(
                '- Test output:\n' +
                    '  ok 1 - test_x passed\n'.repeat(800) +
                    '  ************\n  ============\n',
            );
            expect(performance.now() - started).toBeLessThan(2_000);
            expect(result).toEqual(
                doc(
                    bullets(
                        listItem(
                            para(txt('Test output:'), ...passed.flat()),
                            para(txt('************')),
                            para(txt('============')),
                        ),
                    ),
                ),
            );
        });
    });

    // marked lexes a nested quote twice when lazy lines follow it, so a quote whose depth drops
    // one level per line took time exponential in its depth, and every level is a recursive call.
    // The deadline tests, under Bun, are in adf.test.ts.
    // When lines followed a list in a nested quote, marked spliced the list's raw, without its
    // quote markers, into the quote's raw, and the quote around it lexed that raw again with its
    // lazy lines: whole lines were lost and a list marker was repeated.
    describe('quoted lists followed by a shallower line', () => {
        it('should keep every line of a reply under a quoted list', () => {
            const reply = [
                '> > Steps:',
                '> > 1. Restart the service',
                '> > 2. Clear the cache',
                '> I did both, still failing.',
                'Any ideas?',
            ];
            // The reply lines continue the last item's paragraph lazily, as in CommonMark.
            expect(convert(reply.join('\n')).content).toEqual([
                quote(
                    para(txt('Steps:')),
                    ordered(
                        item(txt('Restart the service')),
                        item(
                            txt('Clear the cache'),
                            br,
                            txt('I did both, still failing.'),
                            br,
                            txt('Any ideas?'),
                        ),
                    ),
                ),
            ]);
            expect(convert('>>- a\n>>- b\n>c\nd').content).toEqual([
                quote(bullets(item(txt('a')), item(txt('b'), br, txt('c'), br, txt('d')))),
            ]);
        });

        it('should keep the line after an empty item that ends a quoted list', () => {
            expect(convert('>> -\n> thanks\nok').content).toEqual([
                quote(bullets(listItem(para())), para(txt('thanks'), br, txt('ok'))),
            ]);
        });
    });

    describe('quote depth (design D15)', () => {
        const ladder = (depth: number): string =>
            Array.from({ length: depth }, (_, k) => '>'.repeat(depth - k) + ' a').join('\n');
        const lines = (count: number, text: (k: number) => string): AdfNode[] =>
            Array.from({ length: count }, (_, k) => txt(text(k))).flatMap((node, k) =>
                k === 0 ? [node] : [br, node],
            );

        it('should read lines quoted more than ten deep as quoted ten deep', () => {
            // 22 levels took seconds; 9,000 overflowed the stack.
            expect(convert(ladder(22)).content).toEqual([quote(para(...lines(22, () => 'a')))]);
            expect(convert('>'.repeat(9_000) + ' a').content).toEqual([quote(para(txt('a')))]);
            expect(convert('> '.repeat(9_000) + 'a').content).toEqual([quote(para(txt('a')))]);
            expect(convert('>'.repeat(8_659)).content).toEqual([quote(para())]);
        });

        // The quote is lexed from the cut lines, but the lexer goes on after its source lines.
        it('should continue after a cut quote at the line that follows it', () => {
            expect(convert('>'.repeat(9_000) + ' a\n\nnext').content).toEqual([
                quote(para(txt('a'))),
                para(txt('next')),
            ]);
            expect(
                convert('>'.repeat(12) + ' a\n' + '>'.repeat(13) + ' b\n# next').content,
            ).toEqual([quote(para(txt('a')), para(txt('b'))), heading(1, txt('next'))]);
            expect(convert('>'.repeat(12) + ' a\n>\t\nlazy').content).toEqual([
                quote(para(txt('a'))),
                para(txt('lazy')),
            ]);
        });

        it('should keep the blocks that a line quoted deeper starts past the tenth level', () => {
            const ascending = Array.from({ length: 13 }, (_, k) => '>'.repeat(k + 1) + ` l${k}`);
            expect(convert(ascending.join('\n')).content).toEqual([
                quote(...Array.from({ length: 13 }, (_, k) => para(txt(`l${k}`)))),
            ]);
            expect(convert('>'.repeat(11) + ' a\n' + '>'.repeat(12) + '     code').content).toEqual(
                [quote(para(txt('a')), codeBlock('code'))],
            );
            // Not an underline of the line above it: the rule keeps its text.
            expect(convert('>'.repeat(11) + ' a\n' + '>'.repeat(12) + ' ---').content).toEqual([
                quote(para(txt('a')), para(txt('---'))),
            ]);
        });

        it('should keep a lazy = or - line past the tenth level apart from the paragraph', () => {
            // marked continues the paragraph with it; cut to the same depth it would underline
            // the paragraph and its text would be lost, so it starts a paragraph of its own.
            expect(convert('>'.repeat(12) + ' a\n' + '>'.repeat(11) + ' ===').content).toEqual([
                quote(para(txt('a')), para(txt('==='))),
            ]);
            // A lazy line of text still continues the paragraph after a hard break.
            expect(convert('>'.repeat(12) + ' a\n' + '>'.repeat(11) + ' b').content).toEqual([
                quote(para(txt('a'), br, txt('b'))),
            ]);
        });

        it('should keep the `>` characters that are the text of code, HTML or a definition', () => {
            const run = '>'.repeat(16);
            expect(convert('> ```\n> ' + run + ' literal\n> ```').content).toEqual([
                quote(codeBlock(run + ' literal')),
            ]);
            expect(convert('> - ```\n>   ' + run + ' x\n>   ```').content).toEqual([
                quote(bullets(listItem(codeBlock(run + ' x')))),
            ]);
            expect(convert('> <div>\n> ' + run + ' literal').content).toEqual([
                quote(para(txt('<div>'), br, txt(run + ' literal'))),
            ]);
            expect(convert("> [a]: /u '\n> " + run + " t'\n> [a]").content).toEqual([
                quote(para(txt('a', link('/u', '\n' + run + ' t')))),
            ]);
        });

        it('should keep quote markers that follow a list marker or indentation', () => {
            // A marker after spaces can belong to a list item at that level.
            expect(
                convert('>'.repeat(10) + ' - item\n' + '>'.repeat(10) + '   >>> nested').content,
            ).toEqual([quote(bullets(listItem(para(txt('item')), para(txt('nested')))))]);
        });

        it('should count quote markers that have spaces between them', () => {
            // marked reads `>>>>>>>>  >>` as ten deep where the cut counted eight, so the line
            // below joined its paragraph and the backslash became a hard break.
            expect(convert('>>>>>>>>  >>\\\n' + '>'.repeat(11) + 'a').content).toEqual([
                quote(para(txt('\\')), para(txt('a'))),
            ]);
            // Such a line is cut like any other; stopping the cut there made a 12-level thread
            // below it run out of quote work and come out as literal text.
            const replies = ['Looking.', 'Any news?', 'Not yet.', 'Ping.', 'Still on it.'];
            const thread = [
                '> '.repeat(11) + '>  > The build is failing again on main.',
                ...[...replies, ...replies].map((text, k) => '> '.repeat(11 - k) + text),
                'Thanks.',
            ];
            const content = convert(thread.join('\n')).content;
            expect(content).toHaveLength(1);
            expect(content[0].type).toBe('blockquote');
            expect(content[0].content?.[0].content?.[0]).toEqual(
                txt('The build is failing again on main.'),
            );
        });

        it('should cut a definition or an inline tag line that continues a paragraph', () => {
            // Neither can interrupt a paragraph, so neither opens a block whose `>` characters
            // could be text: left uncut, the line lost its text past the tenth level.
            expect(convert('>'.repeat(11) + 'a\n' + '>'.repeat(11) + '[b]: /c').content).toEqual([
                quote(para(txt('a'), br, txt('[b]: /c'))),
            ]);
            const html = ['a', '<br>', '**b**'].map(line => '>'.repeat(11) + line).join('\n');
            expect(convert(html).content).toEqual([
                quote(para(txt('a'), br, txt('<br>'), br, txt('b', strong))),
            ]);
        });

        it('should keep every line past the tenth level when a list ends a deeper quote', () => {
            // Cut to ten levels, these took the shape in which marked lost or repeated lines
            // (see 'quoted lists followed by a shallower line'). The structure can differ from
            // the uncut parse, but the text cannot.
            expect(convert('>'.repeat(11) + '-\n' + '>'.repeat(9) + 'z5\n8').content).toEqual([
                quote(bullets(listItem(para())), para(txt('z5'), br, txt('8'))),
            ]);
            const repeated = [
                '>'.repeat(11) + ' 1. i',
                '>'.repeat(11) + ' b',
                '>'.repeat(9) + ' t',
            ];
            expect(convert(repeated.join('\n') + '\nt').content).toEqual([
                quote(ordered(item(txt('i'), br, txt('b'), br, txt('t'), br, txt('t')))),
            ]);
            const thread = [
                '> '.repeat(11) + '- Bump the cache TTL.',
                '> '.repeat(9) + 'Why?',
                '> '.repeat(10) + 'Because of the latency spike.',
                'OK.',
            ];
            expect(convert(thread.join('\n')).content).toEqual([
                quote(
                    bullets(item(txt('Bump the cache TTL.'), br, txt('Why?'))),
                    para(txt('Because of the latency spike.'), br, txt('OK.')),
                ),
            ]);
        });

        it('should cut the lines above one that may open a code block alike every time', () => {
            // marked lexes a quote again with the lazy lines after it. The second time the quote
            // held the fence line, so nothing was cut, and a line the first lex counted was lost.
            const input = ['>'.repeat(12) + '4', '>5', '>'.repeat(11) + '- w6', '7', '>>```'];
            expect(convert(input.join('\n')).content).toEqual([
                quote(para(txt('4'), br, txt('5')), bullets(item(txt('w6'), br, txt('7')))),
                quote(codeBlock('')),
            ]);
        });

        it('should cut a quote holding a link, an autolink or a placeholder line', () => {
            // None of these can open a definition or an HTML block. Left uncut, a 12-level
            // thread ran out of quote work and came out as literal text.
            const replies = ['Looking.', 'Any news?', 'Not yet.', 'Ping.', 'Still on it.'];
            for (const first of [
                '[PROJ-1](https://jira.example.com/browse/PROJ-1) is failing again.',
                '<https://ci.example.com/build/42> is red.',
                '[cid:image001.png@01DA] Screenshot attached.',
                '[1] https://example.com/notes',
            ]) {
                const lines = [first, ...replies, ...replies, 'Done?'];
                const input = lines.map((text, k) => '> '.repeat(12 - k) + text).join('\n');
                const content = convert(input + '\nThanks.').content;
                expect(content).toHaveLength(1);
                expect(content[0].type).toBe('blockquote');
                expect(content[0].content).toHaveLength(1);
                expect(content[0].content?.[0].content?.at(-1)).toEqual(txt('Thanks.'));
            }
        });

        // Each level is a recursive call: deep nesting overflowed the stack, at a depth that
        // depends on the platform.
        it('should keep the text of quotes and lists nested more than 100 deep', () => {
            for (const input of [
                '- '.repeat(101) + 'a',
                '>  '.repeat(101) + 'a',
                '> - '.repeat(51) + 'a',
                '1. '.repeat(6_333),
            ]) {
                expect(convert(input).content).toEqual([para(txt(input))]);
            }
            // Too deep to check against the schema, which takes exponential time in the depth.
            const deep = markdownToAdf('- '.repeat(100) + 'a');
            let node = deep.content[0];
            for (let depth = 1; depth < 100; depth++) {
                node = node.content?.[0].content?.[0] as AdfNode;
            }
            expect(node).toEqual(bullets(item(txt('a'))));
            expect(adfProblems(deep)).toEqual([]);
        });

        it('should keep the text of quotes nested too deeply to lex', () => {
            // The first line may open a fenced code block, so no line is cut, and the work of
            // lexing the levels runs out: the text is kept as written.
            const input = [
                '>'.repeat(24) + ' ```',
                ...Array.from({ length: 23 }, (_, k) => '>'.repeat(23 - k) + ' a'),
            ];
            expect(convert(input.join('\n')).content).toEqual([para(...lines(24, k => input[k]))]);
        });

        // The quote rule runs on a growing prefix of the text, so that a quote ended at a bare
        // quote line does not cost the length of all the quote lines after it.
        it('should end a quote at a bare quote line that an unquoted line follows', () => {
            const long = Array.from({ length: 200 }, (_, k) => `> line ${k}`).join('\n');
            expect(convert(long + '\n>\t\nlazy').content).toEqual([
                quote(para(...lines(200, k => `line ${k}`))),
                para(txt('lazy')),
            ]);
            expect(convert(long + '\n>\nnot lazy').content).toEqual([
                quote(para(...lines(200, k => `line ${k}`))),
                para(txt('not lazy')),
            ]);
            expect(convert('>\t\nb\n'.repeat(300)).content).toEqual(
                Array.from({ length: 300 }).flatMap(() => [quote(para()), para(txt('b'))]),
            );
        });
    });

    describe('setext headings (design D6)', () => {
        it('should still read a setext heading inside a list item or a quote', () => {
            // The heading becomes a paragraph there (design D5); its underline is not kept.
            expect(convert('- Summary\n  ---\n  body').content).toEqual([
                bullets(listItem(para(txt('Summary')), para(txt('body')))),
            ]);
            expect(convert('1. Title\n   of it\n   ===').content).toEqual([
                ordered(item(txt('Title'), br, txt('of it'))),
            ]);
            expect(convert('> Summary\n> ---').content).toEqual([quote(para(txt('Summary')))]);
        });

        it('should not read an underline after a blank line as one', () => {
            expect(convert('- a\n\n  b\n\n  ---').content).toEqual([
                bullets(listItem(para(txt('a')), para(txt('b')), para(txt('---')))),
            ]);
        });
    });

    describe('input normalization (design D4)', () => {
        it('should keep U+2028 an ordinary character in a list item, a table row and a setext line', () => {
            const input =
                '- \u2028\n- a\u2028b\n\n| x\u2028 | y |\n|---|---|\n| \u2028 | z |\n\n' +
                'Set\u2028ext\n---\n\nKeep \uFDD0 and &#xFDD0;';
            expect(convert(input).content).toEqual([
                bullets(item(txt('\u2028')), item(txt('a\u2028b'))),
                table(
                    row(cell('tableHeader', txt('x\u2028')), cell('tableHeader', txt('y'))),
                    row(cell('tableCell', txt('\u2028')), cell('tableCell', txt('z'))),
                ),
                heading(2, txt('Set\u2028ext')),
                para(txt('Keep \uFDD0 and \uFDD0')),
            ]);
        });

        it('should keep U+2029 an ordinary character in a list item, a table row and a setext line', () => {
            const input =
                '- \u2029\n\n| x\u2029 | y |\n|---|---|\n| 1 | 2 |\n\n' +
                'Set\u2029ext\n---\n\n\uFDD0 &#xFDD0; &#64976;';
            expect(convert(input).content).toEqual([
                bullets(item(txt('\u2029'))),
                table(
                    row(cell('tableHeader', txt('x\u2029')), cell('tableHeader', txt('y'))),
                    row(cell('tableCell', txt('1')), cell('tableCell', txt('2'))),
                ),
                heading(2, txt('Set\u2029ext')),
                para(txt('\uFDD0 \uFDD0 \uFDD0')),
            ]);
        });

        it('should keep U+2028 and U+2029 in code, languages, link targets and titles', () => {
            expect(convert('```a\u2028b\nx\u2029y\n```').content).toEqual([
                codeBlock('x\u2029y', 'a\u2028b'),
            ]);
            expect(convert('[t](https://e.com/\u2028 "T\u2029")').content).toEqual([
                para(txt('t', link('https://e.com/\u2028', 'T\u2029'))),
            ]);
        });

        it('should pick sentinels that the input uses neither literally nor as a reference', () => {
            // U+FDD0 literally; U+FDD1 as a decimal, U+FDD2 as an upper-case hex with a leading
            // zero, and U+FDD3 as a lower-case hex reference. A sentinel among them would turn
            // that character into U+2028 or U+2029.
            const input = '\uFDD0 &#64977; &#X0FDD2; &#xfdd3; a\u2028b\u2029c';
            expect(convert(input).content).toEqual([
                para(txt('\uFDD0 \uFDD1 \uFDD2 \uFDD3 a\u2028b\u2029c')),
            ]);
        });

        it('should throw only when separators need sentinels and fewer than two are free', () => {
            const noncharacters = (count: number): string =>
                Array.from({ length: count }, (_, k) => String.fromCharCode(0xfdd0 + k)).join('');
            expect(() => markdownToAdf(noncharacters(31) + '\u2028')).toThrow(/U\+FDD0-U\+FDEF/);
            expect(() => markdownToAdf(noncharacters(32) + '\u2029')).toThrow(/U\+FDD0-U\+FDEF/);
            // Without U+2028 / U+2029 nothing is swapped, so no sentinel is needed.
            expect(convert(noncharacters(32)).content).toEqual([para(txt(noncharacters(32)))]);
            const thirty = noncharacters(30);
            expect(convert(thirty + '\u2028\u2029').content).toEqual([
                para(txt(thirty + '\u2028\u2029')),
            ]);
        });

        it('should never interpret \\n escape sequences', () => {
            expect(convert('first\\nsecond').content).toEqual([para(txt('first\\nsecond'))]);
        });
    });

    describe('ATX headings (design D3)', () => {
        it('should keep # followed by a non-breaking space as paragraph text', () => {
            expect(convert('#\u00A0x').content).toEqual([para(txt('#\u00A0x'))]);
        });

        it('should keep a trailing non-breaking space in heading text', () => {
            expect(convert('## Title\u00A0').content).toEqual([heading(2, txt('Title\u00A0'))]);
        });

        it('should keep a # that no space or tab precedes', () => {
            expect(convert('## C#').content).toEqual([heading(2, txt('C#'))]);
        });

        it('should strip a closing # sequence after a space', () => {
            expect(convert('### foo #').content).toEqual([heading(3, txt('foo'))]);
            expect(convert('## ##').content).toEqual([heading(2)]);
            expect(convert('# foo \\#').content).toEqual([heading(1, txt('foo #'))]);
        });

        it('should open a heading with a tab', () => {
            expect(convert('#\tTitle').content).toEqual([heading(1, txt('Title'))]);
        });
    });

    // The carriage-return references that keep their source text are tested in adf.test.ts.
    describe('character references (design D8)', () => {
        it('should decode other numeric references and keep named ones as typed', () => {
            expect(convert('a&#35;b &#x41; &amp; &#0;').content).toEqual([
                para(txt('a#b A &amp; \uFFFD')),
            ]);
            expect(convert('[x](https://example.com/?a=1&amp;b=2)').content).toEqual([
                para(txt('x', link('https://example.com/?a=1&amp;b=2'))),
            ]);
        });
    });

    describe('blocks', () => {
        it('should convert indented code without a language or a final line ending', () => {
            const [, block] = convert('Output:\n\n    a\n    b\n').content;
            expect(block).toEqual({ type: 'codeBlock', attrs: {}, content: [txt('a\nb')] });
        });

        // marked appends a line indented four or more past an item's text to that text as
        // indented code, with the line ending it keeps after such code: a blank line, which
        // gave two hard breaks before the next line until the `code` tokenizer dropped it.
        it('should continue an item with a deeper-indented line after one hard break', () => {
            expect(convert('- a\n      b\n  c').content).toEqual([
                bullets(item(txt('a'), br, txt('b'), br, txt('c'))),
            ]);
            expect(convert('- a\n  [b]: https://x.test\n      c\n  d').content).toEqual([
                bullets(
                    item(
                        txt('a'),
                        br,
                        txt('[b]: '),
                        txt('https://x.test', link('https://x.test')),
                        br,
                        txt('c'),
                        br,
                        txt('d'),
                    ),
                ),
            ]);
        });

        it('should give an empty code block no text node', () => {
            expect(convert('```\n```').content).toEqual([codeBlock('')]);
        });

        it('should keep a start number of 0', () => {
            expect(convert('0. zero\n1. one').content[0].attrs).toEqual({ order: 0 });
        });

        it('should keep an HTML block with a blank line as literal lines', () => {
            expect(convert('<!--\n\nnote\n-->').content).toEqual([
                para(txt('<!--'), br, br, txt('note'), br, txt('-->')),
            ]);
        });

        it('should flatten quotes inside list items', () => {
            expect(convert('- > a\n  >> b').content).toEqual([
                bullets(listItem(para(txt('a')), para(txt('b')))),
            ]);
            expect(convert('- a\n\n  > q\n  > - inner').content).toEqual([
                bullets(listItem(para(txt('a')), para(txt('q')), bullets(item(txt('inner'))))),
            ]);
        });

        it('should end a paragraph at a last line of only spaces', () => {
            expect(convert('a\n   ').content).toEqual([para(txt('a'))]);
            expect(convert('> a\n>   ').content).toEqual([quote(para(txt('a')))]);
            expect(convert('a\n\u00A0').content).toEqual([para(txt('a'), br, txt('\u00A0'))]);
        });

        // marked alone reads such a bare line as paragraph text and continues the paragraph
        // with the unquoted line after it.
        it('should end a quote at a bare quote line with spaces or a tab before an unquoted line', () => {
            for (const bare of ['>  ', '>\t', '> \t', '>   ']) {
                expect(convert(`> a\n${bare}\nb`).content, JSON.stringify(bare)).toEqual([
                    quote(para(txt('a'))),
                    para(txt('b')),
                ]);
            }
            expect(convert('>  \nb').content).toEqual([quote(para()), para(txt('b'))]);
            expect(convert('> > a\n> >  \nb').content).toEqual([
                quote(para(txt('a'))),
                para(txt('b')),
            ]);
            expect(convert('> - a\n>  \nb').content).toEqual([
                quote(bullets(item(txt('a')))),
                para(txt('b')),
            ]);
        });

        it('should keep a lazy line that follows quoted text in the quote', () => {
            expect(convert('> a\nb\n>\t\nc').content).toEqual([
                quote(para(txt('a'), br, txt('b'))),
                para(txt('c')),
            ]);
            expect(convert('> a\n>   \n> b').content).toEqual([
                quote(para(txt('a')), para(txt('b'))),
            ]);
        });

        // marked turns the tabs that indent a list item's lines into four spaces before it
        // removes the item's indentation, and code kept the spaces: a broken Makefile recipe.
        it('should keep the tabs that indent code in a list item', () => {
            expect(
                convert('1. Add:\n   ```make\n   build:\n   \tgo build ./...\n   ```').content,
            ).toEqual([
                ordered(listItem(para(txt('Add:')), codeBlock('build:\n\tgo build ./...', 'make'))),
            ]);
            expect(convert('- ```\n  if x {\n  \t\treturn\n  }\n  ```').content).toEqual([
                bullets(listItem(codeBlock('if x {\n\t\treturn\n}'))),
            ]);
            expect(convert('- a\n  ~~~\n  \tx\n  ~~~').content).toEqual([
                bullets(listItem(para(txt('a')), codeBlock('\tx'))),
            ]);
            // Indented code, and code in a nested list.
            expect(convert('- a\n\n      \tcode').content).toEqual([
                bullets(listItem(para(txt('a')), codeBlock('\tcode'))),
            ]);
            expect(convert('- outer\n  - inner\n    ```\n    \tcode\n    ```').content).toEqual([
                bullets(
                    listItem(
                        para(txt('outer')),
                        bullets(listItem(para(txt('inner')), codeBlock('\tcode'))),
                    ),
                ),
            ]);
            // Indented by a tab, the item keeps the tabs past its indentation.
            expect(convert('- item\n\t```\n\t\tcode\n\t```').content).toEqual([
                bullets(listItem(para(txt('item')), codeBlock('\tcode'))),
            ]);
            // In a quote, the tab after the quote marker was kept already, and so was a tab
            // after text.
            expect(convert('> - a\n>   ```\n>   \tb\n>   ```').content).toEqual([
                quote(bullets(listItem(para(txt('a')), codeBlock('\tb')))),
            ]);
            expect(convert('- a\n  ```\n  x\ty\n  ```').content).toEqual([
                bullets(listItem(para(txt('a')), codeBlock('x\ty'))),
            ]);
        });

        it("should keep marked's spaces for a tab it removed in part", () => {
            // The item takes two of the tab's four columns; the other two stay spaces.
            expect(convert('- a\n  ```\n\tlazy\n  ```').content).toEqual([
                bullets(listItem(para(txt('a')), codeBlock('  lazy'))),
            ]);
        });

        // marked's definition rule let the label, or a title in double quotes, span a blank line,
        // and the text after it was lost.
        it('should not read a link reference definition across a blank line', () => {
            expect(convert('[TODO: verify the numbers\n\nStatus]: open').content).toEqual([
                para(txt('[TODO: verify the numbers')),
                para(txt('Status]: open')),
            ]);
            expect(convert('[a]: /url "t\n\nu"').content).toEqual([
                para(txt('[a]: /url "t')),
                para(txt('u"')),
            ]);
            // A label or a title may still span lines without a blank one.
            expect(convert('[a\nb]: /url "t\nu"\n\n[a b]').content).toEqual([
                para(txt('a b', link('/url', 't\nu'))),
            ]);
        });
    });

    describe('task items (design D10)', () => {
        it('should read the checkbox of a loose list from its first paragraph', () => {
            expect(convert('- [x] done\n\n- [ ] open').content).toEqual([
                bullets(item(txt('\u2611 done')), item(txt('\u2610 open'))),
            ]);
        });

        it('should keep the list type of an ordered task list', () => {
            expect(convert('1. [x] done\n2. [ ] open').content).toEqual([
                ordered(item(txt('\u2611 done')), item(txt('\u2610 open'))),
            ]);
        });

        it('should put the ballot box before marked text in its own text node', () => {
            expect(convert('- [ ] **bold** task').content).toEqual([
                bullets(item(txt('\u2610 '), txt('bold', strong), txt(' task'))),
            ]);
        });

        it('should keep a checkbox without text literal', () => {
            expect(convert('- [ ]').content).toEqual([bullets(item(txt('[ ]')))]);
        });

        // marked removed the box from the last queued paragraph that starts with one, so a later
        // paragraph lost its box and the task item kept it.
        it("should remove the box from the task item's own first paragraph only", () => {
            expect(convert('- [x] Phase 1\n\n  [x] migrated the DB').content).toEqual([
                bullets(listItem(para(txt('\u2611 Phase 1')), para(txt('[x] migrated the DB')))),
            ]);
            expect(convert('- [ ] a\n\n  [ ] b').content).toEqual([
                bullets(listItem(para(txt('\u2610 a')), para(txt('[ ] b')))),
            ]);
            expect(convert('- [ ] a\n- b\n\n  [x] c').content).toEqual([
                bullets(item(txt('\u2610 a')), listItem(para(txt('b')), para(txt('[x] c')))),
            ]);
            expect(convert('1. [ ] a\n2. [x] b\n\n   [x] c').content).toEqual([
                ordered(item(txt('\u2610 a')), listItem(para(txt('\u2611 b')), para(txt('[x] c')))),
            ]);
            expect(convert('- [ ] Verify:\n  > [x] lint passed').content).toEqual([
                bullets(listItem(para(txt('\u2610 Verify:')), para(txt('[x] lint passed')))),
            ]);
            expect(convert('> - [ ] a\n>\n>   [ ] b').content).toEqual([
                quote(bullets(listItem(para(txt('\u2610 a')), para(txt('[ ] b'))))),
            ]);
            expect(convert('- [ ] a\n\n  # [x] h').content).toEqual([
                bullets(listItem(para(txt('\u2610 a')), para(txt('[x] h')))),
            ]);
        });

        it('should keep the boxes of nested task lists apart', () => {
            expect(convert('- [x] a\n\n  - [ ] b\n\n    [x] c').content).toEqual([
                bullets(
                    listItem(
                        para(txt('\u2611 a')),
                        bullets(listItem(para(txt('\u2610 b')), para(txt('[x] c')))),
                    ),
                ),
            ]);
            expect(convert('- [ ] a\n  - [x] b\n  - c\n\n    [ ] d').content).toEqual([
                bullets(
                    listItem(
                        para(txt('\u2610 a')),
                        bullets(
                            item(txt('\u2611 b')),
                            listItem(para(txt('c')), para(txt('[ ] d'))),
                        ),
                    ),
                ),
            ]);
        });

        it('should remove only the first of two boxes', () => {
            expect(convert('- [ ] [x] a').content).toEqual([bullets(item(txt('\u2610 [x] a')))]);
            expect(convert('- [ ] [x] a\n\n  b').content).toEqual([
                bullets(listItem(para(txt('\u2610 [x] a')), para(txt('b')))),
            ]);
        });
    });

    describe('inline content', () => {
        it('should link www hosts and e-mail addresses', () => {
            expect(convert('www.example.com and a@b.co').content).toEqual([
                para(
                    txt('www.example.com', link('http://www.example.com')),
                    txt(' and '),
                    txt('a@b.co', link('mailto:a@b.co')),
                ),
            ]);
        });

        it('should use the URL as the text of an image without alt text', () => {
            expect(convert('![](https://example.com/i.png)').content).toEqual([
                para(txt('https://example.com/i.png', link('https://example.com/i.png'))),
            ]);
        });

        it('should keep the outer link for an image inside a link', () => {
            expect(
                convert('[![badge](https://example.com/i.png)](https://example.com/t)').content,
            ).toEqual([para(txt('badge', link('https://example.com/t')))]);
        });

        it('should not add a mark type twice', () => {
            expect(convert('**a __b__ c**').content).toEqual([para(txt('a b c', strong))]);
        });

        it('should give equal marks however the markdown nests them', () => {
            const nodes = convert('***x*** _**y**_ **_z_**').content[0].content ?? [];
            expect(nodes.map(node => node.text)).toEqual(['x', ' ', 'y', ' ', 'z']);
            expect(nodes[2].marks).toEqual(nodes[0].marks);
            expect(nodes[4].marks).toEqual(nodes[0].marks);
        });

        it('should merge adjacent text with equal marks', () => {
            expect(convert('[a](https://e.com)[b](https://e.com)').content).toEqual([
                para(txt('ab', link('https://e.com'))),
            ]);
        });

        it('should resolve backslash escapes', () => {
            expect(convert('Use \\*args and \\[x\\]').content).toEqual([
                para(txt('Use *args and [x]')),
            ]);
        });

        it('should keep line breaks inside inline HTML as hard breaks', () => {
            expect(convert('x <span\nclass="a">y</span>').content).toEqual([
                para(txt('x <span'), br, txt('class="a">y</span>')),
            ]);
        });
    });

    describe('the marked instance (design D3)', () => {
        it("should leave marked's global options untouched", () => {
            markdownToAdf('a\nb');
            expect(marked.defaults.breaks).toBe(false);
            expect(marked.defaults.tokenizer).toBeNull();
            expect(marked.parse('a\nb', { async: false })).toBe('<p>a\nb</p>\n');
        });
    });
});

describe('inlineTextLength', () => {
    // Fragments that reach every alternative of marked's text rule.
    const FRAGMENTS = [
        ' ',
        ' ',
        '  ',
        '\n',
        '\t',
        'a',
        'Z',
        '9',
        'h',
        'H',
        't',
        'p',
        's',
        'f',
        'w',
        'www.',
        'http',
        'HTTPS://',
        'ftp://',
        'FTP:/',
        'mailto:',
        'xmpp:',
        '.',
        ':',
        '/',
        '@',
        '`',
        '``',
        '~',
        '~~',
        '*',
        '_',
        '\\',
        '<',
        '!',
        '[',
        ']',
        '#',
        '-',
        '&',
        '&#35;',
        '\u00E9',
        '\u00A0',
        '\uFDD0',
        '\uD83D\uDE00',
        '+',
        '{',
        '|',
        "'",
    ];

    it("should match marked's GFM breaks text rule", () => {
        const markedText = Lexer.rules.inline.breaks.text;
        let seed = 20_261_007;
        const random = (bound: number): number => {
            seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
            return (seed >>> 8) % bound;
        };
        const mismatches: string[] = [];
        for (let k = 0; k < 20_000; k++) {
            let src = '';
            const length = 1 + random(24);
            for (let j = 0; j < length; j++) src += FRAGMENTS[random(FRAGMENTS.length)];
            const expected = markedText.exec(src)?.[0].length ?? 0;
            const actual = inlineTextLength(src);
            if (actual !== expected)
                mismatches.push(`${JSON.stringify(src)}: ${actual} != ${expected}`);
        }
        expect(mismatches).toEqual([]);
    });

    it('should match nothing in an empty string', () => {
        expect(inlineTextLength('')).toBe(0);
    });
});

describe('mayHaveSetextUnderline', () => {
    // Lines that reach every part of marked's setext rule and of the check.
    const LINES = [
        'a',
        'b c',
        '---',
        '===',
        '-',
        '=',
        ' ---',
        '   ===',
        '    ---',
        '\t---',
        '--- ',
        '=== \t',
        '-=-',
        '- -',
        '- a',
        '* b',
        '1. c',
        '2) d',
        '+ e',
        '1234567890. f',
        '-\tg',
        '- ',
        '1. ',
        '> q',
        '   > q',
        '    > q',
        '>',
        '# h',
        '#',
        '#\th',
        '####### h',
        '    # h',
        '```',
        '````',
        '~~~',
        ' ``',
        '<div>',
        '[a]: u',
        '| a |',
        '|-|-|',
        '***',
        '    code',
        'x ---',
        '',
        ' ',
        '\t',
        '\u00A0',
        '\f',
        '- - -',
        '___',
        '_ _ _',
        '* * *',
        '---\t',
        '-\t-\t-',
        '  ***',
        '<a> b',
        '<div',
        '<br/>',
        '<!-- x -->',
        '|-|',
        '-|-',
        ':-:|',
        '| --- |',
        '    |-|',
        '|',
        '--',
        '==\t',
        '\u3000',
        '#\u00A0x',
    ];

    it("should hold wherever marked's setext rule matches", () => {
        const setext = Lexer.rules.block.gfm.lheading;
        let seed = 20_261_007;
        const random = (bound: number): number => {
            seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
            return (seed >>> 8) % bound;
        };
        const missed: string[] = [];
        for (let k = 0; k < 5_000; k++) {
            const lines = Array.from({ length: 1 + random(8) }, () => LINES[random(LINES.length)]);
            const src = lines.join('\n') + (random(3) === 0 ? '\n' : '');
            // Every suffix that starts a line, as marked's lexer passes them.
            for (let start = 0; start >= 0;) {
                const rest = src.slice(start);
                if (setext.test(rest) && !mayHaveSetextUnderline(rest)) {
                    missed.push(JSON.stringify(rest));
                }
                const newline = src.indexOf('\n', start);
                start = newline < 0 ? -1 : newline + 1;
            }
        }
        expect(missed).toEqual([]);
    });

    it('should be false without an underline before the first blank line', () => {
        expect(mayHaveSetextUnderline('a\nb\nc')).toBe(false);
        expect(mayHaveSetextUnderline('a\n\n---')).toBe(false);
        expect(mayHaveSetextUnderline('a\n \t\n===')).toBe(false);
        expect(mayHaveSetextUnderline('---')).toBe(false);
        // Nor before a line that starts a quote, a heading, a fence or a list item.
        expect(mayHaveSetextUnderline('a\n> q\n---')).toBe(false);
        expect(mayHaveSetextUnderline('a\n## h\n---')).toBe(false);
        expect(mayHaveSetextUnderline('a\n~~~\n---')).toBe(false);
        expect(mayHaveSetextUnderline('a\n2) b\n---')).toBe(false);
        expect(mayHaveSetextUnderline('a\n    > q\n---')).toBe(true);
        expect(mayHaveSetextUnderline('a\n---')).toBe(true);
        expect(mayHaveSetextUnderline('a\nb\n  === \n')).toBe(true);
    });

    // The rule scanned to such a line from every line of a list item above it.
    it('should be false before a thematic break, a tag line or a delimiter row', () => {
        for (const stop of [
            '***',
            '- - -',
            '___',
            '  * * *',
            '<div>',
            '|-|',
            ' :--|--:',
            '\u00A0',
        ]) {
            expect(mayHaveSetextUnderline(`a\nb\n${stop}\n---`), stop).toBe(false);
        }
        // A `---` line is an underline before it is a thematic break.
        expect(mayHaveSetextUnderline('a\nb\n---\n***')).toBe(true);
        // A tag or a delimiter row stops the rule only with a line after it.
        expect(mayHaveSetextUnderline('a\n<div> x\n---')).toBe(true);
        expect(mayHaveSetextUnderline('a\n|-| x\n---')).toBe(true);
    });
});
