import { findUser } from '../client.ts';
import type { CustomFieldDef } from './codec-types.ts';

const warnedTypes = new Set<string>();

export interface UserResolver {
    resolve(emailOrName: string): Promise<string>;
}

async function defaultResolveUser(query: string): Promise<string> {
    const users = await findUser(query);
    if (users.length === 0) {
        throw new Error(`No Jira user matched "${query}"`);
    }
    const byEmail = users.find(u => u.emailAddress?.toLowerCase() === query.toLowerCase());
    if (byEmail) return byEmail.accountId;
    if (users.length === 1) return users[0]!.accountId;
    const names = users.map(u => u.displayName).join(', ');
    throw new Error(
        `Multiple Jira users matched "${query}": ${names}. Use an email for exact match.`,
    );
}

function splitList(raw: string): string[] {
    return raw
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

function warnUnknown(def: CustomFieldDef): void {
    if (warnedTypes.has(def.id)) return;
    warnedTypes.add(def.id);
    process.stderr.write(
        `warn: field "${def.name}" (${def.id}) has unrecognized schema type; passing value through as-is\n`,
    );
}

export async function encode(
    def: CustomFieldDef,
    raw: string,
    resolveUser: (q: string) => Promise<string> = defaultResolveUser,
): Promise<unknown> {
    if (raw === '') return null;

    switch (def.schemaType) {
        case 'number': {
            const n = Number(raw);
            if (Number.isNaN(n)) {
                throw new Error(`Field "${def.name}" expects a number, got ${JSON.stringify(raw)}`);
            }
            return n;
        }
        case 'string':
            return raw;
        case 'date':
            return raw;
        case 'datetime':
            return raw;
        case 'option':
            return { value: raw };
        case 'option-array':
            return splitList(raw).map(v => ({ value: v }));
        case 'version':
            return { name: raw };
        case 'version-array':
            return splitList(raw).map(v => ({ name: v }));
        case 'user': {
            const accountId = await resolveUser(raw);
            return { accountId };
        }
        case 'user-array': {
            const parts = splitList(raw);
            const ids = await Promise.all(parts.map(p => resolveUser(p)));
            return ids.map(accountId => ({ accountId }));
        }
        case 'sprint': {
            const n = Number(raw);
            if (!Number.isInteger(n)) {
                throw new Error(
                    `Sprint field "${def.name}" expects a numeric sprint ID, got ${JSON.stringify(raw)}`,
                );
            }
            return n;
        }
        case 'epic-link':
            return raw;
        case 'unknown':
        default:
            warnUnknown(def);
            return raw;
    }
}

export function __resetEncoderWarnings(): void {
    warnedTypes.clear();
}
