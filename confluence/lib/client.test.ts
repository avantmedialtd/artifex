import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAllAttachments, getAttachment } from './client.ts';

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
});
