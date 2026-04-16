import { getFields, getCreateMeta } from '../client.ts';
import { getJiraCustomFieldAliases } from '../../../utils/config.ts';
import {
    FIELDS_CACHE_TTL_MS,
    CREATEMETA_CACHE_TTL_MS,
    createMetaCachePath,
    fieldsCachePath,
    invalidateCreateMetaCache,
    invalidateFieldsCache,
    readCache,
    writeCache,
} from './cache.ts';
import { mapSchemaType } from './schema.ts';
import type {
    CustomFieldDef,
    JiraCreateMetaResponse,
    JiraFieldCatalogEntry,
} from './codec-types.ts';

const CUSTOMFIELD_PATTERN = /^customfield_\d+$/;

export class Registry {
    private readonly byId = new Map<string, CustomFieldDef>();
    private readonly byAlias = new Map<string, CustomFieldDef>();
    private readonly byName = new Map<string, CustomFieldDef[]>();

    constructor(entries: CustomFieldDef[]) {
        for (const def of entries) {
            this.byId.set(def.id, def);
            if (def.alias) {
                this.byAlias.set(def.alias.toLowerCase(), def);
            }
            const nameKey = def.name.toLowerCase();
            const bucket = this.byName.get(nameKey) ?? [];
            bucket.push(def);
            this.byName.set(nameKey, bucket);
        }
    }

    all(): CustomFieldDef[] {
        return Array.from(this.byId.values());
    }

    resolve(reference: string): CustomFieldDef {
        const aliasHit = this.byAlias.get(reference.toLowerCase());
        if (aliasHit) return aliasHit;

        const nameBucket = this.byName.get(reference.toLowerCase());
        if (nameBucket && nameBucket.length === 1) {
            return nameBucket[0]!;
        }
        if (nameBucket && nameBucket.length > 1) {
            const ids = nameBucket.map(d => d.id).join(', ');
            throw new Error(
                `Field name "${reference}" is ambiguous (matches ${ids}). Use a raw id or configure an alias in af.json.`,
            );
        }

        if (CUSTOMFIELD_PATTERN.test(reference)) {
            const existing = this.byId.get(reference);
            if (existing) return existing;
            return {
                id: reference,
                name: reference,
                schemaType: 'unknown',
            };
        }

        throw new Error(
            `Unknown field reference "${reference}". Configure an alias in af.json, use the display name, or pass the raw customfield_<digits> id.`,
        );
    }

    enrichWithCreateMeta(meta: JiraCreateMetaResponse): void {
        for (const mf of meta.fields) {
            if (!mf.fieldId.startsWith('customfield_')) continue;
            const existing = this.byId.get(mf.fieldId);
            const schemaType = mapSchemaType(mf.schema);
            const allowedValues = mf.allowedValues
                ?.map(v => v.value ?? v.name ?? v.id ?? '')
                .filter((s): s is string => !!s);
            if (existing) {
                existing.required = mf.required;
                existing.allowedValues = allowedValues;
                if (existing.schemaType === 'unknown') {
                    existing.schemaType = schemaType;
                }
                if (existing.name === existing.id) {
                    existing.name = mf.name;
                }
            } else {
                this.byId.set(mf.fieldId, {
                    id: mf.fieldId,
                    name: mf.name,
                    schemaType,
                    allowedValues,
                    required: mf.required,
                });
                const bucket = this.byName.get(mf.name.toLowerCase()) ?? [];
                const already = bucket.find(d => d.id === mf.fieldId);
                if (!already) {
                    bucket.push(this.byId.get(mf.fieldId)!);
                    this.byName.set(mf.name.toLowerCase(), bucket);
                }
            }
        }
    }
}

function toDefs(
    catalog: JiraFieldCatalogEntry[],
    aliases: Record<string, { id: string; type?: CustomFieldDef['schemaType'] }>,
): CustomFieldDef[] {
    const byId = new Map<string, CustomFieldDef>();
    for (const entry of catalog) {
        if (!entry.custom) continue;
        byId.set(entry.id, {
            id: entry.id,
            name: entry.name,
            schemaType: mapSchemaType(entry.schema),
        });
    }

    for (const [alias, cfg] of Object.entries(aliases)) {
        const existing = byId.get(cfg.id);
        if (existing) {
            existing.alias = alias;
            if (cfg.type) existing.schemaType = cfg.type;
        } else {
            byId.set(cfg.id, {
                id: cfg.id,
                alias,
                name: cfg.id,
                schemaType: cfg.type ?? 'unknown',
            });
        }
    }

    return Array.from(byId.values());
}

export async function buildRegistry(options?: { refresh?: boolean }): Promise<Registry> {
    const aliases = getJiraCustomFieldAliases();
    const cachePath = fieldsCachePath();

    if (options?.refresh) {
        invalidateFieldsCache();
    }

    let catalog = readCache<JiraFieldCatalogEntry[]>(cachePath, FIELDS_CACHE_TTL_MS);
    if (!catalog) {
        catalog = await getFields();
        writeCache(cachePath, catalog);
    }

    return new Registry(toDefs(catalog, aliases));
}

export async function fetchCreateMeta(
    projectKey: string,
    issueTypeName: string,
    options?: { refresh?: boolean },
): Promise<JiraCreateMetaResponse> {
    const path = createMetaCachePath(projectKey, issueTypeName);
    if (options?.refresh) {
        invalidateCreateMetaCache(projectKey, issueTypeName);
    }
    const cached = readCache<JiraCreateMetaResponse>(path, CREATEMETA_CACHE_TTL_MS);
    if (cached) return cached;
    const fresh = await getCreateMeta(projectKey, issueTypeName);
    writeCache(path, fresh);
    return fresh;
}
