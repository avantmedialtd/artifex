import { describe, it, expect } from 'vitest';
import { textToAdf, adfToText, parseInlineMarkdown } from './adf.ts';

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
    });
});
