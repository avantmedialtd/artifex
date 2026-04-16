import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

function resolveHome(): string {
    return process.env.HOME || process.env.USERPROFILE || homedir();
}

export const FIELDS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const CREATEMETA_CACHE_TTL_MS = 60 * 60 * 1000;

export function instanceSlug(): string {
    const base = process.env.ATLASSIAN_BASE_URL || process.env.JIRA_BASE_URL;
    if (!base) {
        throw new Error(
            'ATLASSIAN_BASE_URL (or legacy JIRA_BASE_URL) must be set to resolve cache path',
        );
    }
    let host: string;
    try {
        host = new URL(base).hostname;
    } catch {
        host = base.replace(/^https?:\/\//, '').split('/')[0] ?? base;
    }
    return host.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function jiraCacheDir(): string {
    return join(resolveHome(), '.cache', 'artifex', 'jira', instanceSlug());
}

export function fieldsCachePath(): string {
    return join(jiraCacheDir(), 'fields.json');
}

export function createMetaCachePath(projectKey: string, issueTypeName: string): string {
    const typeSlug = issueTypeName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return join(jiraCacheDir(), `createmeta-${projectKey}-${typeSlug}.json`);
}

export function readCache<T>(path: string, ttlMs: number): T | undefined {
    if (!existsSync(path)) return undefined;
    const stat = statSync(path);
    if (Date.now() - stat.mtimeMs > ttlMs) return undefined;
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as T;
}

export function writeCache<T>(path: string, value: T): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
}

export function invalidateFieldsCache(): void {
    const path = fieldsCachePath();
    if (existsSync(path)) unlinkSync(path);
}

export function invalidateCreateMetaCache(projectKey: string, issueTypeName: string): void {
    const path = createMetaCachePath(projectKey, issueTypeName);
    if (existsSync(path)) unlinkSync(path);
}
