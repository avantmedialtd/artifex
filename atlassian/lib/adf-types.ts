// Atlassian Document Format (ADF) types
// Shared between Jira and Confluence

export interface AdfDocument {
    type: 'doc';
    version: 1;
    content: AdfNode[];
}

export interface AdfMark {
    type: string;
    attrs?: Record<string, unknown>;
}

export interface AdfNode {
    type: string;
    content?: AdfNode[];
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: AdfMark[];
}

// Media nodes, as the ADF schema defines them. The attribute types are type
// aliases, not interfaces, so that they stay assignable to `AdfNode['attrs']`.

/** Where an embedded image sits. */
export type MediaSingleLayout =
    'wide' | 'full-width' | 'center' | 'wrap-right' | 'wrap-left' | 'align-end' | 'align-start';

/**
 * A `mediaSingle`'s attributes. `width` is a percentage (0 to 100) unless
 * `widthType` is `pixel`, which needs a `width`.
 */
export type AdfMediaSingleAttrs = {
    layout: MediaSingleLayout;
    width?: number;
    widthType?: 'percentage' | 'pixel';
    localId?: string;
};

/** An embedded image: one `media`, optionally followed by its `caption`. */
export interface AdfMediaSingle extends AdfNode {
    type: 'mediaSingle';
    attrs: AdfMediaSingleAttrs;
    content: AdfNode[];
}

/**
 * A file `media`: an attachment, named by its Media Services UUID. Jira's
 * `collection` is `""`; Confluence's is `contentId-<page-id>`.
 */
export type AdfMediaFileAttrs = {
    type: 'file' | 'link';
    id: string;
    collection: string;
    alt?: string;
    width?: number;
    height?: number;
    occurrenceKey?: string;
    localId?: string;
};

/** An external `media`: an image by URL. */
export type AdfMediaExternalAttrs = {
    type: 'external';
    url: string;
    alt?: string;
    width?: number;
    height?: number;
    localId?: string;
};

/** A file or image, inside a `mediaSingle` or a `mediaGroup`. */
export interface AdfMedia extends AdfNode {
    type: 'media';
    attrs: AdfMediaFileAttrs | AdfMediaExternalAttrs;
}

/** File cards: one or more `media` nodes. */
export interface AdfMediaGroup extends AdfNode {
    type: 'mediaGroup';
    content: AdfNode[];
}

/** A `mediaInline`'s attributes; unlike a `media`, its `type` is optional. */
export type AdfMediaInlineAttrs = {
    id: string;
    collection: string;
    type?: 'file' | 'link' | 'image';
    alt?: string;
    width?: number;
    height?: number;
    occurrenceKey?: string;
    localId?: string;
    data?: unknown;
};

/** A file chip inside a sentence. */
export interface AdfMediaInline extends AdfNode {
    type: 'mediaInline';
    attrs: AdfMediaInlineAttrs;
}

/** An image's caption: inline content, after the `media` in a `mediaSingle`. */
export interface AdfCaption extends AdfNode {
    type: 'caption';
    attrs?: { localId?: string };
}
