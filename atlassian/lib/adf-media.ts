// Media nodes in markdown (design D1, D4 and D8 of round-trip-adf-media).
//
// adfToText writes an embedded image as `![name](media:<uuid>)` and a file as
// `[name](media:<uuid>)`; textToAdf reads those references back as media nodes
// with default presentation. The markdown carries only the identity, so an
// update restores presentation from the document currently on the server:
// reconcileMedia matches media nodes by UUID and copies the stored attributes
// back. Everything here is pure, and nothing throws on untrusted ADF.

import type { AdfDocument } from './adf-types.ts';

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function attrsOf(node: Json): Json {
    return isRecord(node.attrs) ? node.attrs : {};
}

function childrenOf(node: Json): Json[] {
    return Array.isArray(node.content) ? node.content.filter(isRecord) : [];
}

// ---------------------------------------------------------------------------
// References

/**
 * A Media Services UUID, which both products use: Jira's `media.attrs.id` and
 * Confluence's attachment `fileId`. Matched ignoring case.
 */
export const MEDIA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MEDIA_SCHEME = 'media:';

/** Whether a URL is a `media:` URL, valid or not. */
export function isMediaUrl(url: string): boolean {
    return url.startsWith(MEDIA_SCHEME);
}

/** The UUID of a valid media reference (`media:` and a UUID), as written; otherwise undefined. */
export function mediaIdOf(url: string): string | undefined {
    if (!isMediaUrl(url)) return undefined;
    const id = url.slice(MEDIA_SCHEME.length);
    return MEDIA_UUID.test(id) ? id : undefined;
}

/** Whether a URL is a valid media reference. */
export function isMediaReference(url: string): boolean {
    return mediaIdOf(url) !== undefined;
}

/** The reference markdown writes for a media UUID. */
export function mediaUrl(id: string): string {
    return MEDIA_SCHEME + id;
}

/** Display names for media nodes without `alt`, from UUID to name (Confluence: `fileId` to title). */
export type MediaNames = ReadonlyMap<string, string>;

/**
 * The name markdown shows for a media node: its `alt` when not empty, else the
 * name `mediaNames` gives for its `id`, else empty.
 */
export function displayAlt(attrs: unknown, mediaNames?: MediaNames): string {
    if (!isRecord(attrs)) return '';
    if (typeof attrs.alt === 'string' && attrs.alt !== '') return attrs.alt;
    return typeof attrs.id === 'string' ? (mediaNames?.get(attrs.id) ?? '') : '';
}

/**
 * The plain text of a caption, as the image title shows it: its text, with
 * hard breaks and line endings as spaces, since a title is one line. Mentions,
 * emoji and other inline atoms count by their `text`.
 */
export function captionText(caption: unknown): string {
    if (!isRecord(caption)) return '';
    let text = '';
    for (const node of childrenOf(caption)) {
        if (typeof node.text === 'string') text += node.text;
        else if (node.type === 'hardBreak') text += ' ';
        else {
            const attrs = attrsOf(node);
            if (typeof attrs.text === 'string') text += attrs.text;
            else if (typeof attrs.shortName === 'string') text += attrs.shortName;
        }
    }
    return text.replace(/\r\n?|\n/g, ' ');
}

// ---------------------------------------------------------------------------
// Collecting media

/** A media node of a document, with the context reconcileMedia needs. */
export interface MediaEntry {
    /** The `media` or `mediaInline` node. */
    node: Json;
    /** What holds it: an image's `mediaSingle`, file cards' `mediaGroup`, or the `mediaInline` itself. */
    container: 'mediaSingle' | 'mediaGroup' | 'mediaInline';
    /** The `mediaSingle` around an image. */
    parent?: Json;
    /** That `mediaSingle`'s `caption`, when it has one. */
    caption?: Json;
}

/**
 * Every media node of a document, in document order: the first `media` of each
 * `mediaSingle` (with that node and its `caption`), each `media` of a
 * `mediaGroup`, and each `mediaInline`. Anything that is not an object is
 * skipped, and so is a node met twice.
 */
export function collectMedia(doc: unknown): MediaEntry[] {
    const entries: MediaEntry[] = [];
    const seen = new Set<Json>();
    const stack: Json[] = isRecord(doc) ? [doc] : [];
    while (stack.length > 0) {
        const node = stack.pop() as Json;
        if (seen.has(node)) continue;
        seen.add(node);
        const children = childrenOf(node);
        if (node.type === 'mediaSingle') {
            const media = children.find(child => child.type === 'media');
            if (media) {
                const caption = children.find(child => child.type === 'caption');
                entries.push({ node: media, container: 'mediaSingle', parent: node, caption });
            }
        } else if (node.type === 'mediaGroup') {
            for (const media of children) {
                if (media.type === 'media') entries.push({ node: media, container: 'mediaGroup' });
            }
        } else if (node.type === 'mediaInline') {
            entries.push({ node, container: 'mediaInline' });
        } else {
            for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
        }
    }
    return entries;
}

/** A media node's `id`, when it is a string that is not empty. */
function idOf(node: Json): string | undefined {
    const id = attrsOf(node).id;
    return typeof id === 'string' && id !== '' ? id : undefined;
}

/**
 * Whether a document has a media node that a name lookup could name: one with
 * a UUID `id` and no `alt` (or an empty one). Confluence stores its media this
 * way, so `af confluence get` and `update` fetch the page's attachments only
 * when this holds (design D6).
 */
export function hasMediaWithoutAlt(doc: unknown): boolean {
    return collectMedia(doc).some(({ node }) => {
        const { id, alt } = attrsOf(node);
        return typeof id === 'string' && MEDIA_UUID.test(id) && !(typeof alt === 'string' && alt);
    });
}

// ---------------------------------------------------------------------------
// Reconciliation

/** A media node of the current document that the new one no longer has. */
export interface RemovedMedia {
    id: string;
    /** The name adfToText shows for it; empty when it has none. */
    name: string;
    /** `image` for a `mediaSingle`; `file` for a `mediaGroup` entry or a `mediaInline`. */
    kind: 'image' | 'file';
}

export interface ReconciledMedia {
    /** The new document, with presentation restored. */
    doc: AdfDocument;
    /** The current document's media that the new one does not reference, in document order. */
    removed: RemovedMedia[];
    /** The UUIDs of the new document's media that the current one does not have. */
    unknown: string[];
}

// The attributes the ADF schema allows on each node type. Anything else in a
// stored node, such as the `__fileName`, `__fileSize` and `__fileMimeType`
// that Confluence sometimes returns right after a save, is not copied.
const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
    media: new Set([
        'type',
        'id',
        'collection',
        'alt',
        'width',
        'height',
        'occurrenceKey',
        'localId',
    ]),
    mediaInline: new Set([
        'type',
        'id',
        'collection',
        'alt',
        'width',
        'height',
        'occurrenceKey',
        'localId',
        'data',
    ]),
    mediaSingle: new Set(['layout', 'width', 'widthType', 'localId']),
};
// The `type` values each node type allows (a `mediaInline` may also have none).
const ALLOWED_TYPES: Record<string, ReadonlySet<unknown>> = {
    media: new Set(['file', 'link']),
    mediaInline: new Set(['file', 'link', 'image', undefined]),
};

function clone<T>(value: T): T {
    return structuredClone(value);
}

/** `attrs` limited to the keys a node type allows, each value copied. */
function allowedAttrs(attrs: Json, type: string): Json {
    const allowed = ALLOWED_ATTRS[type] ?? new Set<string>();
    const out: Json = {};
    for (const [key, value] of Object.entries(attrs)) {
        if (allowed.has(key)) out[key] = clone(value);
    }
    return out;
}

/** Gives `target` a copy of `source`'s marks, or none when `source` has none. */
function copyMarks(target: Json, source: Json): void {
    if (Array.isArray(source.marks) && source.marks.length > 0) target.marks = clone(source.marks);
    else delete target.marks;
}

/**
 * Restores a matched media node of the new document from the current one
 * (design D4): attributes, the alt rule, marks, and for an image that stayed an
 * image, the `mediaSingle`'s attributes and the caption rule.
 */
function restore(entry: MediaEntry, indexed: MediaEntry, mediaNames?: MediaNames): void {
    const target = entry.node;
    const type = String(target.type);
    const own = attrsOf(target);
    const stored = attrsOf(indexed.node);
    const attrs = allowedAttrs(stored, type);
    // A node keeps what its type requires when the stored one lacks it or has a
    // value its type does not allow, as for a `mediaInline` of type `image`
    // that became an image (`media`).
    if (!(ALLOWED_TYPES[type]?.has(attrs.type) ?? true)) {
        if (own.type === undefined) delete attrs.type;
        else attrs.type = own.type;
    }
    if (typeof attrs.collection !== 'string') attrs.collection = own.collection;
    attrs.id = own.id;
    // The alt rule: an alt equal to the name the current node shows keeps the
    // stored alt exactly, an absent one included. So a Confluence image named by
    // its attachment never gains an `alt`.
    const alt = typeof own.alt === 'string' ? own.alt : '';
    if (alt !== displayAlt(stored, mediaNames)) {
        if (alt === '') delete attrs.alt;
        else attrs.alt = alt;
    }
    target.attrs = attrs;
    copyMarks(target, indexed.node);

    if (!entry.parent || !indexed.parent) return;
    const parentAttrs = allowedAttrs(attrsOf(indexed.parent), 'mediaSingle');
    if (typeof parentAttrs.layout !== 'string') parentAttrs.layout = attrsOf(entry.parent).layout;
    entry.parent.attrs = parentAttrs;
    copyMarks(entry.parent, indexed.parent);
    // The caption rule: an unchanged caption text reuses the stored caption,
    // marks included; a changed one stays the plain text the markdown gave.
    if (
        entry.caption &&
        indexed.caption &&
        captionText(entry.caption) === captionText(indexed.caption)
    ) {
        const content = entry.parent.content as Json[];
        content[content.indexOf(entry.caption)] = clone(indexed.caption);
    }
}

/**
 * Restores media presentation in `next`, a document built from markdown, from
 * `current`, the document stored on the server (design D4).
 *
 * Every media node of `current` (`media` in a `mediaSingle` or `mediaGroup`,
 * and `mediaInline`) is indexed by `attrs.id`, the first occurrence winning,
 * with its `mediaSingle` and caption. Each media node of `next` whose `id` is
 * indexed gets the stored attributes, limited to those its type allows, and
 * the stored marks. Its alt text is kept as stored when the markdown's equals
 * the name the stored node shows (`displayAlt`), and otherwise becomes the
 * markdown's, or is removed when that is empty. When both are images, the
 * `mediaSingle` gets the stored attributes and marks, and an unchanged caption
 * text gets the stored caption back. Media of `next` that `current` lacks keep
 * the defaults textToAdf gave them and are listed in `unknown`; media of
 * `current` that `next` lacks are listed in `removed`. Neither input is
 * changed, malformed nodes are left as they are, and nothing throws on them.
 *
 * Verified on scratch content on 2026-11-12 (design Open Questions):
 * - both products accept the defaults (`mediaSingle { layout: "center" }`,
 *   `collection: ""`) for a UUID that is new to the document. Confluence
 *   resolves `""` to `contentId-<page-id>` and adds pixel sizes;
 * - both store attributes copied back unchanged, Jira's `align-start` /
 *   `width: 694` / `widthType: "pixel"` image with a bold caption included;
 * - removing an embed through the API leaves the attachment in place;
 * - duplicates sharing an `occurrenceKey` are accepted, and both products drop
 *   `occurrenceKey` on store, so it is copied to every occurrence;
 * - Jira rejects (400) any media that is not an attachment of the issue itself,
 *   while Confluence renders a node copied from another page. So UUIDs that are
 *   not found are listed, never warned about.
 */
export function reconcileMedia(
    next: AdfDocument,
    current: unknown,
    mediaNames?: MediaNames,
): ReconciledMedia {
    const doc = clone(next);
    const index = new Map<string, MediaEntry>();
    for (const entry of collectMedia(current)) {
        const id = idOf(entry.node);
        if (id !== undefined && !index.has(id)) index.set(id, entry);
    }

    const referenced = new Set<string>();
    const unknown: string[] = [];
    for (const entry of collectMedia(doc)) {
        const id = idOf(entry.node);
        if (id === undefined) continue;
        referenced.add(id);
        const indexed = index.get(id);
        if (indexed) restore(entry, indexed, mediaNames);
        else if (!unknown.includes(id)) unknown.push(id);
    }

    const removed: RemovedMedia[] = [];
    for (const [id, entry] of index) {
        if (referenced.has(id)) continue;
        removed.push({
            id,
            name: displayAlt(entry.node.attrs, mediaNames),
            kind: entry.container === 'mediaSingle' ? 'image' : 'file',
        });
    }
    return { doc, removed, unknown };
}

// ---------------------------------------------------------------------------
// The removed-media warning (design D7)

/** `count` and a noun, plural unless the count is 1. */
function counted(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * The warning printed on standard error after an update that removed media,
 * such as `Warning: this update removed 1 embedded image from MR-4:
 * image-20251217-080021.png. The attachment is still on the issue.` Images
 * and files are counted apart, a name that is not known reads `media <uuid>`,
 * and a Confluence page is named `page <id>`. Removing an embed leaves its
 * attachment in place on both products (spike, 2026-11-12). Returns `''` when
 * nothing was removed.
 */
export function formatRemovedMediaWarning(
    removed: readonly RemovedMedia[],
    target: { kind: 'issue' | 'page'; key: string },
): string {
    if (removed.length === 0) return '';
    const images = removed.filter(media => media.kind === 'image').length;
    const files = removed.length - images;
    const what = [
        images > 0 ? counted(images, 'embedded image') : '',
        files > 0 ? counted(files, 'embedded file') : '',
    ]
        .filter(part => part !== '')
        .join(' and ');
    const names = removed.map(media => media.name || `media ${media.id}`).join(', ');
    const from = target.kind === 'page' ? `page ${target.key}` : target.key;
    const still = removed.length === 1 ? 'The attachment is' : 'The attachments are';
    return `Warning: this update removed ${what} from ${from}: ${names}. ${still} still on the ${target.kind}.`;
}
