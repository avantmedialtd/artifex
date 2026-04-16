import type { CustomFieldDef } from './codec-types.ts';

type Named = { value?: string; name?: string; displayName?: string };

function asString(v: unknown): string {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return JSON.stringify(v);
}

function decodeOption(value: unknown): string {
    if (value && typeof value === 'object') {
        const v = value as Named;
        return v.value ?? v.name ?? JSON.stringify(value);
    }
    return asString(value);
}

function decodeVersion(value: unknown): string {
    if (value && typeof value === 'object') {
        const v = value as Named;
        return v.name ?? v.value ?? JSON.stringify(value);
    }
    return asString(value);
}

function decodeUser(value: unknown): string {
    if (value && typeof value === 'object') {
        const v = value as Named & { emailAddress?: string };
        return v.displayName ?? v.emailAddress ?? JSON.stringify(value);
    }
    return asString(value);
}

function decodeSprint(value: unknown): string {
    if (value && typeof value === 'object') {
        const v = value as { name?: string; id?: number };
        if (v.name) return v.name;
        if (v.id !== undefined) return String(v.id);
    }
    if (typeof value === 'number') return String(value);
    return asString(value);
}

export function decode(def: CustomFieldDef, value: unknown): string {
    if (value === null || value === undefined) return '';

    switch (def.schemaType) {
        case 'number':
            return typeof value === 'number' ? String(value) : asString(value);
        case 'string':
            return asString(value);
        case 'date':
        case 'datetime':
            return asString(value);
        case 'option':
            return decodeOption(value);
        case 'option-array':
            return Array.isArray(value) ? value.map(decodeOption).join(', ') : asString(value);
        case 'version':
            return decodeVersion(value);
        case 'version-array':
            return Array.isArray(value) ? value.map(decodeVersion).join(', ') : asString(value);
        case 'user':
            return decodeUser(value);
        case 'user-array':
            return Array.isArray(value) ? value.map(decodeUser).join(', ') : asString(value);
        case 'sprint':
            return Array.isArray(value) ? value.map(decodeSprint).join(', ') : decodeSprint(value);
        case 'epic-link':
            return asString(value);
        case 'unknown':
        default:
            return JSON.stringify(value);
    }
}
