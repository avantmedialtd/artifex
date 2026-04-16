import { buildRegistry, type Registry } from './registry.ts';
import { encode } from './encoder.ts';

export interface FieldFlagInputs {
    fieldPairs?: string[];
    fieldJson?: string;
    refresh?: boolean;
}

export interface ResolvedFieldFlags {
    customFields: Record<string, unknown>;
    registry: Registry;
}

function parsePair(pair: string): { name: string; raw: string } {
    const eq = pair.indexOf('=');
    if (eq === -1) {
        throw new Error(`Invalid --field value "${pair}". Expected name=value.`);
    }
    return { name: pair.slice(0, eq), raw: pair.slice(eq + 1) };
}

function parseJsonFlag(value: string | undefined): Record<string, unknown> {
    if (value === undefined) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch (err) {
        throw new Error(
            `Invalid --field-json value: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('--field-json must be a JSON object');
    }
    return parsed as Record<string, unknown>;
}

export async function resolveFieldFlags(
    inputs: FieldFlagInputs,
): Promise<ResolvedFieldFlags | undefined> {
    const hasPairs = inputs.fieldPairs && inputs.fieldPairs.length > 0;
    const hasJson = inputs.fieldJson !== undefined;
    if (!hasPairs && !hasJson) return undefined;

    // Validate shapes before touching the network.
    const parsedPairs = hasPairs ? inputs.fieldPairs!.map(parsePair) : [];
    const jsonObj = hasJson ? parseJsonFlag(inputs.fieldJson) : {};

    const registry = await buildRegistry({ refresh: inputs.refresh });
    const customFields: Record<string, unknown> = {};

    for (const { name, raw } of parsedPairs) {
        const def = registry.resolve(name);
        customFields[def.id] = await encode(def, raw);
    }

    for (const [key, value] of Object.entries(jsonObj)) {
        customFields[key] = value;
    }

    return { customFields, registry };
}
