import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFieldFlags } from './resolve-flags.ts';

function mockJson(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('resolveFieldFlags', () => {
    const originalEnv = process.env;
    let tmpHome: string;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        tmpHome = mkdtempSync(join(tmpdir(), 'af-resolve-'));
        process.env = {
            ...originalEnv,
            HOME: tmpHome,
            ATLASSIAN_BASE_URL: 'https://t.atlassian.net',
            ATLASSIAN_EMAIL: 'u@e.com',
            ATLASSIAN_API_TOKEN: 'tok',
        };
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        rmSync(tmpHome, { recursive: true, force: true });
        process.env = originalEnv;
        vi.unstubAllGlobals();
    });

    it('returns undefined when no flags supplied', async () => {
        const out = await resolveFieldFlags({});
        expect(out).toBeUndefined();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('resolves a single --field by display name and encodes it', async () => {
        fetchMock.mockResolvedValueOnce(
            mockJson([
                {
                    id: 'customfield_10016',
                    name: 'Story Points',
                    custom: true,
                    schema: { type: 'number' },
                },
            ]),
        );
        const out = await resolveFieldFlags({ fieldPairs: ['Story Points=5'] });
        expect(out?.customFields).toEqual({ customfield_10016: 5 });
    });

    it('resolves multiple --field entries', async () => {
        fetchMock.mockResolvedValueOnce(
            mockJson([
                {
                    id: 'customfield_10016',
                    name: 'Story Points',
                    custom: true,
                    schema: { type: 'number' },
                },
                {
                    id: 'customfield_10099',
                    name: 'Severity',
                    custom: true,
                    schema: { type: 'option' },
                },
            ]),
        );
        const out = await resolveFieldFlags({
            fieldPairs: ['Story Points=5', 'Severity=High'],
        });
        expect(out?.customFields).toEqual({
            customfield_10016: 5,
            customfield_10099: { value: 'High' },
        });
    });

    it('merges --field-json and --field, with JSON winning on conflict', async () => {
        fetchMock.mockResolvedValueOnce(
            mockJson([
                {
                    id: 'customfield_10016',
                    name: 'Story Points',
                    custom: true,
                    schema: { type: 'number' },
                },
            ]),
        );
        const out = await resolveFieldFlags({
            fieldPairs: ['Story Points=5'],
            fieldJson: '{"customfield_10016": 99}',
        });
        expect(out?.customFields).toEqual({ customfield_10016: 99 });
    });

    it('encodes empty value as null (clearing)', async () => {
        fetchMock.mockResolvedValueOnce(
            mockJson([
                {
                    id: 'customfield_10016',
                    name: 'Story Points',
                    custom: true,
                    schema: { type: 'number' },
                },
            ]),
        );
        const out = await resolveFieldFlags({ fieldPairs: ['Story Points='] });
        expect(out?.customFields).toEqual({ customfield_10016: null });
    });

    it('errors on ambiguous display name', async () => {
        fetchMock.mockResolvedValueOnce(
            mockJson([
                {
                    id: 'customfield_10001',
                    name: 'Severity',
                    custom: true,
                    schema: { type: 'option' },
                },
                {
                    id: 'customfield_10002',
                    name: 'Severity',
                    custom: true,
                    schema: { type: 'option' },
                },
            ]),
        );
        await expect(resolveFieldFlags({ fieldPairs: ['Severity=High'] })).rejects.toThrow(
            /ambiguous/,
        );
    });

    it('errors on unknown reference', async () => {
        fetchMock.mockResolvedValueOnce(mockJson([]));
        await expect(resolveFieldFlags({ fieldPairs: ['nonsense=5'] })).rejects.toThrow(
            /Unknown field reference/,
        );
    });

    it('errors on malformed --field (no equals)', async () => {
        // No fetch needed — parse error happens before registry lookup
        await expect(resolveFieldFlags({ fieldPairs: ['no-equals'] })).rejects.toThrow(
            /Expected name=value/,
        );
    });

    it('errors on non-object --field-json', async () => {
        await expect(resolveFieldFlags({ fieldJson: '[1, 2]' })).rejects.toThrow(
            /must be a JSON object/,
        );
    });
});
