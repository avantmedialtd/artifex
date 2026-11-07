import { describe, it, expect } from 'vitest';
import { buildPullRequestUpdate, type PullRequestChanges } from './update.ts';
import type { BitbucketPullRequest, BitbucketUser } from './types.ts';

const user = (accountId: string): BitbucketUser => ({
    type: 'user',
    account_id: accountId,
    nickname: accountId,
    display_name: `User ${accountId}`,
    uuid: `{${accountId}-uuid}`,
});

/** An open pull request that is not a draft, with a description and reviewers a1 and a2. */
function pullRequest(overrides: Partial<BitbucketPullRequest> = {}): BitbucketPullRequest {
    return {
        id: 42,
        title: 'Current title',
        description: 'Current description',
        state: 'OPEN',
        draft: false,
        author: user('author'),
        source: { branch: { name: 'feature/x' } },
        destination: { branch: { name: 'main' } },
        reviewers: [user('a1'), user('a2')],
        created_on: '2026-11-01T00:00:00Z',
        updated_on: '2026-11-02T00:00:00Z',
        ...overrides,
    };
}

const draftPullRequest = (): BitbucketPullRequest => pullRequest({ draft: true });

/** The current reviewers as the PUT resends them: account ids only. */
const CURRENT_REVIEWERS = [{ account_id: 'a1' }, { account_id: 'a2' }];

/** The body of a `put` result; fails the test on a no-op. */
function putBody(current: BitbucketPullRequest, changes: PullRequestChanges) {
    const result = buildPullRequestUpdate(current, changes);
    if (result.kind !== 'put') throw new Error(`expected a put, got ${JSON.stringify(result)}`);
    return result.body;
}

describe('buildPullRequestUpdate', () => {
    // The spike did not run; the user chose to resend title, description and
    // reviewers on every PUT (see the comment above buildPullRequestUpdate).
    describe('resends the unchanged title, description and reviewers', () => {
        it('a title change keeps the current description and reviewers', () => {
            expect(buildPullRequestUpdate(pullRequest(), { title: 'New title' })).toStrictEqual({
                kind: 'put',
                body: {
                    title: 'New title',
                    description: 'Current description',
                    reviewers: CURRENT_REVIEWERS,
                },
            });
        });

        it('a description change keeps the current title and reviewers', () => {
            expect(putBody(pullRequest(), { description: 'New description' })).toStrictEqual({
                title: 'Current title',
                description: 'New description',
                reviewers: CURRENT_REVIEWERS,
            });
        });

        it('a reviewers change keeps the current title and description', () => {
            expect(putBody(pullRequest(), { reviewerAccountIds: ['a3'] })).toStrictEqual({
                title: 'Current title',
                description: 'Current description',
                reviewers: [{ account_id: 'a3' }],
            });
        });

        it('marking a draft ready keeps the current title, description and reviewers', () => {
            expect(putBody(draftPullRequest(), { draft: false })).toStrictEqual({
                title: 'Current title',
                description: 'Current description',
                reviewers: CURRENT_REVIEWERS,
                draft: false,
            });
        });

        it('resends a missing description as the empty string', () => {
            const current = pullRequest();
            delete current.description;
            expect(putBody(current, { title: 'New title' })).toStrictEqual({
                title: 'New title',
                description: '',
                reviewers: CURRENT_REVIEWERS,
            });
        });

        it('resends an empty reviewer list when the pull request has no reviewers', () => {
            expect(putBody(pullRequest({ reviewers: [] }), { title: 'New title' })).toStrictEqual({
                title: 'New title',
                description: 'Current description',
                reviewers: [],
            });
        });
    });

    describe('changed fields', () => {
        it('replaces the whole reviewer list with the given account ids', () => {
            expect(putBody(pullRequest(), { reviewerAccountIds: ['a3', 'a4'] }).reviewers).toEqual([
                { account_id: 'a3' },
                { account_id: 'a4' },
            ]);
        });

        it('keeps an empty description, which clears it', () => {
            expect(putBody(pullRequest(), { description: '' }).description).toBe('');
        });

        it('sends an empty reviewer list, which clears the reviewers', () => {
            expect(putBody(pullRequest(), { reviewerAccountIds: [] }).reviewers).toEqual([]);
        });

        it('sends every change in one body', () => {
            expect(
                putBody(draftPullRequest(), {
                    title: 'Final title',
                    description: 'Final description',
                    reviewerAccountIds: ['a3'],
                    draft: false,
                }),
            ).toStrictEqual({
                title: 'Final title',
                description: 'Final description',
                reviewers: [{ account_id: 'a3' }],
                draft: false,
            });
        });
    });

    describe('draft', () => {
        it('sends draft: false to mark a draft ready for review', () => {
            expect(putBody(draftPullRequest(), { draft: false }).draft).toBe(false);
        });

        it('sends draft: true to move a ready pull request back to draft', () => {
            expect(putBody(pullRequest(), { draft: true }).draft).toBe(true);
        });

        it('treats a pull request without a draft field as ready', () => {
            const current = pullRequest();
            delete current.draft;
            expect(putBody(current, { draft: true }).draft).toBe(true);
            expect(buildPullRequestUpdate(current, { draft: false })).toStrictEqual({
                kind: 'noop',
                state: 'ready',
            });
        });

        it.each<[string, PullRequestChanges]>([
            ['a title', { title: 'T2' }],
            ['a description', { description: 'D2' }],
            ['an empty description', { description: '' }],
            ['reviewers', { reviewerAccountIds: ['a3'] }],
        ])('leaves draft out when it is unchanged and %s change exists', (_, change) => {
            expect(putBody(pullRequest(), { ...change, draft: false })).not.toHaveProperty('draft');
            expect(putBody(draftPullRequest(), { ...change, draft: true })).not.toHaveProperty(
                'draft',
            );
        });

        it('leaves draft out when no draft state is asked for', () => {
            expect(putBody(draftPullRequest(), { title: 'T2' })).not.toHaveProperty('draft');
        });
    });

    describe('no-op', () => {
        it('reports ready when only --ready is asked for and the pull request is ready', () => {
            expect(buildPullRequestUpdate(pullRequest(), { draft: false })).toStrictEqual({
                kind: 'noop',
                state: 'ready',
            });
        });

        it('reports draft when only --draft is asked for and the pull request is a draft', () => {
            expect(buildPullRequestUpdate(draftPullRequest(), { draft: true })).toStrictEqual({
                kind: 'noop',
                state: 'draft',
            });
        });

        it('is not a no-op when an empty reviewer list comes with the current draft state', () => {
            expect(putBody(pullRequest(), { reviewerAccountIds: [], draft: false })).toStrictEqual({
                title: 'Current title',
                description: 'Current description',
                reviewers: [],
            });
        });
    });
});
