// Atlassian Document Format (ADF) converters, shared by Jira and Confluence.
//
// This module is the facade every caller imports. The work happens in three modules:
// - markdown-to-adf.ts maps marked's GitHub-flavored markdown tokens to ADF;
// - adf-to-markdown.ts renders ADF as the canonical markdown the mapper reads back;
// - adf-media.ts holds the `media:` references both share, and reconcileMedia, which
//   restores media presentation from the stored document on an update.

import type { AdfDocument } from './adf-types.ts';
import { reconcileMedia, type MediaNames, type ReconciledMedia } from './adf-media.ts';
import { adfToMarkdown } from './adf-to-markdown.ts';
import { markdownToAdf } from './markdown-to-adf.ts';

/** Converts markdown to an ADF document. */
export function textToAdf(text: string): AdfDocument {
    return markdownToAdf(text);
}

export interface AdfToTextOptions {
    /**
     * Names for media nodes without `alt`, by UUID: Confluence's attachment
     * `fileId` to its title. Without one, such a node renders `![](media:<uuid>)`.
     */
    mediaNames?: MediaNames;
}

/**
 * Renders an ADF document as markdown. A string is returned unchanged, `null` or
 * `undefined` gives an empty string, and malformed ADF never throws. Media nodes
 * render as `media:` references.
 */
export function adfToText(
    adf: AdfDocument | string | null | undefined,
    options?: AdfToTextOptions,
): string {
    return adfToMarkdown(adf, { mediaNames: options?.mediaNames });
}

/**
 * Converts markdown to the ADF document an update sends: `textToAdf(markdown)`,
 * with the presentation of every media node that `current` (the document on
 * the server) has restored by UUID (design D4). Also returns the media that
 * the markdown no longer references (`removed`), and the UUIDs `current` does
 * not have (`unknown`). `current` may be null or malformed; then nothing is
 * restored.
 */
export function textToAdfKeepingMedia(
    markdown: string,
    current: unknown,
    mediaNames?: MediaNames,
): ReconciledMedia {
    return reconcileMedia(markdownToAdf(markdown), current, mediaNames);
}
