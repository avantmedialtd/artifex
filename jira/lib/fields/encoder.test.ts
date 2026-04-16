import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encode, __resetEncoderWarnings } from './encoder.ts';
import type { CustomFieldDef, FieldSchemaType } from './codec-types.ts';

function def(schemaType: FieldSchemaType): CustomFieldDef {
    return { id: 'customfield_10001', name: 'F', schemaType };
}

describe('encode', () => {
    beforeEach(() => {
        __resetEncoderWarnings();
    });

    it('returns null for empty string regardless of type', async () => {
        expect(await encode(def('number'), '')).toBeNull();
        expect(await encode(def('option'), '')).toBeNull();
        expect(await encode(def('user'), '', async () => 'x')).toBeNull();
    });

    it('encodes number', async () => {
        expect(await encode(def('number'), '5')).toBe(5);
    });

    it('throws on non-numeric input for number field', async () => {
        await expect(encode(def('number'), 'abc')).rejects.toThrow(/expects a number/);
    });

    it('encodes string/date/datetime as raw', async () => {
        expect(await encode(def('string'), 'hello')).toBe('hello');
        expect(await encode(def('date'), '2026-04-16')).toBe('2026-04-16');
        expect(await encode(def('datetime'), '2026-04-16T10:00:00Z')).toBe('2026-04-16T10:00:00Z');
    });

    it('encodes option and option-array', async () => {
        expect(await encode(def('option'), 'High')).toEqual({ value: 'High' });
        expect(await encode(def('option-array'), 'A, B, C')).toEqual([
            { value: 'A' },
            { value: 'B' },
            { value: 'C' },
        ]);
    });

    it('encodes version and version-array', async () => {
        expect(await encode(def('version'), 'v1.0')).toEqual({ name: 'v1.0' });
        expect(await encode(def('version-array'), 'v1,v2')).toEqual([
            { name: 'v1' },
            { name: 'v2' },
        ]);
    });

    it('encodes user via resolver', async () => {
        const resolver = async (q: string) => `id-${q}`;
        expect(await encode(def('user'), 'alice@ex.com', resolver)).toEqual({
            accountId: 'id-alice@ex.com',
        });
    });

    it('encodes user-array via resolver', async () => {
        const resolver = async (q: string) => `id-${q}`;
        expect(await encode(def('user-array'), 'a@x,b@x', resolver)).toEqual([
            { accountId: 'id-a@x' },
            { accountId: 'id-b@x' },
        ]);
    });

    it('propagates resolver failure', async () => {
        const resolver = async () => {
            throw new Error('no match');
        };
        await expect(encode(def('user'), 'nobody', resolver)).rejects.toThrow(/no match/);
    });

    it('encodes sprint as number', async () => {
        expect(await encode(def('sprint'), '12345')).toBe(12345);
    });

    it('rejects non-integer sprint', async () => {
        await expect(encode(def('sprint'), 'Q2')).rejects.toThrow(/numeric sprint ID/);
    });

    it('encodes epic-link as issue key string', async () => {
        expect(await encode(def('epic-link'), 'PROJ-42')).toBe('PROJ-42');
    });

    it('unknown type passes through and warns to stderr once', async () => {
        const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        expect(await encode(def('unknown'), 'weird')).toBe('weird');
        expect(await encode(def('unknown'), 'again')).toBe('again');
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });
});
