// Atlassian Document Format (ADF) converters, shared by Jira and Confluence.
//
// This module is the facade every caller imports. The work happens in two modules:
// - markdown-to-adf.ts maps marked's GitHub-flavored markdown tokens to ADF;
// - adf-to-markdown.ts renders ADF as the canonical markdown the mapper reads back.

import type { AdfDocument } from './adf-types.ts';
import { adfToMarkdown } from './adf-to-markdown.ts';
import { markdownToAdf } from './markdown-to-adf.ts';

/** Converts markdown to an ADF document. */
export function textToAdf(text: string): AdfDocument {
    return markdownToAdf(text);
}

/**
 * Renders an ADF document as markdown. A string is returned unchanged, `null` or
 * `undefined` gives an empty string, and malformed ADF never throws.
 */
export function adfToText(adf: AdfDocument | string | null | undefined): string {
    return adfToMarkdown(adf);
}
