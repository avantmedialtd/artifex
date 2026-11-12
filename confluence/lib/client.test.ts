import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    addComment,
    createPage,
    getAllAttachments,
    getAttachment,
    mediaNamesOf,
    parseAdfBody,
    updatePage,
} from './client.ts';
import type { ConfluenceAttachment } from './types.ts';

const BASE_URL = 'https://test.atlassian.net';

function mockJsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function attachment(id: string): Record<string, unknown> {
    return {
        id,
        status: 'current',
        title: `${id}.png`,
        mediaType: 'image/png',
        fileSize: 100,
        fileId: `file-${id}`,
        pageId: '12345',
        downloadLink: `/download/attachments/12345/${id}.png?version=1&api=v2`,
    };
}

describe('confluence client', () => {
    const originalEnv = process.env;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            ATLASSIAN_BASE_URL: BASE_URL,
            ATLASSIAN_EMAIL: 'user@test.com',
            ATLASSIAN_API_TOKEN: 'tok',
        };
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.unstubAllGlobals();
    });

    function requestedUrls(): string[] {
        return fetchMock.mock.calls.map((call: unknown[]) => String(call[0]));
    }

    describe('getAllAttachments', () => {
        it('follows each next link until a response has none', async () => {
            const next = (cursor: string): string =>
                `/wiki/api/v2/pages/12345/attachments?limit=250&cursor=${cursor}`;
            fetchMock
                .mockResolvedValueOnce(
                    mockJsonResponse({
                        results: [attachment('att1'), attachment('att2')],
                        _links: { next: next('c1'), base: `${BASE_URL}/wiki` },
                    }),
                )
                .mockResolvedValueOnce(
                    mockJsonResponse({
                        results: [attachment('att3')],
                        _links: { next: next('c2'), base: `${BASE_URL}/wiki` },
                    }),
                )
                .mockResolvedValueOnce(
                    mockJsonResponse({
                        results: [attachment('att4')],
                        _links: { base: `${BASE_URL}/wiki` },
                    }),
                );

            const all = await getAllAttachments('12345');

            expect(all.map(a => a.id)).toEqual(['att1', 'att2', 'att3', 'att4']);
            expect(all[0]).toMatchObject({ fileId: 'file-att1', pageId: '12345' });
            // The site-relative next paths get the base URL once: never /wiki/wiki.
            expect(requestedUrls()).toEqual([
                `${BASE_URL}/wiki/api/v2/pages/12345/attachments?limit=250`,
                `${BASE_URL}${next('c1')}`,
                `${BASE_URL}${next('c2')}`,
            ]);
            for (const call of fetchMock.mock.calls) {
                expect((call[1] as RequestInit).headers).toHaveProperty('Authorization');
            }
        });

        it('makes one request when the first page is the last', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ results: [], _links: {} }));
            expect(await getAllAttachments('12345')).toEqual([]);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('refuses a next link that is not a site-relative path', async () => {
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse({
                    results: [attachment('att1')],
                    _links: { next: 'https://elsewhere.example/wiki/api/v2/x' },
                }),
            );
            await expect(getAllAttachments('12345')).rejects.toThrow(
                'Unexpected pagination link from Confluence: https://elsewhere.example/wiki/api/v2/x',
            );
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('getAttachment', () => {
        it('requests the attachment by ID from the v2 API', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse(attachment('att111')));

            expect(await getAttachment('att111')).toMatchObject({ id: 'att111' });
            expect(requestedUrls()).toEqual([`${BASE_URL}/wiki/api/v2/attachments/att111`]);
        });

        it('rejects with the HTTP status for an unknown ID', async () => {
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse(
                    { errors: [{ status: 404, code: 'NOT_FOUND', title: 'Not Found' }] },
                    404,
                ),
            );
            await expect(getAttachment('att999')).rejects.toMatchObject({
                name: 'AtlassianHttpError',
                status: 404,
            });
        });
    });

    describe('embedded media (design D6 of round-trip-adf-media)', () => {
        const DIAGRAM = '7f1e2d3c-4b5a-4968-8776-655443322110';
        const caption = {
            type: 'caption',
            content: [
                { type: 'text', text: 'Login', marks: [{ type: 'strong' }] },
                { type: 'text', text: ' flow' },
            ],
        };
        // An image as Confluence stores it: no alt, a contentId collection, pixel sizes.
        const storedImage = {
            type: 'mediaSingle',
            attrs: { layout: 'center', width: 760, widthType: 'pixel' },
            content: [
                {
                    type: 'media',
                    attrs: {
                        width: 1520,
                        id: DIAGRAM,
                        collection: 'contentId-12345',
                        type: 'file',
                        height: 980,
                    },
                },
                caption,
            ],
        };
        const body = (...content: unknown[]): string =>
            JSON.stringify({ type: 'doc', version: 1, content });
        const page = (value: string): Record<string, unknown> => ({
            id: '12345',
            status: 'current',
            title: 'Design',
            spaceId: '1',
            version: { number: 7 },
            body: { atlas_doc_format: { representation: 'atlas_doc_format', value } },
        });
        const intro = { type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] };

        /** The ADF document the last request sent, as its body value. */
        function sentDocument(): Record<string, unknown> {
            const [, init] = fetchMock.mock.calls.at(-1)!;
            const sent = JSON.parse((init as RequestInit).body as string);
            return JSON.parse(sent.body.value);
        }

        it('keeps an image without alt exactly, naming it from one attachments fetch', async () => {
            fetchMock
                .mockResolvedValueOnce(mockJsonResponse(page(body(intro, storedImage))))
                .mockResolvedValueOnce(
                    mockJsonResponse({
                        results: [{ ...attachment('att1'), fileId: DIAGRAM, title: 'diagram.png' }],
                    }),
                )
                .mockResolvedValueOnce(mockJsonResponse({ id: '12345', title: 'Design' }));

            const result = await updatePage('12345', {
                bodyMarkdown: `Intro, reworded\n\n![diagram.png](media:${DIAGRAM} "Login flow")\n`,
            });

            expect(requestedUrls()).toEqual([
                `${BASE_URL}/wiki/api/v2/pages/12345?body-format=atlas_doc_format`,
                `${BASE_URL}/wiki/api/v2/pages/12345/attachments?limit=250`,
                `${BASE_URL}/wiki/api/v2/pages/12345`,
            ]);
            expect(sentDocument()).toStrictEqual({
                type: 'doc',
                version: 1,
                content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Intro, reworded' }] },
                    storedImage,
                ],
            });
            expect(result).toEqual({ page: { id: '12345', title: 'Design' }, removed: [] });
        });

        it('fetches no attachments when every media node has alt', async () => {
            const withAlt = structuredClone(storedImage);
            (withAlt.content[0] as { attrs: Record<string, unknown> }).attrs.alt = 'diagram.png';
            fetchMock
                .mockResolvedValueOnce(mockJsonResponse(page(body(withAlt))))
                .mockResolvedValueOnce(mockJsonResponse({ id: '12345', title: 'Design' }));

            await updatePage('12345', {
                bodyMarkdown: `![diagram.png](media:${DIAGRAM} "Login flow")`,
            });

            expect(requestedUrls()).toHaveLength(2);
            expect(sentDocument()).toStrictEqual({ type: 'doc', version: 1, content: [withAlt] });
        });

        it('returns the media the new body drops, with its looked-up name', async () => {
            fetchMock
                .mockResolvedValueOnce(mockJsonResponse(page(body(intro, storedImage))))
                .mockResolvedValueOnce(
                    mockJsonResponse({
                        results: [{ ...attachment('att1'), fileId: DIAGRAM, title: 'diagram.png' }],
                    }),
                )
                .mockResolvedValueOnce(mockJsonResponse({ id: '12345', title: 'Design' }));

            const result = await updatePage('12345', { bodyMarkdown: 'Text only' });

            expect(result.removed).toEqual([{ id: DIAGRAM, name: 'diagram.png', kind: 'image' }]);
            expect(sentDocument()).toStrictEqual({
                type: 'doc',
                version: 1,
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text only' }] }],
            });
        });

        it('keeps the stored body, and looks nothing up, when only the title changes', async () => {
            const stored = body(intro, storedImage);
            fetchMock
                .mockResolvedValueOnce(mockJsonResponse(page(stored)))
                .mockResolvedValueOnce(mockJsonResponse({ id: '12345', title: 'New' }));

            const result = await updatePage('12345', { title: 'New' });

            expect(requestedUrls()).toHaveLength(2);
            const [, init] = fetchMock.mock.calls[1]!;
            expect(JSON.parse((init as RequestInit).body as string).body.value).toBe(stored);
            expect(result.removed).toEqual([]);
        });

        it('creates a page with default media attributes and no extra request', async () => {
            fetchMock
                .mockResolvedValueOnce(mockJsonResponse({ results: [{ id: '1', key: 'DOCS' }] }))
                .mockResolvedValueOnce(mockJsonResponse({ id: '777', title: 'Runbook' }));

            await createPage('DOCS', 'Runbook', `![diagram.png](media:${DIAGRAM})`);

            expect(requestedUrls()).toEqual([
                `${BASE_URL}/wiki/api/v2/spaces?keys=DOCS&limit=1`,
                `${BASE_URL}/wiki/api/v2/pages`,
            ]);
            expect(sentDocument()).toStrictEqual({
                type: 'doc',
                version: 1,
                content: [
                    {
                        type: 'mediaSingle',
                        attrs: { layout: 'center' },
                        content: [
                            {
                                type: 'media',
                                attrs: {
                                    type: 'file',
                                    id: DIAGRAM,
                                    collection: '',
                                    alt: 'diagram.png',
                                },
                            },
                        ],
                    },
                ],
            });
        });

        it('adds a comment with a default inline file in one request', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: 'c1' }));

            await addComment('12345', `See [diagram.png](media:${DIAGRAM})`);

            expect(requestedUrls()).toEqual([`${BASE_URL}/wiki/api/v2/footer-comments`]);
            expect(sentDocument()).toStrictEqual({
                type: 'doc',
                version: 1,
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: 'See ' },
                            {
                                type: 'mediaInline',
                                attrs: {
                                    type: 'file',
                                    id: DIAGRAM,
                                    collection: '',
                                    alt: 'diagram.png',
                                },
                            },
                        ],
                    },
                ],
            });
        });

        it('parses a body, and maps attachments by fileId', () => {
            expect(parseAdfBody(body(intro))).toEqual({
                type: 'doc',
                version: 1,
                content: [intro],
            });
            expect(parseAdfBody('not json')).toBeUndefined();
            expect(parseAdfBody(undefined)).toBeUndefined();
            const names = mediaNamesOf([
                {
                    ...attachment('att1'),
                    fileId: DIAGRAM,
                    title: 'diagram.png',
                } as ConfluenceAttachment,
                { ...attachment('att2'), fileId: undefined } as ConfluenceAttachment,
            ]);
            expect([...names]).toEqual([[DIAGRAM, 'diagram.png']]);
        });
    });
});
