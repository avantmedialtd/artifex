import { describe, it, expect } from 'vitest';
import { decode } from './decoder.ts';
import type { CustomFieldDef, FieldSchemaType } from './codec-types.ts';

function def(schemaType: FieldSchemaType): CustomFieldDef {
    return { id: 'customfield_10001', name: 'F', schemaType };
}

describe('decode', () => {
    it('returns empty string for null/undefined', () => {
        expect(decode(def('number'), null)).toBe('');
        expect(decode(def('option'), undefined)).toBe('');
    });

    it('decodes number', () => {
        expect(decode(def('number'), 5)).toBe('5');
    });

    it('decodes option', () => {
        expect(decode(def('option'), { value: 'High' })).toBe('High');
    });

    it('decodes option-array', () => {
        expect(decode(def('option-array'), [{ value: 'A' }, { value: 'B' }])).toBe('A, B');
    });

    it('decodes version', () => {
        expect(decode(def('version'), { name: 'v1' })).toBe('v1');
    });

    it('decodes version-array', () => {
        expect(decode(def('version-array'), [{ name: 'v1' }, { name: 'v2' }])).toBe('v1, v2');
    });

    it('decodes user', () => {
        expect(decode(def('user'), { displayName: 'Alice', accountId: 'abc' })).toBe('Alice');
    });

    it('decodes user-array', () => {
        expect(decode(def('user-array'), [{ displayName: 'Alice' }, { displayName: 'Bob' }])).toBe(
            'Alice, Bob',
        );
    });

    it('decodes sprint name when object', () => {
        expect(decode(def('sprint'), { id: 12, name: 'Q2' })).toBe('Q2');
    });

    it('decodes sprint array', () => {
        expect(decode(def('sprint'), [{ name: 'Q1' }, { name: 'Q2' }])).toBe('Q1, Q2');
    });

    it('decodes epic-link as string', () => {
        expect(decode(def('epic-link'), 'PROJ-42')).toBe('PROJ-42');
    });

    it('falls back to JSON.stringify for unknown', () => {
        expect(decode(def('unknown'), { a: 1 })).toBe('{"a":1}');
    });

    it('decodes string', () => {
        expect(decode(def('string'), 'hi')).toBe('hi');
    });
});
