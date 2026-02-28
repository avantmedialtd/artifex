import { describe, it, expect } from 'vitest';
import { resolveJobPath, resolveBuildNumber } from './request.ts';

describe('resolveJobPath', () => {
    it('should resolve a simple job name', () => {
        expect(resolveJobPath('my-app')).toBe('/job/my-app');
    });

    it('should resolve a nested path', () => {
        expect(resolveJobPath('org/team/my-app')).toBe('/job/org/job/team/job/my-app');
    });

    it('should resolve a multibranch pipeline branch', () => {
        expect(resolveJobPath('my-pipeline/feature/auth')).toBe(
            '/job/my-pipeline/job/feature/job/auth',
        );
    });

    it('should encode special characters in path segments', () => {
        expect(resolveJobPath('my-pipeline/my branch')).toBe('/job/my-pipeline/job/my%20branch');
    });
});

describe('resolveBuildNumber', () => {
    it('should return lastBuild when no argument given', () => {
        expect(resolveBuildNumber()).toBe('lastBuild');
        expect(resolveBuildNumber(undefined)).toBe('lastBuild');
    });

    it('should return lastBuild for "latest" keyword', () => {
        expect(resolveBuildNumber('latest')).toBe('lastBuild');
    });

    it('should return numeric build number as-is', () => {
        expect(resolveBuildNumber('142')).toBe('142');
    });
});
