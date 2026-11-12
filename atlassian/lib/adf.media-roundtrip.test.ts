// The media round trip (design D10 of round-trip-adf-media): documents with media, in the shapes
// Jira and Confluence store (test/fixtures/adf-media.json), must come back identical after
// adfToText, then textToAdf, then reconcileMedia against the original. That is what an agent's
// get -> edit -> update does with a media line it leaves alone. External images are the
// documented exception: they read back as a link. Every intermediate document must be valid ADF.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateAdf } from '../../test/helpers/adf.ts';
import { adfToText, textToAdf, textToAdfKeepingMedia } from './adf.ts';
import { collectMedia, reconcileMedia } from './adf-media.ts';
import type { AdfDocument, AdfNode } from './adf-types.ts';

interface MediaCase {
    id: string;
    note: string;
    doc: AdfDocument;
    mediaNames?: Record<string, string>;
    markdown: string;
}

const cases = JSON.parse(
    readFileSync(new URL('../../test/fixtures/adf-media.json', import.meta.url), 'utf8'),
) as MediaCase[];

/** Every media node with its container, as reconcileMedia sees them. */
function mediaOf(doc: AdfDocument): unknown[] {
    return collectMedia(doc).map(({ node, parent, caption }) => ({ node, parent, caption }));
}

describe('media round trip', () => {
    it('holds the five observed shapes, each with its own id', () => {
        expect(cases.map(({ id }) => id)).toEqual([
            'jira-description',
            'confluence-body',
            'file-cards',
            'inline-file',
            'external-image',
        ]);
    });

    for (const { id, doc, mediaNames: names, markdown } of cases) {
        const mediaNames = names ? new Map(Object.entries(names)) : undefined;

        describe(id, () => {
            it('is valid ADF to begin with', () => {
                expect(validateAdf(doc)).toBeNull();
            });

            it('renders as the expected markdown', () => {
                expect(adfToText(doc, { mediaNames })).toBe(markdown);
            });

            it('reads back as valid ADF', () => {
                expect(validateAdf(textToAdf(markdown))).toBeNull();
            });

            if (id === 'external-image') {
                it('reads back as a link to the image, a documented limit', () => {
                    expect(textToAdf(adfToText(doc, { mediaNames }))).toStrictEqual({
                        type: 'doc',
                        version: 1,
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        type: 'text',
                                        text: 'diagram',
                                        marks: [
                                            {
                                                type: 'link',
                                                attrs: { href: 'https://example.com/diagram.png' },
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    });
                });
                return;
            }

            it('comes back identical after reconciling against the original', () => {
                const next = textToAdf(adfToText(doc, { mediaNames }));
                const result = reconcileMedia(next, doc, mediaNames);
                expect(mediaOf(result.doc)).toStrictEqual(mediaOf(doc));
                expect(result.doc).toStrictEqual(doc);
                expect(result.removed).toEqual([]);
                expect(result.unknown).toEqual([]);
                expect(validateAdf(result.doc)).toBeNull();
            });
        });
    }
});

// The scenarios of the shared requirement "Media attributes restored from the current document",
// through the facade every update path uses.
describe('textToAdfKeepingMedia', () => {
    const MR4 = '0ab844aa-b95b-46bd-9d6c-a7d69ac7b901';
    const DIAGRAM = '7f1e2d3c-4b5a-4968-8776-655443322110';
    const mr4 = (cases.find(({ id }) => id === 'jira-description') as MediaCase).doc;
    const confluence = cases.find(({ id }) => id === 'confluence-body') as MediaCase;
    const mediaNames = new Map(Object.entries(confluence.mediaNames ?? {}));
    const imageOf = (doc: AdfDocument): AdfNode =>
        doc.content.find(node => node.type === 'mediaSingle') as AdfNode;
    const mediaIn = (image: AdfNode): AdfNode => (image.content as AdfNode[])[0];

    it('returns textToAdf(markdown) reconciled against the current document', () => {
        const markdown = `Intro\n\n![shot](media:${MR4})`;
        expect(textToAdfKeepingMedia(markdown, mr4)).toStrictEqual(
            reconcileMedia(textToAdf(markdown), mr4),
        );
    });

    it('brings an untouched image back exactly, listing nothing', () => {
        const result = textToAdfKeepingMedia(adfToText(mr4), mr4);
        expect(imageOf(result.doc)).toStrictEqual(imageOf(mr4));
        expect(result.doc).toStrictEqual(mr4);
        expect(result.removed).toEqual([]);
        expect(result.unknown).toEqual([]);
    });

    it('keeps the presentation of an image moved above the text', () => {
        const result = textToAdfKeepingMedia(
            `![image-20251217-080021.png](media:${MR4})\n\n**Screenshot:**`,
            mr4,
        );
        expect(result.doc.content[0]).toStrictEqual(imageOf(mr4));
        expect(result.doc.content[0].attrs).toEqual({
            layout: 'align-start',
            width: 694,
            widthType: 'pixel',
        });
    });

    it('keeps changed alt text, with every other attribute from the current document', () => {
        const result = textToAdfKeepingMedia(
            `**Screenshot:**\n\n![Header layout bug](media:${MR4})`,
            mr4,
        );
        expect(mediaIn(imageOf(result.doc)).attrs).toStrictEqual({
            type: 'file',
            id: MR4,
            collection: '',
            alt: 'Header layout bug',
            width: 1916,
            height: 155,
        });
    });

    it('keeps an absent alt absent when the alt equals the looked-up name', () => {
        const result = textToAdfKeepingMedia(
            `![diagram.png](media:${DIAGRAM})`,
            confluence.doc,
            mediaNames,
        );
        const attrs = mediaIn(imageOf(result.doc)).attrs;
        expect(attrs).not.toHaveProperty('alt');
        expect(attrs).toHaveProperty('collection', 'contentId-12345');
    });

    it('keeps the formatting of an unchanged caption', () => {
        const result = textToAdfKeepingMedia(
            `![diagram.png](media:${DIAGRAM} "Login flow")`,
            confluence.doc,
            mediaNames,
        );
        expect((imageOf(result.doc).content as AdfNode[])[1]).toStrictEqual(
            (imageOf(confluence.doc).content as AdfNode[])[1],
        );
    });

    it('lists a removed image', () => {
        expect(textToAdfKeepingMedia('Only text now', mr4).removed).toEqual([
            { id: MR4, name: 'image-20251217-080021.png', kind: 'image' },
        ]);
    });

    it('lists an image from elsewhere as not found, with its defaults', () => {
        const other = '11111111-2222-3333-4444-555555555555';
        const result = textToAdfKeepingMedia(`![x.png](media:${other})`, mr4);
        const image = imageOf(result.doc);
        expect(image.attrs).toEqual({ layout: 'center' });
        expect(mediaIn(image).attrs).toHaveProperty('collection', '');
        expect(result.unknown).toEqual([other]);
    });

    it('does not throw on a malformed current document, and uses no malformed node', () => {
        const current = {
            type: 'doc',
            content: [{ type: 'mediaSingle', content: [{ type: 'media' }] }],
        };
        const result = textToAdfKeepingMedia(`![x.png](media:${MR4})`, current);
        expect(result.doc).toStrictEqual(textToAdf(`![x.png](media:${MR4})`));
        expect(result.removed).toEqual([]);
        expect(textToAdfKeepingMedia('text', null).doc).toStrictEqual(textToAdf('text'));
    });

    it('produces valid ADF', () => {
        for (const markdown of [adfToText(mr4), 'Only text now', `See [x](media:${MR4}).`]) {
            expect(validateAdf(textToAdfKeepingMedia(markdown, mr4).doc)).toBeNull();
        }
    });
});
