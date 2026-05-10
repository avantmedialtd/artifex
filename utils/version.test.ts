import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getVersion } from './version.ts';

describe('getVersion', () => {
    it('returns the version declared in package.json', () => {
        const pkgPath = join(import.meta.dirname, '..', 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        expect(getVersion()).toBe(pkg.version);
    });

    it('returns a non-empty semver-shaped string', () => {
        expect(getVersion()).toMatch(/^\d+\.\d+\.\d+/);
    });
});
