import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    instanceSlug,
    fieldsCachePath,
    createMetaCachePath,
    readCache,
    writeCache,
    invalidateFieldsCache,
    invalidateCreateMetaCache,
    FIELDS_CACHE_TTL_MS,
} from './cache.ts';

describe('fields cache helpers', () => {
    const originalEnv = process.env;
    let tmpHome: string;

    beforeEach(() => {
        tmpHome = mkdtempSync(join(tmpdir(), 'af-fields-cache-'));
        process.env = { ...originalEnv, HOME: tmpHome };
        process.env.ATLASSIAN_BASE_URL = 'https://acme.atlassian.net/';
        process.env.ATLASSIAN_EMAIL = 'u@e.com';
        process.env.ATLASSIAN_API_TOKEN = 't';
    });

    afterEach(() => {
        rmSync(tmpHome, { recursive: true, force: true });
        process.env = originalEnv;
    });

    describe('instanceSlug', () => {
        it('slugs the hostname', () => {
            expect(instanceSlug()).toBe('acme-atlassian-net');
        });

        it('falls back to JIRA_BASE_URL when ATLASSIAN_BASE_URL is missing', () => {
            delete process.env.ATLASSIAN_BASE_URL;
            process.env.JIRA_BASE_URL = 'https://LegacyCo.atlassian.net';
            expect(instanceSlug()).toBe('legacyco-atlassian-net');
        });

        it('throws when neither is set', () => {
            delete process.env.ATLASSIAN_BASE_URL;
            delete process.env.JIRA_BASE_URL;
            expect(() => instanceSlug()).toThrow();
        });
    });

    describe('path helpers', () => {
        it('fieldsCachePath returns the per-instance path', () => {
            expect(fieldsCachePath()).toBe(
                join(tmpHome, '.cache', 'artifex', 'jira', 'acme-atlassian-net', 'fields.json'),
            );
        });

        it('createMetaCachePath slugs the issue type', () => {
            expect(createMetaCachePath('PROJ', 'User Story')).toBe(
                join(
                    tmpHome,
                    '.cache',
                    'artifex',
                    'jira',
                    'acme-atlassian-net',
                    'createmeta-PROJ-user-story.json',
                ),
            );
        });
    });

    describe('read/write round-trip', () => {
        it('writes and reads back within TTL', () => {
            const path = fieldsCachePath();
            writeCache(path, { hello: 'world' });
            const out = readCache<{ hello: string }>(path, FIELDS_CACHE_TTL_MS);
            expect(out).toEqual({ hello: 'world' });
        });

        it('returns undefined when cache does not exist', () => {
            expect(readCache(fieldsCachePath(), FIELDS_CACHE_TTL_MS)).toBeUndefined();
        });

        it('returns undefined when cache is past TTL', () => {
            const path = fieldsCachePath();
            writeCache(path, { hello: 'world' });
            const past = new Date(Date.now() - FIELDS_CACHE_TTL_MS - 60_000);
            utimesSync(path, past, past);
            expect(readCache(path, FIELDS_CACHE_TTL_MS)).toBeUndefined();
        });
    });

    describe('invalidation', () => {
        it('invalidateFieldsCache removes the file', () => {
            const path = fieldsCachePath();
            writeCache(path, { hello: 'world' });
            expect(existsSync(path)).toBe(true);
            invalidateFieldsCache();
            expect(existsSync(path)).toBe(false);
        });

        it('invalidateFieldsCache is a no-op when file is missing', () => {
            expect(() => invalidateFieldsCache()).not.toThrow();
        });

        it('invalidateCreateMetaCache removes the matching file', () => {
            const path = createMetaCachePath('PROJ', 'Story');
            writeCache(path, { fields: [] });
            expect(existsSync(path)).toBe(true);
            invalidateCreateMetaCache('PROJ', 'Story');
            expect(existsSync(path)).toBe(false);
        });
    });
});
