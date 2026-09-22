import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bbPaginate, resetBitbucketAuthCache } from './request.ts';

const PAGE_1 = 'https://api.bitbucket.org/2.0/items?page=1';
const PAGE_2 = 'https://api.bitbucket.org/2.0/items?page=2';

function page(values: unknown[], next?: string): Response {
    return new Response(JSON.stringify(next ? { values, next } : { values }), { status: 200 });
}

async function drain<T>(iterable: AsyncIterable<T>): Promise<T[]> {
    const out: T[] = [];
    for await (const value of iterable) out.push(value);
    return out;
}

describe('bbPaginate', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            BITBUCKET_USERNAME: 'bb-user',
            BITBUCKET_API_TOKEN: 'bb-token',
        };
        resetBitbucketAuthCache();
    });

    afterEach(() => {
        process.env = originalEnv;
        resetBitbucketAuthCache();
        vi.unstubAllGlobals();
    });

    it('requests page 2 at the URL returned by mapNext', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(page([{ id: 1 }], PAGE_2))
            .mockResolvedValueOnce(page([{ id: 2 }]));
        vi.stubGlobal('fetch', fetchMock);
        const mapped = `${PAGE_2}&fields=%2Bvalues.participants`;
        const mapNext = vi.fn(() => mapped);

        const values = await drain(bbPaginate<{ id: number }>(PAGE_1, { mapNext }));

        expect(values).toEqual([{ id: 1 }, { id: 2 }]);
        // Called once per `next` link; the last page has none.
        expect(mapNext).toHaveBeenCalledTimes(1);
        expect(mapNext).toHaveBeenCalledWith(PAGE_2);
        expect(fetchMock.mock.calls.map(c => c[0])).toEqual([PAGE_1, mapped]);
        const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
        expect((init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    });

    it('follows next verbatim without mapNext', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(page([{ id: 1 }], PAGE_2))
            .mockResolvedValueOnce(page([{ id: 2 }]));
        vi.stubGlobal('fetch', fetchMock);

        const values = await drain(bbPaginate<{ id: number }>(PAGE_1));

        expect(values).toEqual([{ id: 1 }, { id: 2 }]);
        expect(fetchMock.mock.calls.map(c => c[0])).toEqual([PAGE_1, PAGE_2]);
    });
});
