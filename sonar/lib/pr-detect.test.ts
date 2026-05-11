import { describe, it, expect } from 'vitest';
import { detectPullRequestForCurrentBranch, explainDetectFailure } from './pr-detect.ts';
import type { BitbucketPullRequest } from '../../bitbucket/lib/types.ts';

function pr(id: number, title: string): BitbucketPullRequest {
    return {
        id,
        title,
        state: 'OPEN',
        author: { account_id: 'a', display_name: 'a' },
        source: { branch: { name: 'b' } },
        destination: { branch: { name: 'main' } },
        created_on: '',
        updated_on: '',
    } as BitbucketPullRequest;
}

describe('detectPullRequestForCurrentBranch', () => {
    it('returns single when exactly one PR is open for the branch', async () => {
        const result = await detectPullRequestForCurrentBranch({
            getCurrentBranch: () => 'feature/x',
            listOpenPRsForBranch: async () => [pr(42, 'Add feature x')],
        });
        expect(result).toEqual({
            kind: 'single',
            id: 42,
            title: 'Add feature x',
            branch: 'feature/x',
        });
    });

    it('returns none when no PRs are open for the branch', async () => {
        const result = await detectPullRequestForCurrentBranch({
            getCurrentBranch: () => 'feature/x',
            listOpenPRsForBranch: async () => [],
        });
        expect(result).toEqual({ kind: 'none', branch: 'feature/x' });
    });

    it('returns ambiguous when multiple PRs are open for the branch', async () => {
        const result = await detectPullRequestForCurrentBranch({
            getCurrentBranch: () => 'feature/x',
            listOpenPRsForBranch: async () => [pr(42, 'A'), pr(43, 'B')],
        });
        expect(result.kind).toBe('ambiguous');
        if (result.kind === 'ambiguous') {
            expect(result.candidates).toEqual([
                { id: 42, title: 'A' },
                { id: 43, title: 'B' },
            ]);
        }
    });

    it('returns no-branch when git returns null branch', async () => {
        const result = await detectPullRequestForCurrentBranch({
            getCurrentBranch: () => null,
            listOpenPRsForBranch: async () => [],
        });
        expect(result).toEqual({ kind: 'no-branch' });
    });

    it('maps Bitbucket credentials-not-set errors to no-credentials', async () => {
        const result = await detectPullRequestForCurrentBranch({
            getCurrentBranch: () => 'feature/x',
            listOpenPRsForBranch: async () => {
                throw new Error('Bitbucket credentials not set. BITBUCKET_API_TOKEN required');
            },
        });
        expect(result).toEqual({ kind: 'no-credentials' });
    });

    it('maps other failures to error', async () => {
        const result = await detectPullRequestForCurrentBranch({
            getCurrentBranch: () => 'feature/x',
            listOpenPRsForBranch: async () => {
                throw new Error('network down');
            },
        });
        expect(result).toEqual({ kind: 'error', message: 'network down' });
    });
});

describe('explainDetectFailure', () => {
    it('explains none with a hint to pass id explicitly', () => {
        const msg = explainDetectFailure({ kind: 'none', branch: 'b' });
        expect(msg).toContain("branch 'b'");
        expect(msg).toContain('af sonar pr <id>');
    });

    it('explains ambiguous with the candidate list', () => {
        const msg = explainDetectFailure({
            kind: 'ambiguous',
            branch: 'b',
            candidates: [
                { id: 1, title: 'A' },
                { id: 2, title: 'B' },
            ],
        });
        expect(msg).toContain('#1');
        expect(msg).toContain('#2');
        expect(msg).toContain('A');
    });

    it('explains no-credentials with BITBUCKET_API_TOKEN', () => {
        const msg = explainDetectFailure({ kind: 'no-credentials' });
        expect(msg).toContain('BITBUCKET_API_TOKEN');
    });

    it('explains no-branch', () => {
        const msg = explainDetectFailure({ kind: 'no-branch' });
        expect(msg).toContain('detached HEAD');
    });

    it('explains generic error', () => {
        const msg = explainDetectFailure({ kind: 'error', message: 'boom' });
        expect(msg).toContain('boom');
    });
});
