import { describe, expect, it } from 'vitest';
import { compare, format, nextVersion, parseSemVer } from './bump-version.ts';

describe('parseSemVer', () => {
    it('parses a dotted triple', () => {
        expect(parseSemVer('1.2.3')).toEqual([1, 2, 3]);
    });

    it('rejects non-semver input', () => {
        expect(parseSemVer('1.2')).toBeNull();
        expect(parseSemVer('v1.2.3')).toBeNull();
        expect(parseSemVer('1.2.3-rc.1')).toBeNull();
        expect(parseSemVer('abc')).toBeNull();
    });
});

describe('nextVersion', () => {
    it('bumps the patch component', () => {
        expect(format(nextVersion([0, 0, 18], 'patch'))).toBe('0.0.19');
    });

    it('bumps minor and resets patch', () => {
        expect(format(nextVersion([0, 0, 18], 'minor'))).toBe('0.1.0');
    });

    it('bumps major and resets minor + patch', () => {
        expect(format(nextVersion([0, 3, 5], 'major'))).toBe('1.0.0');
    });

    it('accepts an explicit x.y.z', () => {
        expect(format(nextVersion([0, 0, 18], '2.5.1'))).toBe('2.5.1');
    });

    it('throws on a non-semver bump argument', () => {
        expect(() => nextVersion([0, 0, 18], 'nope')).toThrow();
    });
});

describe('compare', () => {
    it('orders versions and detects a downgrade', () => {
        expect(compare([0, 0, 19], [0, 0, 18])).toBeGreaterThan(0);
        expect(compare([0, 0, 18], [0, 0, 18])).toBe(0);
        expect(compare([0, 0, 17], [0, 0, 18])).toBeLessThan(0);
        expect(compare([1, 0, 0], [0, 9, 9])).toBeGreaterThan(0);
    });
});
