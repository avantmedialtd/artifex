import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { paginate, request, requestText } from './request.ts';

describe('atlassian request helpers', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            ATLASSIAN_BASE_URL: 'https://test.atlassian.net',
            ATLASSIAN_EMAIL: 'user@test.com',
            ATLASSIAN_API_TOKEN: 'token123',
        };
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.restoreAllMocks();
    });

    describe('requestText', () => {
        it('returns body as text on success', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(
                    new Response('plain log content', {
                        status: 200,
                        headers: { 'content-type': 'text/plain' },
                    }),
                ),
            );
            const result = await requestText('https://api.bitbucket.org/2.0/foo');
            expect(result).toBe('plain log content');
        });

        it('sends Basic auth header', async () => {
            const fetchMock = vi.fn().mockResolvedValue(new Response('x', { status: 200 }));
            vi.stubGlobal('fetch', fetchMock);

            await requestText('https://api.bitbucket.org/2.0/foo');

            const init = fetchMock.mock.calls[0][1] as RequestInit;
            const headers = init.headers as Record<string, string>;
            expect(headers.Authorization).toMatch(/^Basic /);
        });

        it('throws on non-2xx with text body as message', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(new Response('boom', { status: 500 })),
            );
            await expect(requestText('https://api.bitbucket.org/2.0/foo')).rejects.toThrow('boom');
        });

        it('extracts JSON error message when available', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(
                    new Response(JSON.stringify({ message: 'no access' }), {
                        status: 403,
                    }),
                ),
            );
            await expect(requestText('https://api.bitbucket.org/2.0/foo')).rejects.toThrow(
                'no access',
            );
        });

        it('extracts Bitbucket nested error.message envelope', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(
                    new Response(
                        JSON.stringify({
                            type: 'error',
                            error: { message: 'newstatus: already closed' },
                        }),
                        { status: 400 },
                    ),
                ),
            );
            await expect(requestText('https://api.bitbucket.org/2.0/foo')).rejects.toThrow(
                'newstatus: already closed',
            );
        });

        it('returns empty string on 204', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
            const result = await requestText('https://api.bitbucket.org/2.0/foo');
            expect(result).toBe('');
        });
    });

    describe('request<T>', () => {
        it('skips default auth when caller supplies Authorization', async () => {
            // Drop the Atlassian env vars so the default auth path would throw.
            delete process.env.ATLASSIAN_BASE_URL;
            delete process.env.ATLASSIAN_EMAIL;
            delete process.env.ATLASSIAN_API_TOKEN;
            const fetchMock = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
            vi.stubGlobal('fetch', fetchMock);

            const result = await request<{ ok: boolean }>('https://api.bitbucket.org/2.0/x', {
                headers: { Authorization: 'Basic bb-creds' },
            });

            expect(result).toEqual({ ok: true });
            const init = fetchMock.mock.calls[0][1] as RequestInit;
            const headers = init.headers as Record<string, string>;
            expect(headers.Authorization).toBe('Basic bb-creds');
        });

        it('extracts Bitbucket nested error.message envelope', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(
                    new Response(
                        JSON.stringify({
                            type: 'error',
                            error: {
                                message: 'newstatus: already closed',
                                fields: { newstatus: ['This pull request is already closed.'] },
                            },
                        }),
                        { status: 400 },
                    ),
                ),
            );
            await expect(
                request<unknown>('https://api.bitbucket.org/2.0/x', {
                    headers: { Authorization: 'Basic x' },
                }),
            ).rejects.toThrow('newstatus: already closed');
        });
    });

    describe('paginate', () => {
        it('yields each value across pages', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce(
                    new Response(
                        JSON.stringify({
                            values: [{ id: 1 }, { id: 2 }],
                            next: 'https://api.bitbucket.org/2.0/page2',
                        }),
                        { status: 200 },
                    ),
                )
                .mockResolvedValueOnce(
                    new Response(JSON.stringify({ values: [{ id: 3 }, { id: 4 }] }), {
                        status: 200,
                    }),
                );
            vi.stubGlobal('fetch', fetchMock);

            const collected: { id: number }[] = [];
            for await (const value of paginate<{ id: number }>(
                'https://api.bitbucket.org/2.0/page1',
            )) {
                collected.push(value);
            }

            expect(collected).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('handles single page (no next)', async () => {
            vi.stubGlobal(
                'fetch',
                vi
                    .fn()
                    .mockResolvedValue(
                        new Response(JSON.stringify({ values: [{ id: 1 }] }), { status: 200 }),
                    ),
            );

            const collected: { id: number }[] = [];
            for await (const value of paginate<{ id: number }>(
                'https://api.bitbucket.org/2.0/items',
            )) {
                collected.push(value);
            }

            expect(collected).toEqual([{ id: 1 }]);
        });

        it('handles empty response', async () => {
            vi.stubGlobal(
                'fetch',
                vi
                    .fn()
                    .mockResolvedValue(
                        new Response(JSON.stringify({ values: [] }), { status: 200 }),
                    ),
            );

            const collected: unknown[] = [];
            for await (const value of paginate<unknown>('https://api.bitbucket.org/2.0/items')) {
                collected.push(value);
            }

            expect(collected).toEqual([]);
        });

        it('handles missing values field', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })),
            );

            const collected: unknown[] = [];
            for await (const value of paginate<unknown>('https://api.bitbucket.org/2.0/items')) {
                collected.push(value);
            }

            expect(collected).toEqual([]);
        });

        it('passes Basic auth on each request', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce(
                    new Response(
                        JSON.stringify({
                            values: [{ id: 1 }],
                            next: 'https://api.bitbucket.org/2.0/page2',
                        }),
                        { status: 200 },
                    ),
                )
                .mockResolvedValueOnce(
                    new Response(JSON.stringify({ values: [{ id: 2 }] }), { status: 200 }),
                );
            vi.stubGlobal('fetch', fetchMock);

            for await (const _ of paginate<{ id: number }>('https://api.bitbucket.org/2.0/page1')) {
                // drain
            }

            for (const call of fetchMock.mock.calls) {
                const init = call[1] as RequestInit;
                const headers = init.headers as Record<string, string>;
                expect(headers.Authorization).toMatch(/^Basic /);
            }
        });
    });
});
