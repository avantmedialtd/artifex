import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseBitbucketRemote, resolveTarget } from './config.ts';

describe('parseBitbucketRemote', () => {
    it('parses https URL', () => {
        expect(parseBitbucketRemote('https://bitbucket.org/myws/myrepo')).toEqual({
            workspace: 'myws',
            repo: 'myrepo',
        });
    });

    it('parses https URL with .git', () => {
        expect(parseBitbucketRemote('https://bitbucket.org/myws/myrepo.git')).toEqual({
            workspace: 'myws',
            repo: 'myrepo',
        });
    });

    it('parses SSH URL', () => {
        expect(parseBitbucketRemote('git@bitbucket.org:myws/myrepo.git')).toEqual({
            workspace: 'myws',
            repo: 'myrepo',
        });
    });

    it('parses ssh:// URL', () => {
        expect(parseBitbucketRemote('ssh://git@bitbucket.org/myws/myrepo.git')).toEqual({
            workspace: 'myws',
            repo: 'myrepo',
        });
    });

    it('parses URL with hyphens and dots in repo name', () => {
        expect(parseBitbucketRemote('https://bitbucket.org/my-ws/my.repo-name.git')).toEqual({
            workspace: 'my-ws',
            repo: 'my.repo-name',
        });
    });

    it('returns null for non-bitbucket URL', () => {
        expect(parseBitbucketRemote('https://github.com/myws/myrepo.git')).toBeNull();
    });

    it('returns null for malformed URL', () => {
        expect(parseBitbucketRemote('not-a-url')).toBeNull();
    });
});

describe('resolveTarget', () => {
    let tmpDir: string;
    const originalCwd = process.cwd();

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'af-bb-test-'));
        process.chdir(tmpDir);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        rmSync(tmpDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('uses explicit flags when both provided', () => {
        writeFileSync(
            join(tmpDir, 'af.json'),
            JSON.stringify({ bitbucket: { workspace: 'fromconfig', repo: 'fromconfig' } }),
        );
        const result = resolveTarget({ workspace: 'flagws', repo: 'flagrepo' });
        expect(result).toEqual({ workspace: 'flagws', repo: 'flagrepo' });
    });

    it('falls back to af.json when no flags', () => {
        writeFileSync(
            join(tmpDir, 'af.json'),
            JSON.stringify({ bitbucket: { workspace: 'cfgws', repo: 'cfgrepo' } }),
        );
        const result = resolveTarget();
        expect(result).toEqual({ workspace: 'cfgws', repo: 'cfgrepo' });
    });

    it('throws when no resolution source is available', () => {
        // Empty tmpDir, no .git, no af.json
        expect(() => resolveTarget()).toThrow(/Could not resolve Bitbucket workspace and repo/);
    });
});
