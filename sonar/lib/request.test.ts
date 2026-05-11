import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    request,
    SonarAuthError,
    SonarPRNotAnalyzedError,
    SonarProjectNotFoundError,
    SonarRequestError,
} from './request.ts';
import type { SonarConfig } from './config.ts';

const config: SonarConfig = {
    baseUrl: 'https://sonar.example.com',
    projectKey: 'K',
    token: 'tok',
    propertiesPath: null,
};

function mockFetchResponse(
    status: number,
    body: unknown,
    options: { json?: boolean } = { json: true },
): void {
    const text = options.json
        ? JSON.stringify(body)
        : typeof body === 'string'
          ? body
          : String(body);
    globalThis.fetch = vi.fn(() =>
        Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            text: () => Promise.resolve(text),
            json: () => Promise.resolve(body),
        } as unknown as Response),
    );
}

describe('sonar request()', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('builds the URL with base + path + query', async () => {
        const spy = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ ok: 1 }),
                text: () => Promise.resolve('{"ok":1}'),
            } as unknown as Response),
        );
        globalThis.fetch = spy;

        await request(config, '/api/test', { a: 'x', b: 2, empty: '', skip: undefined });

        expect(spy).toHaveBeenCalledTimes(1);
        const url = spy.mock.calls[0][0] as string;
        expect(url).toContain('https://sonar.example.com/api/test');
        expect(url).toContain('a=x');
        expect(url).toContain('b=2');
        expect(url).not.toContain('empty=');
        expect(url).not.toContain('skip=');
    });

    it('sends Authorization: Bearer header', async () => {
        const spy = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
                text: () => Promise.resolve('{}'),
            } as unknown as Response),
        );
        globalThis.fetch = spy;

        await request(config, '/api/x');

        const options = spy.mock.calls[0][1] as RequestInit;
        const headers = options.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer tok');
        expect(headers.Accept).toBe('application/json');
    });

    it('returns parsed JSON on success', async () => {
        mockFetchResponse(200, { hello: 'world' });
        const result = await request<{ hello: string }>(config, '/api/x');
        expect(result).toEqual({ hello: 'world' });
    });

    it('maps 401 to SonarAuthError', async () => {
        mockFetchResponse(401, 'unauthorized', { json: false });
        await expect(request(config, '/api/x')).rejects.toBeInstanceOf(SonarAuthError);
    });

    it('maps 403 to SonarAuthError', async () => {
        mockFetchResponse(403, 'forbidden', { json: false });
        await expect(request(config, '/api/x')).rejects.toBeInstanceOf(SonarAuthError);
    });

    it('maps 404 with notFoundMeansPRNotAnalyzed to SonarPRNotAnalyzedError', async () => {
        mockFetchResponse(404, 'not found', { json: false });
        await expect(
            request(
                config,
                '/api/x',
                {},
                {
                    projectKey: 'K',
                    pullRequest: '42',
                    notFoundMeansPRNotAnalyzed: true,
                },
            ),
        ).rejects.toBeInstanceOf(SonarPRNotAnalyzedError);
    });

    it('maps generic 404 with projectKey to SonarProjectNotFoundError', async () => {
        mockFetchResponse(404, 'not found', { json: false });
        await expect(request(config, '/api/x', {}, { projectKey: 'K' })).rejects.toBeInstanceOf(
            SonarProjectNotFoundError,
        );
    });

    it('maps other non-2xx to generic SonarRequestError', async () => {
        mockFetchResponse(500, 'boom', { json: false });
        const promise = request(config, '/api/x');
        await expect(promise).rejects.toBeInstanceOf(SonarRequestError);
        await expect(promise).rejects.not.toBeInstanceOf(SonarAuthError);
    });

    it('SonarPRNotAnalyzedError message names project and PR id', async () => {
        mockFetchResponse(404, 'not found', { json: false });
        try {
            await request(
                config,
                '/api/x',
                {},
                {
                    projectKey: 'myproject',
                    pullRequest: '99',
                    notFoundMeansPRNotAnalyzed: true,
                },
            );
            expect.fail('should have thrown');
        } catch (err) {
            expect((err as Error).message).toContain('myproject');
            expect((err as Error).message).toContain('99');
        }
    });
});
