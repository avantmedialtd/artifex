import { describe, it, expect } from 'vitest';
import {
    groupSignalFailures,
    summarizeBuilds,
    summarizeConflicts,
    summarizeReview,
} from './signals.ts';
import type {
    BitbucketCommitStatus,
    BitbucketParticipant,
    BitbucketPullRequest,
    BitbucketUser,
    PullRequestSignals,
} from './types.ts';

function user(id: string, uuid?: string): BitbucketUser {
    return { type: 'user', account_id: id, display_name: id, ...(uuid ? { uuid } : {}) };
}

const AUTHOR = user('author');

function participant(
    who: BitbucketUser,
    state: 'approved' | 'changes_requested' | null,
    role: BitbucketParticipant['role'] = 'REVIEWER',
): BitbucketParticipant {
    return { user: who, role, approved: state === 'approved', state };
}

function pr(overrides: Partial<BitbucketPullRequest> = {}): BitbucketPullRequest {
    return {
        id: 1,
        title: 'PR',
        state: 'OPEN',
        author: AUTHOR,
        source: { branch: { name: 'feature' }, commit: { hash: 'abc123def456' } },
        destination: { branch: { name: 'main' } },
        created_on: '2026-09-01T00:00:00Z',
        updated_on: '2026-09-01T00:00:00Z',
        ...overrides,
    };
}

describe('summarizeReview', () => {
    it('returns null when participants are absent (unknown, not none)', () => {
        expect(summarizeReview(pr({ reviewers: [user('r1')] }))).toBeNull();
    });

    it('excludes the author from approvals', () => {
        const summary = summarizeReview(
            pr({
                participants: [
                    participant(user('a'), 'approved', 'PARTICIPANT'),
                    participant(user('b'), 'approved'),
                    participant(AUTHOR, 'approved', 'PARTICIPANT'),
                ],
            }),
        );
        expect(summary).toEqual({ approvals: 2, changesRequested: 0, pending: 0 });
    });

    it('excludes the author from change requests', () => {
        const summary = summarizeReview(
            pr({ participants: [participant(AUTHOR, 'changes_requested', 'PARTICIPANT')] }),
        );
        expect(summary).toEqual({ approvals: 0, changesRequested: 0, pending: 0 });
    });

    it('counts one approval and one change request', () => {
        const r1 = user('r1');
        const r2 = user('r2');
        const summary = summarizeReview(
            pr({
                reviewers: [r1, r2],
                participants: [participant(r1, 'approved'), participant(r2, 'changes_requested')],
            }),
        );
        expect(summary).toEqual({ approvals: 1, changesRequested: 1, pending: 0 });
    });

    it('counts reviewers who have not responded as pending', () => {
        const [r1, r2, r3] = [user('r1'), user('r2'), user('r3')];
        const summary = summarizeReview(
            pr({
                reviewers: [r1, r2, r3],
                participants: [participant(r1, 'approved'), participant(r2, null)],
            }),
        );
        expect(summary).toEqual({ approvals: 1, changesRequested: 0, pending: 2 });
    });

    it('does not count a participant who only commented as pending', () => {
        const summary = summarizeReview(
            pr({ reviewers: [], participants: [participant(user('c'), null, 'PARTICIPANT')] }),
        );
        expect(summary).toEqual({ approvals: 0, changesRequested: 0, pending: 0 });
    });

    it('treats a reviewer who requested changes as responded, not pending', () => {
        const r1 = user('r1');
        const summary = summarizeReview(
            pr({ reviewers: [r1], participants: [participant(r1, 'changes_requested')] }),
        );
        expect(summary).toEqual({ approvals: 0, changesRequested: 1, pending: 0 });
    });

    it('reports all zeros when there is no review activity', () => {
        expect(summarizeReview(pr({ participants: [] }))).toEqual({
            approvals: 0,
            changesRequested: 0,
            pending: 0,
        });
    });

    it('matches accounts by uuid when account_id is missing', () => {
        // Deleted or legacy accounts can come back without an account_id.
        const reviewer = { type: 'user', display_name: 'R', uuid: '{r}' } as BitbucketUser;
        const same = { type: 'user', display_name: 'R', uuid: '{r}' } as BitbucketUser;
        const summary = summarizeReview(
            pr({ reviewers: [reviewer], participants: [participant(same, 'approved')] }),
        );
        expect(summary).toEqual({ approvals: 1, changesRequested: 0, pending: 0 });
    });

    it('matches by account_id before uuid', () => {
        // Same uuid but different account ids: different accounts.
        const r1 = user('r1', '{shared}');
        const other = user('other', '{shared}');
        const summary = summarizeReview(
            pr({ reviewers: [r1], participants: [participant(other, 'approved')] }),
        );
        expect(summary).toEqual({ approvals: 1, changesRequested: 0, pending: 1 });
    });
});

describe('summarizeBuilds', () => {
    const HEAD_FULL = 'abc123def4567890abc123def4567890abc123de';
    const OLD_FULL = '999999999999aaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    function status(
        state: BitbucketCommitStatus['state'],
        hash?: string,
        key = state.toLowerCase(),
    ): BitbucketCommitStatus {
        return { key, state, ...(hash !== undefined ? { commit: { hash } } : {}) };
    }

    it('reflects only the head commit (short head hash, full status hash)', () => {
        const summary = summarizeBuilds(
            [status('FAILED', OLD_FULL), status('SUCCESSFUL', HEAD_FULL)],
            'abc123def456',
        );
        expect(summary).toEqual({ state: 'passed', count: 1 });
    });

    it('prefix-matches in either direction (full head hash, short status hash)', () => {
        const summary = summarizeBuilds(
            [status('FAILED', '999999999999'), status('SUCCESSFUL', 'abc123def456')],
            HEAD_FULL,
        );
        expect(summary).toEqual({ state: 'passed', count: 1 });
    });

    it('keeps a status without a commit without disabling head filtering', () => {
        const summary = summarizeBuilds(
            [status('FAILED', OLD_FULL), status('SUCCESSFUL')],
            'abc123def456',
        );
        expect(summary).toEqual({ state: 'passed', count: 1 });
    });

    it('uses every status when the head hash is unknown', () => {
        const statuses = [status('FAILED', OLD_FULL), status('SUCCESSFUL', HEAD_FULL)];
        expect(summarizeBuilds(statuses, undefined)).toEqual({ state: 'failed', count: 1 });
    });

    it('reports a failed build on the head commit', () => {
        const summary = summarizeBuilds(
            [status('FAILED', HEAD_FULL), status('SUCCESSFUL', HEAD_FULL)],
            'abc123def456',
        );
        expect(summary).toEqual({ state: 'failed', count: 1 });
    });

    it('reports a stopped build when nothing failed', () => {
        const summary = summarizeBuilds(
            [status('STOPPED', HEAD_FULL), status('SUCCESSFUL', HEAD_FULL)],
            'abc123def456',
        );
        expect(summary).toEqual({ state: 'stopped', count: 1 });
    });

    it('reports a running build when nothing failed or stopped', () => {
        const summary = summarizeBuilds(
            [status('INPROGRESS', HEAD_FULL), status('SUCCESSFUL', HEAD_FULL)],
            'abc123def456',
        );
        expect(summary).toEqual({ state: 'running', count: 1 });
    });

    it('applies the precedence FAILED > STOPPED > INPROGRESS', () => {
        const summary = summarizeBuilds(
            [
                status('INPROGRESS', HEAD_FULL, 'a'),
                status('STOPPED', HEAD_FULL, 'b'),
                status('FAILED', HEAD_FULL, 'c'),
                status('FAILED', HEAD_FULL, 'd'),
            ],
            'abc123def456',
        );
        expect(summary).toEqual({ state: 'failed', count: 2 });
    });

    it('counts every passed status when all succeeded', () => {
        const summary = summarizeBuilds(
            [status('SUCCESSFUL', HEAD_FULL, 'a'), status('SUCCESSFUL', HEAD_FULL, 'b')],
            'abc123def456',
        );
        expect(summary).toEqual({ state: 'passed', count: 2 });
    });

    it('reports none when the head commit has no statuses', () => {
        expect(summarizeBuilds([status('FAILED', OLD_FULL)], 'abc123def456')).toEqual({
            state: 'none',
            count: 0,
        });
        expect(summarizeBuilds([], 'abc123def456')).toEqual({ state: 'none', count: 0 });
    });
});

describe('summarizeConflicts', () => {
    const conflict = (path: string) => ({ path, scenario: 'content', message: 'conflict' });

    it('counts the entries on the page', () => {
        expect(summarizeConflicts({ values: [conflict('a'), conflict('b')] })).toEqual({
            count: 2,
            more: false,
        });
    });

    it('reports no conflicts for an empty page', () => {
        expect(summarizeConflicts({ values: [] })).toEqual({ count: 0, more: false });
        expect(summarizeConflicts({})).toEqual({ count: 0, more: false });
    });

    it('prefers size over the page length', () => {
        expect(
            summarizeConflicts({ values: [conflict('a')], size: 7, next: 'https://x/2' }),
        ).toEqual({ count: 7, more: false });
    });

    it('marks more when next exists without size', () => {
        expect(summarizeConflicts({ values: [conflict('a')], next: 'https://x/2' })).toEqual({
            count: 1,
            more: true,
        });
    });
});

describe('groupSignalFailures', () => {
    const ok: PullRequestSignals = { builds: { value: [] }, conflicts: { value: { values: [] } } };

    function failing(
        signal: keyof PullRequestSignals,
        error: { status?: number; message: string },
    ): PullRequestSignals {
        return { ...ok, [signal]: { error } };
    }

    it('returns no lines when nothing failed', () => {
        expect(groupSignalFailures([ok, null, ok])).toEqual([]);
    });

    it('ignores null entries (pull requests that were not checked)', () => {
        expect(groupSignalFailures([null, null])).toEqual([]);
    });

    it('names the signal, the HTTP status and a sample message', () => {
        const lines = groupSignalFailures([
            ok,
            failing('conflicts', { status: 403, message: 'Forbidden' }),
            null,
        ]);
        expect(lines).toEqual([
            'Warning: conflicts unavailable for 1 pull request (HTTP 403: Forbidden)',
        ]);
    });

    it('collapses repeated failures into one line with the count', () => {
        const signals = Array.from({ length: 12 }, () =>
            failing('conflicts', { status: 401, message: 'Unauthorized' }),
        );
        expect(groupSignalFailures([...signals, null])).toEqual([
            'Warning: conflicts unavailable for 12 pull requests (HTTP 401: Unauthorized)',
        ]);
    });

    it('groups HTTP failures by status, keeping one sample message', () => {
        const lines = groupSignalFailures([
            failing('builds', { status: 429, message: 'Rate limit exceeded' }),
            failing('builds', { status: 429, message: 'Too many requests' }),
            failing('builds', { status: 500, message: 'Server error' }),
        ]);
        expect(lines).toEqual([
            'Warning: builds unavailable for 2 pull requests (HTTP 429: Rate limit exceeded)',
            'Warning: builds unavailable for 1 pull request (HTTP 500: Server error)',
        ]);
    });

    it('groups non-HTTP failures by message', () => {
        const lines = groupSignalFailures([
            failing('builds', { message: 'fetch failed' }),
            failing('builds', { message: 'fetch failed' }),
            failing('builds', { message: 'no API URL' }),
        ]);
        expect(lines).toEqual([
            'Warning: builds unavailable for 2 pull requests (fetch failed)',
            'Warning: builds unavailable for 1 pull request (no API URL)',
        ]);
    });

    it('keeps signals apart and does not repeat a status the message leads with', () => {
        const both: PullRequestSignals = {
            builds: { error: { status: 404, message: 'HTTP 404: Not Found' } },
            conflicts: { error: { status: 404, message: 'HTTP 404: Not Found' } },
        };
        expect(groupSignalFailures([both])).toEqual([
            'Warning: builds unavailable for 1 pull request (HTTP 404: Not Found)',
            'Warning: conflicts unavailable for 1 pull request (HTTP 404: Not Found)',
        ]);
    });

    it('keeps each warning on a single line', () => {
        const lines = groupSignalFailures([
            failing('conflicts', { status: 400, message: 'first\nsecond' }),
        ]);
        expect(lines).toEqual([
            'Warning: conflicts unavailable for 1 pull request (HTTP 400: first second)',
        ]);
    });
});
