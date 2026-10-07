// Atlassian Document Format (ADF) converters
// Shared between Jira and Confluence

import type { AdfDocument, AdfNode } from './adf-types.ts';

// Normalize CommonMark line endings (CRLF and lone CR become LF) and drop one
// leading byte-order mark. Every other character, including U+2028 and U+2029,
// is kept: CommonMark does not treat those as line endings.
function normalizeMarkdownInput(text: string): string {
    return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

// CommonMark ATX heading: 1-6 `#` followed by a space, a tab or the end of the
// line. The heading branch and the paragraph guard both use this predicate, so
// they cannot disagree about a line and leave it unconsumed. The text drops
// surrounding spaces and tabs only (not trim()), so U+2028 and U+2029 survive.
// It is stripped with an index scan, because a trailing `[ \t]+$` regex
// backtracks quadratically on a long run of spaces inside the text.
function matchAtxHeading(line: string): { level: number; text: string } | null {
    const opening = line.match(/^(#{1,6})(?=[ \t]|$)/);
    if (!opening) return null;
    const isSpaceOrTab = (char: string) => char === ' ' || char === '\t';
    let start = opening[1].length;
    let end = line.length;
    while (start < end && isSpaceOrTab(line[start])) start++;
    while (end > start && isSpaceOrTab(line[end - 1])) end--;
    return { level: opening[1].length, text: line.slice(start, end) };
}

// Appends nodes one at a time. Spreading a very long array into push() can
// exceed the engine's argument limit and throw a RangeError.
function appendAll(target: AdfNode[], nodes: AdfNode[]): void {
    for (const node of nodes) target.push(node);
}

// Markdown to ADF conversion
export function textToAdf(text: string): AdfDocument {
    const lines = normalizeMarkdownInput(text).split('\n');
    const content: AdfNode[] = [];
    let i = 0;
    let previousStart = -1;

    while (i < lines.length) {
        // Unreachable while the heading branch and paragraph guard share matchAtxHeading.
        if (i === previousStart) {
            throw new Error(`textToAdf: no block consumed line ${i + 1} (converter bug)`);
        }
        previousStart = i;
        const line = lines[i];

        // Skip empty lines
        if (line.trim() === '') {
            i++;
            continue;
        }

        // Fenced code block (```lang ... ```). Must run before list/heading
        // checks so that body lines starting with `-`, `*`, `#`, or `1.` are
        // preserved verbatim instead of being interpreted as other blocks.
        const fenceOpen = line.match(/^```(\w*)\s*$/);
        if (fenceOpen) {
            const language = fenceOpen[1];
            const bodyLines: string[] = [];
            i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) {
                bodyLines.push(lines[i]);
                i++;
            }
            // Consume the closing fence if present; otherwise we're at EOF.
            if (i < lines.length) i++;
            const body = bodyLines.join('\n');
            content.push({
                type: 'codeBlock',
                attrs: language ? { language } : {},
                content: body.length > 0 ? [{ type: 'text', text: body }] : [],
            });
            continue;
        }

        // Blockquote (> text). Consecutive quoted lines with text collapse into
        // one paragraph whose line breaks become hardBreaks. A bare `>` line ends
        // the current paragraph, as in CommonMark; runs of bare lines and bare
        // lines at either end add no paragraph.
        if (/^>\s?/.test(line)) {
            const paragraphs: AdfNode[] = [];
            let quoteLines: string[] = [];
            const closeParagraph = () => {
                if (quoteLines.length === 0) return;
                const paragraphContent: AdfNode[] = [];
                quoteLines.forEach((qLine, idx) => {
                    appendAll(paragraphContent, parseInlineMarkdown(qLine));
                    if (idx < quoteLines.length - 1) {
                        paragraphContent.push({ type: 'hardBreak' });
                    }
                });
                paragraphs.push({ type: 'paragraph', content: paragraphContent });
                quoteLines = [];
            };
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                if (/^>\s*$/.test(lines[i])) {
                    closeParagraph();
                } else {
                    quoteLines.push(lines[i].replace(/^>\s?/, ''));
                }
                i++;
            }
            closeParagraph();
            content.push({
                type: 'blockquote',
                // ADF requires at least one child, so a quote of only bare lines
                // keeps one empty paragraph.
                content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph', content: [] }],
            });
            continue;
        }

        // Horizontal rule (--- or ***)
        if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
            content.push({ type: 'rule' });
            i++;
            continue;
        }

        // Headings (## Heading)
        const heading = matchAtxHeading(line);
        if (heading) {
            content.push({
                type: 'heading',
                attrs: { level: heading.level },
                content: parseInlineMarkdown(heading.text),
            });
            i++;
            continue;
        }

        // Unordered list (- item or * item)
        if (/^[-*]\s+/.test(line)) {
            const listItems: AdfNode[] = [];
            while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
                const itemText = lines[i].replace(/^[-*]\s+/, '');
                listItems.push({
                    type: 'listItem',
                    content: [
                        {
                            type: 'paragraph',
                            content: parseInlineMarkdown(itemText),
                        },
                    ],
                });
                i++;
            }
            content.push({
                type: 'bulletList',
                content: listItems,
            });
            continue;
        }

        // Ordered list (1. item)
        if (/^\d+\.\s+/.test(line)) {
            const listItems: AdfNode[] = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                const itemText = lines[i].replace(/^\d+\.\s+/, '');
                listItems.push({
                    type: 'listItem',
                    content: [
                        {
                            type: 'paragraph',
                            content: parseInlineMarkdown(itemText),
                        },
                    ],
                });
                i++;
            }
            content.push({
                type: 'orderedList',
                content: listItems,
            });
            continue;
        }

        // Regular paragraph - collect consecutive non-empty, non-special lines
        const paragraphLines: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            matchAtxHeading(lines[i]) === null &&
            !/^[-*]\s+/.test(lines[i]) &&
            !/^\d+\.\s+/.test(lines[i])
        ) {
            paragraphLines.push(lines[i]);
            i++;
        }

        if (paragraphLines.length > 0) {
            const paragraphContent: AdfNode[] = [];
            paragraphLines.forEach((pLine, idx) => {
                appendAll(paragraphContent, parseInlineMarkdown(pLine));
                if (idx < paragraphLines.length - 1) {
                    paragraphContent.push({ type: 'hardBreak' });
                }
            });
            content.push({
                type: 'paragraph',
                content: paragraphContent,
            });
        }
    }

    return {
        type: 'doc',
        version: 1,
        content,
    };
}

// Parse inline markdown (bold, italic, code, links)
export function parseInlineMarkdown(text: string): AdfNode[] {
    const nodes: AdfNode[] = [];
    // Regex to match **bold**, *italic*, `code`, and [text](url)
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) });
        }

        if (match[2]) {
            // Bold **text**
            nodes.push({
                type: 'text',
                text: match[2],
                marks: [{ type: 'strong' }],
            });
        } else if (match[3]) {
            // Italic *text*
            nodes.push({
                type: 'text',
                text: match[3],
                marks: [{ type: 'em' }],
            });
        } else if (match[4]) {
            // Code `text`
            nodes.push({
                type: 'text',
                text: match[4],
                marks: [{ type: 'code' }],
            });
        } else if (match[5] && match[6]) {
            // Link [text](url)
            nodes.push({
                type: 'text',
                text: match[5],
                marks: [{ type: 'link', attrs: { href: match[6] } }],
            });
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text. Empty input yields no nodes, since ADF forbids empty
    // text nodes; the caller's block then gets `content: []`.
    if (lastIndex < text.length) {
        nodes.push({ type: 'text', text: text.slice(lastIndex) });
    }

    return nodes;
}

// ADF to markdown conversion
export function adfToText(adf: AdfDocument | string | null | undefined): string {
    if (!adf) return '';
    if (typeof adf === 'string') return adf;

    interface AdfBlockNode {
        type: string;
        content?: AdfBlockNode[];
        text?: string;
        attrs?: Record<string, unknown>;
        marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
    }

    function convertInlineNode(node: AdfBlockNode): string {
        if (node.type === 'text' && node.text) {
            let text = node.text;
            // Apply marks in reverse order for proper nesting
            if (node.marks) {
                for (const mark of node.marks) {
                    if (mark.type === 'strong') {
                        text = `**${text}**`;
                    } else if (mark.type === 'em') {
                        text = `*${text}*`;
                    } else if (mark.type === 'code') {
                        text = `\`${text}\``;
                    } else if (mark.type === 'link' && mark.attrs?.href) {
                        text = `[${text}](${mark.attrs.href})`;
                    }
                }
            }
            return text;
        }
        if (node.type === 'hardBreak') {
            return '\n';
        }
        if (node.content) {
            return node.content.map(convertInlineNode).join('');
        }
        return '';
    }

    function convertBlock(node: AdfBlockNode, listPrefix = ''): string {
        switch (node.type) {
            case 'heading': {
                const level = (node.attrs?.level as number) ?? 1;
                const prefix = '#'.repeat(level);
                const text = node.content?.map(convertInlineNode).join('') ?? '';
                return `${prefix} ${text}`;
            }

            case 'paragraph': {
                const text = node.content?.map(convertInlineNode).join('') ?? '';
                return listPrefix ? `${listPrefix}${text}` : text;
            }

            case 'bulletList': {
                return node.content?.map(item => convertBlock(item, '- ')).join('\n') ?? '';
            }

            case 'orderedList': {
                return (
                    node.content
                        ?.map((item, idx) => convertBlock(item, `${idx + 1}. `))
                        .join('\n') ?? ''
                );
            }

            case 'listItem': {
                // List items contain paragraphs or other blocks
                return (
                    node.content
                        ?.map((child, idx) => convertBlock(child, idx === 0 ? listPrefix : '   '))
                        .join('\n') ?? ''
                );
            }

            case 'codeBlock': {
                const lang = (node.attrs?.language as string) ?? '';
                const code = node.content?.map(convertInlineNode).join('') ?? '';
                return `\`\`\`${lang}\n${code}\n\`\`\``;
            }

            case 'blockquote': {
                const text = node.content?.map(n => convertBlock(n)).join('\n') ?? '';
                return text
                    .split('\n')
                    .map(line => `> ${line}`)
                    .join('\n');
            }

            case 'rule': {
                return '---';
            }

            default: {
                // Fallback: try to extract text content
                if (node.content) {
                    return node.content.map(n => convertBlock(n)).join('\n');
                }
                return '';
            }
        }
    }

    return adf.content.map(block => convertBlock(block as AdfBlockNode)).join('\n\n');
}
