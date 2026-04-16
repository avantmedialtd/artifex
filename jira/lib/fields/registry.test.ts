import { describe, it, expect } from 'vitest';
import { Registry } from './registry.ts';
import type { CustomFieldDef, JiraCreateMetaResponse } from './codec-types.ts';

function def(partial: Partial<CustomFieldDef> & { id: string; name: string }): CustomFieldDef {
    return { schemaType: 'unknown', ...partial };
}

describe('Registry.resolve', () => {
    it('resolves an alias before display name', () => {
        const r = new Registry([
            def({
                id: 'customfield_10016',
                alias: 'storyPoints',
                name: 'Story Points',
                schemaType: 'number',
            }),
        ]);
        const hit = r.resolve('storyPoints');
        expect(hit.id).toBe('customfield_10016');
    });

    it('matches display name case-insensitively', () => {
        const r = new Registry([
            def({ id: 'customfield_10016', name: 'Story Points', schemaType: 'number' }),
        ]);
        expect(r.resolve('story points').id).toBe('customfield_10016');
        expect(r.resolve('STORY POINTS').id).toBe('customfield_10016');
    });

    it('errors on ambiguous display name with candidate ids', () => {
        const r = new Registry([
            def({ id: 'customfield_10001', name: 'Severity', schemaType: 'option' }),
            def({ id: 'customfield_10002', name: 'Severity', schemaType: 'option' }),
        ]);
        expect(() => r.resolve('Severity')).toThrow(
            /ambiguous.*customfield_10001.*customfield_10002/,
        );
    });

    it('passes through a raw customfield id not in the registry', () => {
        const r = new Registry([]);
        const hit = r.resolve('customfield_99999');
        expect(hit.id).toBe('customfield_99999');
        expect(hit.schemaType).toBe('unknown');
    });

    it('returns the registered def when the raw id exists', () => {
        const r = new Registry([
            def({ id: 'customfield_10016', name: 'Story Points', schemaType: 'number' }),
        ]);
        expect(r.resolve('customfield_10016').schemaType).toBe('number');
    });

    it('errors on an unknown reference', () => {
        const r = new Registry([]);
        expect(() => r.resolve('storyPoints')).toThrow(/Unknown field reference/);
    });
});

describe('Registry.enrichWithCreateMeta', () => {
    it('layers required + allowedValues onto existing entries', () => {
        const r = new Registry([
            def({ id: 'customfield_10099', name: 'Severity', schemaType: 'option' }),
        ]);
        const meta: JiraCreateMetaResponse = {
            fields: [
                {
                    fieldId: 'customfield_10099',
                    name: 'Severity',
                    required: true,
                    schema: { type: 'option' },
                    allowedValues: [{ value: 'Low' }, { value: 'High' }],
                },
            ],
        };
        r.enrichWithCreateMeta(meta);
        const d = r.resolve('customfield_10099');
        expect(d.required).toBe(true);
        expect(d.allowedValues).toEqual(['Low', 'High']);
    });

    it('adds unknown custom fields discovered via createmeta', () => {
        const r = new Registry([]);
        r.enrichWithCreateMeta({
            fields: [
                {
                    fieldId: 'customfield_20000',
                    name: 'Release Note',
                    required: false,
                    schema: { type: 'string' },
                },
            ],
        });
        const d = r.resolve('customfield_20000');
        expect(d.name).toBe('Release Note');
        expect(d.schemaType).toBe('string');
    });
});
