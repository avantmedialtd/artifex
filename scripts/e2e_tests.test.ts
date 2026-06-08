import { describe, expect, it } from 'vitest';
import { computeVerdict } from './e2e_tests.ts';

describe('computeVerdict', () => {
    it('passes when the exit code is 0 and the summary reports no failures', () => {
        const verdict = computeVerdict(0, { passed: 12, failed: 0, timedOut: 0, skipped: 3 });
        expect(verdict.failed).toBe(false);
    });

    it('fails when the exit code is 0 but the reporter saw a failure (the observed false-green)', () => {
        const verdict = computeVerdict(0, { passed: 1265, failed: 1, timedOut: 0, skipped: 67 });
        expect(verdict.failed).toBe(true);
    });

    it('fails closed when the summary is missing', () => {
        const verdict = computeVerdict(0, null);
        expect(verdict.failed).toBe(true);
        expect(verdict.reason).toMatch(/cross-check/i);
    });

    it('fails on a non-zero exit code even when the summary reports no failures', () => {
        const verdict = computeVerdict(1, { passed: 10, failed: 0, timedOut: 0, skipped: 0 });
        expect(verdict.failed).toBe(true);
    });

    it('fails when only timeouts are reported', () => {
        const verdict = computeVerdict(0, { passed: 5, failed: 0, timedOut: 2, skipped: 0 });
        expect(verdict.failed).toBe(true);
    });
});
