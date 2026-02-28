// Atlassian Document Format (ADF) converters
// Shared between Jira and Confluence

import type { AdfDocument, AdfNode } from './adf-types.ts';

// Markdown to ADF conversion
export function textToAdf(text: string): AdfDocument {
    const lines = text.split('\n');
    const content: AdfNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Skip empty lines
        if (line.trim() === '') {
            i++;
            continue;
        }

        // Headings (## Heading)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            content.push({
                type: 'heading',
                attrs: { level },
                content: parseInlineMarkdown(headingMatch[2]),
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
            !/^#{1,6}\s+/.test(lines[i]) &&
            !/^[-*]\s+/.test(lines[i]) &&
            !/^\d+\.\s+/.test(lines[i])
        ) {
            paragraphLines.push(lines[i]);
            i++;
        }

        if (paragraphLines.length > 0) {
            const paragraphContent: AdfNode[] = [];
            paragraphLines.forEach((pLine, idx) => {
                paragraphContent.push(...parseInlineMarkdown(pLine));
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

    // Add remaining text
    if (lastIndex < text.length) {
        nodes.push({ type: 'text', text: text.slice(lastIndex) });
    }

    // If no matches, return the whole text as a single node
    if (nodes.length === 0) {
        nodes.push({ type: 'text', text });
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
