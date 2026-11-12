import { describe, expect, it } from 'vitest';
import {
    captionText,
    collectMedia,
    displayAlt,
    formatRemovedMediaWarning,
    isMediaReference,
    isMediaUrl,
    mediaIdOf,
    reconcileMedia,
} from './adf-media.ts';
import type { AdfDocument, AdfNode } from './adf-types.ts';

// reconcileMedia is tested here on hand-built documents: `next` has the shape
// textToAdf gives a media reference (design D3), and `current` the shapes Jira
// and Confluence store (design Context). The same scenarios through the
// converters are in adf.media-roundtrip.test.ts.

const MR4 = '0ab844aa-b95b-46bd-9d6c-a7d69ac7b901';
const DIAGRAM = '7f1e2d3c-4b5a-4968-8776-655443322110';
const OTHER = '11111111-2222-3333-4444-555555555555';

const doc = (...content: AdfNode[]): AdfDocument => ({ type: 'doc', version: 1, content });
const text = (value: string, ...marks: string[]): AdfNode =>
    marks.length > 0
        ? { type: 'text', text: value, marks: marks.map(type => ({ type })) }
        : { type: 'text', text: value };
const p = (...content: (AdfNode | string)[]): AdfNode => ({
    type: 'paragraph',
    content: content.map(node => (typeof node === 'string' ? text(node) : node)),
});
const caption = (...content: AdfNode[]): AdfNode => ({ type: 'caption', content });
const media = (attrs: Record<string, unknown>): AdfNode => ({ type: 'media', attrs });
const single = (attrs: Record<string, unknown>, ...content: AdfNode[]): AdfNode => ({
    type: 'mediaSingle',
    attrs,
    content,
});
const group = (...content: AdfNode[]): AdfNode => ({ type: 'mediaGroup', content });
const inline = (attrs: Record<string, unknown>): AdfNode => ({ type: 'mediaInline', attrs });

/** What textToAdf gives `![alt](media:<id> "title")` on its own line. */
function defaultImage(id: string, alt?: string, title?: string): AdfNode {
    const attrs: Record<string, unknown> = { type: 'file', id, collection: '' };
    if (alt) attrs.alt = alt;
    const content = [media(attrs)];
    if (title) content.push(caption(text(title)));
    return single({ layout: 'center' }, ...content);
}

/** What textToAdf gives `[alt](media:<id>)` inside a sentence. */
function defaultInline(id: string, alt?: string): AdfNode {
    const attrs: Record<string, unknown> = { type: 'file', id, collection: '' };
    if (alt) attrs.alt = alt;
    return inline(attrs);
}

// The MR-4 description as Jira stores it (design Context).
const mr4Image = (): AdfNode =>
    single(
        { layout: 'align-start', width: 694, widthType: 'pixel' },
        media({
            type: 'file',
            id: MR4,
            collection: '',
            alt: 'image-20251217-080021.png',
            width: 1916,
            height: 155,
        }),
    );
const mr4 = (): AdfDocument => doc(p(text('Screenshot:', 'strong')), mr4Image());

// A Confluence image: a `contentId-…` collection, no alt, and a caption with marks.
const confluenceImage = (): AdfNode =>
    single(
        { layout: 'center', width: 760, widthType: 'pixel' },
        media({
            type: 'file',
            id: DIAGRAM,
            collection: 'contentId-12345',
            width: 1520,
            height: 980,
        }),
        caption(text('Login', 'strong'), text(' flow')),
    );
const mediaNames = new Map([[DIAGRAM, 'diagram.png']]);

describe('media references', () => {
    it('accepts media: followed by a UUID in any case, and keeps the UUID as written', () => {
        expect(mediaIdOf(`media:${MR4}`)).toBe(MR4);
        expect(mediaIdOf(`media:${MR4.toUpperCase()}`)).toBe(MR4.toUpperCase());
        expect(isMediaReference(`media:${MR4}`)).toBe(true);
    });

    it('rejects anything else, while still telling a media: URL apart', () => {
        for (const url of [
            'media:not-a-uuid',
            `media:${MR4}x`,
            `media: ${MR4}`,
            `media:{${MR4}}`,
            `MEDIA:${MR4}`,
            `https://example.com/${MR4}`,
            MR4,
            'media:',
        ]) {
            expect(mediaIdOf(url), url).toBeUndefined();
            expect(isMediaReference(url), url).toBe(false);
        }
        expect(isMediaUrl('media:not-a-uuid')).toBe(true);
        expect(isMediaUrl('https://example.com')).toBe(false);
    });
});

describe('displayAlt', () => {
    it('takes alt first, then the mediaNames name, then nothing', () => {
        expect(displayAlt({ id: DIAGRAM, alt: 'shot.png' }, mediaNames)).toBe('shot.png');
        expect(displayAlt({ id: DIAGRAM, alt: '' }, mediaNames)).toBe('diagram.png');
        expect(displayAlt({ id: DIAGRAM }, mediaNames)).toBe('diagram.png');
        expect(displayAlt({ id: DIAGRAM })).toBe('');
        expect(displayAlt({ id: OTHER }, mediaNames)).toBe('');
    });

    it('returns nothing for attributes that are not an object', () => {
        expect(displayAlt(undefined, mediaNames)).toBe('');
        expect(displayAlt('alt', mediaNames)).toBe('');
        expect(displayAlt({ alt: 42, id: 7 }, mediaNames)).toBe('');
    });
});

describe('captionText', () => {
    it('joins text, with hard breaks and line endings as spaces', () => {
        expect(
            captionText(
                caption(
                    text('Login', 'strong'),
                    { type: 'hardBreak' },
                    text('flow\r\nchart\nv2'),
                    { type: 'mention', attrs: { id: 'u1', text: '@Jane' } },
                    { type: 'emoji', attrs: { shortName: ':smile:' } },
                ),
            ),
        ).toBe('Login flow chart v2@Jane:smile:');
        expect(captionText(undefined)).toBe('');
        expect(captionText({ type: 'caption' })).toBe('');
    });
});

describe('collectMedia', () => {
    it('lists images, file cards and inline files in document order, with their context', () => {
        const image = confluenceImage();
        const entries = collectMedia(
            doc(
                p('See ', defaultInline(OTHER, 'a.pdf')),
                {
                    type: 'bulletList',
                    content: [{ type: 'listItem', content: [image] }],
                },
                group(media({ type: 'file', id: MR4, collection: '' }), text('not media')),
            ),
        );
        expect(entries.map(entry => [entry.container, entry.node.attrs])).toEqual([
            ['mediaInline', { type: 'file', id: OTHER, collection: '', alt: 'a.pdf' }],
            ['mediaSingle', (image.content as AdfNode[])[0].attrs],
            ['mediaGroup', { type: 'file', id: MR4, collection: '' }],
        ]);
        expect(entries[1].parent).toBe(image);
        expect(entries[1].caption).toBe((image.content as AdfNode[])[1]);
        expect(entries[0].parent).toBeUndefined();
    });

    it('skips what is not a node, and a mediaSingle without media', () => {
        expect(collectMedia(null)).toEqual([]);
        expect(collectMedia('doc')).toEqual([]);
        expect(
            collectMedia({
                type: 'doc',
                content: [null, 7, { type: 'mediaSingle', content: 'x' }, { type: 'mediaSingle' }],
            }),
        ).toEqual([]);
    });

    it('does not loop on a node that contains itself', () => {
        const node: Record<string, unknown> = { type: 'paragraph', content: [] };
        (node.content as unknown[]).push(node, inline({ id: MR4, collection: '' }));
        expect(collectMedia({ type: 'doc', content: [node] })).toHaveLength(1);
    });
});

describe('reconcileMedia', () => {
    it('restores an untouched image exactly, listing nothing', () => {
        const current = mr4();
        const next = doc(
            p(text('Screenshot:', 'strong')),
            defaultImage(MR4, 'image-20251217-080021.png'),
        );
        const result = reconcileMedia(next, current);
        expect(result.doc).toStrictEqual(current);
        expect(result.removed).toEqual([]);
        expect(result.unknown).toEqual([]);
    });

    it('keeps the presentation of an image moved above the text', () => {
        const next = doc(
            defaultImage(MR4, 'image-20251217-080021.png'),
            p(text('Screenshot:', 'strong')),
        );
        const result = reconcileMedia(next, mr4());
        expect(result.doc.content[0]).toStrictEqual(mr4Image());
        expect(result.removed).toEqual([]);
    });

    it('keeps changed alt text, with every other stored attribute', () => {
        const result = reconcileMedia(doc(defaultImage(MR4, 'Header layout bug')), mr4());
        const [image] = result.doc.content;
        expect(image.attrs).toEqual({ layout: 'align-start', width: 694, widthType: 'pixel' });
        expect((image.content as AdfNode[])[0].attrs).toStrictEqual({
            type: 'file',
            id: MR4,
            collection: '',
            alt: 'Header layout bug',
            width: 1916,
            height: 155,
        });
    });

    it('removes alt when the markdown empties it', () => {
        const result = reconcileMedia(doc(defaultImage(MR4)), mr4());
        expect((result.doc.content[0].content as AdfNode[])[0].attrs).not.toHaveProperty('alt');
    });

    it('keeps an absent alt absent when the alt equals the looked-up name', () => {
        const current = doc(confluenceImage());
        const next = doc(defaultImage(DIAGRAM, 'diagram.png', 'Login flow'));
        const result = reconcileMedia(next, current, mediaNames);
        expect(result.doc).toStrictEqual(current);
        const attrs = (result.doc.content[0].content as AdfNode[])[0].attrs;
        expect(attrs).not.toHaveProperty('alt');
        expect(attrs).toHaveProperty('collection', 'contentId-12345');
    });

    it('sets alt when it differs from the looked-up name', () => {
        const result = reconcileMedia(
            doc(defaultImage(DIAGRAM, 'Architecture')),
            doc(confluenceImage()),
            mediaNames,
        );
        expect((result.doc.content[0].content as AdfNode[])[0].attrs).toHaveProperty(
            'alt',
            'Architecture',
        );
    });

    it('reuses an unchanged caption, marks included, and drops a removed one', () => {
        const kept = reconcileMedia(
            doc(defaultImage(DIAGRAM, 'diagram.png', 'Login flow')),
            doc(confluenceImage()),
            mediaNames,
        );
        expect((kept.doc.content[0].content as AdfNode[])[1]).toStrictEqual(
            caption(text('Login', 'strong'), text(' flow')),
        );

        const removed = reconcileMedia(
            doc(defaultImage(DIAGRAM, 'diagram.png')),
            doc(confluenceImage()),
            mediaNames,
        );
        expect(removed.doc.content[0].content).toHaveLength(1);
        expect(removed.removed).toEqual([]);
    });

    it('keeps a changed caption as the plain text the markdown gave', () => {
        const result = reconcileMedia(
            doc(defaultImage(DIAGRAM, 'diagram.png', 'Sign-up flow')),
            doc(confluenceImage()),
            mediaNames,
        );
        expect((result.doc.content[0].content as AdfNode[])[1]).toStrictEqual(
            caption(text('Sign-up flow')),
        );
        // The image itself is still restored.
        expect(result.doc.content[0].attrs).toEqual({
            layout: 'center',
            width: 760,
            widthType: 'pixel',
        });
    });

    it('lists removed media with their names, empty when unknown', () => {
        const current = doc(
            mr4Image(),
            confluenceImage(),
            group(media({ type: 'file', id: OTHER, collection: '' })),
            p(inline({ id: 'abc', collection: '', alt: 'notes.txt' })),
        );
        const result = reconcileMedia(doc(p('Only text now')), current, mediaNames);
        expect(result.removed).toEqual([
            { id: MR4, name: 'image-20251217-080021.png', kind: 'image' },
            { id: DIAGRAM, name: 'diagram.png', kind: 'image' },
            { id: OTHER, name: '', kind: 'file' },
            { id: 'abc', name: 'notes.txt', kind: 'file' },
        ]);
        expect(result.doc).toStrictEqual(doc(p('Only text now')));
    });

    it('lists an image removed from only one of its places as kept', () => {
        const current = doc(mr4Image(), p('and again'), mr4Image());
        const result = reconcileMedia(doc(defaultImage(MR4, 'image-20251217-080021.png')), current);
        expect(result.removed).toEqual([]);
    });

    it('keeps the defaults of a UUID the current document lacks, and lists it once', () => {
        const next = doc(defaultImage(OTHER, 'x.png'), p('See ', defaultInline(OTHER, 'x.png')));
        const result = reconcileMedia(next, mr4());
        expect(result.doc).toStrictEqual(next);
        expect(result.unknown).toEqual([OTHER]);
        expect(result.removed).toEqual([
            { id: MR4, name: 'image-20251217-080021.png', kind: 'image' },
        ]);
    });

    it('copies only the attributes a mediaInline allows when an image moves inline', () => {
        const current = doc(
            single(
                { layout: 'wide' },
                media({
                    type: 'file',
                    id: MR4,
                    collection: '',
                    alt: 'image-20251217-080021.png',
                    width: 1916,
                    height: 155,
                    localId: 'm1',
                    __fileName: 'image-20251217-080021.png',
                }),
            ),
        );
        const result = reconcileMedia(
            doc(p('See ', defaultInline(MR4, 'image-20251217-080021.png'), ' here')),
            current,
        );
        expect((result.doc.content[0].content as AdfNode[])[1]).toStrictEqual(
            inline({
                type: 'file',
                id: MR4,
                collection: '',
                alt: 'image-20251217-080021.png',
                width: 1916,
                height: 155,
                localId: 'm1',
            }),
        );
    });

    it('gives an inline file that becomes an image a type that media allows', () => {
        const current = doc(
            p(
                inline({ id: MR4, collection: 'contentId-1', type: 'image', data: { x: 1 } }),
                inline({ id: DIAGRAM, collection: 'contentId-1' }),
            ),
        );
        const result = reconcileMedia(doc(defaultImage(MR4), defaultImage(DIAGRAM)), current);
        expect((result.doc.content[0].content as AdfNode[])[0].attrs).toStrictEqual({
            type: 'file',
            id: MR4,
            collection: 'contentId-1',
        });
        expect((result.doc.content[1].content as AdfNode[])[0].attrs).toStrictEqual({
            type: 'file',
            id: DIAGRAM,
            collection: 'contentId-1',
        });
        // Not images before, so the mediaSingle keeps its defaults.
        expect(result.doc.content[0].attrs).toEqual({ layout: 'center' });
    });

    it("leaves a stored mediaInline's missing type missing", () => {
        const current = doc(p(inline({ id: MR4, collection: 'contentId-1' })));
        const result = reconcileMedia(doc(p('See ', defaultInline(MR4), '.')), current);
        expect((result.doc.content[0].content as AdfNode[])[1].attrs).toStrictEqual({
            id: MR4,
            collection: 'contentId-1',
        });
    });

    it('restores the marks of a media node and of its mediaSingle', () => {
        const border = { type: 'border', attrs: { size: 2, color: '#091e4224' } };
        const linkMark = { type: 'link', attrs: { href: 'https://example.com' } };
        const stored = mr4Image();
        stored.marks = [linkMark];
        (stored.content as AdfNode[])[0].marks = [border];
        const result = reconcileMedia(
            doc(defaultImage(MR4, 'image-20251217-080021.png')),
            doc(stored),
        );
        expect(result.doc.content[0]).toStrictEqual(stored);
    });

    it('copies an occurrenceKey to every occurrence of a duplicated image', () => {
        const stored = mr4Image();
        ((stored.content as AdfNode[])[0].attrs as Record<string, unknown>).occurrenceKey = 'k1';
        const result = reconcileMedia(
            doc(
                defaultImage(MR4, 'image-20251217-080021.png'),
                defaultImage(MR4, 'image-20251217-080021.png'),
            ),
            doc(stored),
        );
        expect(result.doc.content).toStrictEqual([stored, stored]);
    });

    it('fills in layout and collection that a malformed stored node lacks', () => {
        const current = doc(
            single({ width: 50 }, media({ type: 'file', id: MR4 })),
            single('oops' as never, media({ type: 'file', id: DIAGRAM, collection: 7 })),
        );
        const result = reconcileMedia(doc(defaultImage(MR4), defaultImage(DIAGRAM)), current);
        expect(result.doc.content[0]).toStrictEqual(
            single(
                { width: 50, layout: 'center' },
                media({ type: 'file', id: MR4, collection: '' }),
            ),
        );
        expect(result.doc.content[1]).toStrictEqual(defaultImage(DIAGRAM));
    });

    it('does not throw on a malformed current document, and uses no malformed node', () => {
        const malformed = {
            type: 'doc',
            content: [
                { type: 'mediaSingle', content: [{ type: 'media' }] },
                { type: 'mediaGroup', content: [{ type: 'media', attrs: { id: '' } }, 'x'] },
                { type: 'paragraph', content: [{ type: 'mediaInline', attrs: 'oops' }] },
                null,
            ],
        };
        const next = doc(defaultImage(MR4, 'shot.png'));
        for (const current of [malformed, null, undefined, 'text', 42, { content: 'x' }]) {
            const result = reconcileMedia(next, current);
            expect(result.doc).toStrictEqual(next);
            expect(result.removed).toEqual([]);
            expect(result.unknown).toEqual([MR4]);
        }
    });

    it('changes neither input, and shares no object with them', () => {
        const current = doc(confluenceImage(), mr4Image());
        const next = doc(
            defaultImage(DIAGRAM, 'diagram.png', 'Login flow'),
            p('See ', defaultInline(MR4, 'renamed.png')),
        );
        const currentCopy = structuredClone(current);
        const nextCopy = structuredClone(next);
        const result = reconcileMedia(next, current, mediaNames);
        expect(current).toStrictEqual(currentCopy);
        expect(next).toStrictEqual(nextCopy);

        // Changing the result reaches neither input.
        const image = result.doc.content[0];
        (image.attrs as Record<string, unknown>).layout = 'wide';
        ((image.content as AdfNode[])[1].content as AdfNode[])[0].text = 'changed';
        expect(current).toStrictEqual(currentCopy);
        expect(next).toStrictEqual(nextCopy);
    });
});

describe('formatRemovedMediaWarning', () => {
    it('names one removed image and says the attachment is still on the issue', () => {
        expect(
            formatRemovedMediaWarning(
                [{ id: MR4, name: 'image-20251217-080021.png', kind: 'image' }],
                { kind: 'issue', key: 'MR-4' },
            ),
        ).toBe(
            'Warning: this update removed 1 embedded image from MR-4: image-20251217-080021.png. The attachment is still on the issue.',
        );
    });

    it('counts images and files apart, and reads an unknown name as media <uuid>', () => {
        expect(
            formatRemovedMediaWarning(
                [
                    { id: MR4, name: 'a.png', kind: 'image' },
                    { id: DIAGRAM, name: 'b.png', kind: 'image' },
                    { id: OTHER, name: '', kind: 'file' },
                ],
                { kind: 'issue', key: 'PROJ-1' },
            ),
        ).toBe(
            `Warning: this update removed 2 embedded images and 1 embedded file from PROJ-1: a.png, b.png, media ${OTHER}. The attachments are still on the issue.`,
        );
        expect(
            formatRemovedMediaWarning(
                [
                    { id: MR4, name: 'a.pdf', kind: 'file' },
                    { id: DIAGRAM, name: 'b.pdf', kind: 'file' },
                ],
                { kind: 'issue', key: 'PROJ-1' },
            ),
        ).toBe(
            'Warning: this update removed 2 embedded files from PROJ-1: a.pdf, b.pdf. The attachments are still on the issue.',
        );
    });

    it('names a Confluence page as page <id>', () => {
        expect(
            formatRemovedMediaWarning([{ id: DIAGRAM, name: 'diagram.png', kind: 'image' }], {
                kind: 'page',
                key: '12345',
            }),
        ).toBe(
            'Warning: this update removed 1 embedded image from page 12345: diagram.png. The attachment is still on the page.',
        );
    });

    it('is empty when nothing was removed', () => {
        expect(formatRemovedMediaWarning([], { kind: 'issue', key: 'MR-4' })).toBe('');
    });
});
