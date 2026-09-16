import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AtlassianHttpError } from '../../atlassian/lib/request.ts';
import * as bbRequestModule from './request.ts';
import type { BitbucketPullRequest } from './types.ts';
import {
    buildCommentBody,
    buildTaskBody,
    buildTriggerBody,
    resolveComment,
    reopenComment,
    getCurrentUser,
    listRepositories,
    listBranches,
    getBranch,
    listTags,
    getTag,
    listCommits,
    getCommit,
    getDiff,
    getPatch,
    getDiffStat,
    readSource,
    browseSource,
    listPullRequestActivity,
    listPullRequestStatuses,
    listPullRequests,
    pullRequestStates,
    listUserWorkspaces,
    listWorkspacePullRequestsForUser,
    listMyPullRequests,
} from './client.ts';

// resolveComment / reopenComment are thin HTTP wrappers with no body-builder to
// unit-test in isolation, so mock the request layer and assert the method + URL
// of the `/resolve` sub-resource — the riskiest, API-shape-dependent part.
vi.mock('./request.ts', () => ({
    bbRequest: vi.fn(),
    bbPaginate: vi.fn(),
    bbRequestText: vi.fn(),
}));

const RESOLVE_URL =
    'https://api.bitbucket.org/2.0/repositories/ws/repo/pullrequests/42/comments/5/resolve';

describe('resolveComment / reopenComment', () => {
    beforeEach(() => {
        vi.mocked(bbRequestModule.bbRequest).mockReset();
        vi.mocked(bbRequestModule.bbRequest).mockResolvedValue({} as never);
    });

    it('resolveComment POSTs to the /resolve sub-resource', async () => {
        await resolveComment('ws', 'repo', 42, 5);
        expect(bbRequestModule.bbRequest).toHaveBeenCalledWith(RESOLVE_URL, {
            method: 'POST',
            body: '{}',
        });
    });

    it('reopenComment DELETEs the /resolve sub-resource', async () => {
        await reopenComment('ws', 'repo', 42, 5);
        expect(bbRequestModule.bbRequest).toHaveBeenCalledWith(RESOLVE_URL, {
            method: 'DELETE',
        });
    });
});

describe('buildCommentBody', () => {
    it('builds general comment body', () => {
        expect(buildCommentBody({ body: 'looks good' })).toEqual({
            content: { raw: 'looks good' },
        });
    });

    it('builds inline comment body with `to` line', () => {
        expect(
            buildCommentBody({ body: 'see here', inline: { path: 'src/foo.ts', to: 10 } }),
        ).toEqual({
            content: { raw: 'see here' },
            inline: { path: 'src/foo.ts', to: 10 },
        });
    });

    it('builds inline comment body with `from` line', () => {
        expect(
            buildCommentBody({ body: 'old line', inline: { path: 'src/foo.ts', from: 5 } }),
        ).toEqual({
            content: { raw: 'old line' },
            inline: { path: 'src/foo.ts', from: 5 },
        });
    });

    it('builds reply comment body', () => {
        expect(buildCommentBody({ body: 'agreed', parentId: 100 })).toEqual({
            content: { raw: 'agreed' },
            parent: { id: 100 },
        });
    });

    it('builds inline reply (parent + inline)', () => {
        expect(
            buildCommentBody({
                body: '+1',
                parentId: 100,
                inline: { path: 'src/foo.ts', to: 10 },
            }),
        ).toEqual({
            content: { raw: '+1' },
            inline: { path: 'src/foo.ts', to: 10 },
            parent: { id: 100 },
        });
    });
});

describe('buildTaskBody', () => {
    it('builds standalone task body', () => {
        expect(buildTaskBody({ body: 'rename this' })).toEqual({
            content: { raw: 'rename this' },
        });
    });

    it('builds task body linked to a comment', () => {
        expect(buildTaskBody({ body: 'rename this', onCommentId: 100 })).toEqual({
            content: { raw: 'rename this' },
            comment: { id: 100 },
        });
    });
});

describe('buildTriggerBody', () => {
    it('builds branch trigger', () => {
        expect(buildTriggerBody({ branch: 'main' })).toEqual({
            target: {
                type: 'pipeline_ref_target',
                ref_type: 'branch',
                ref_name: 'main',
            },
        });
    });

    it('builds commit trigger', () => {
        expect(buildTriggerBody({ commit: 'abc123' })).toEqual({
            target: {
                type: 'pipeline_commit_target',
                commit: { type: 'commit', hash: 'abc123' },
            },
        });
    });

    it('builds commit trigger anchored on a branch', () => {
        expect(buildTriggerBody({ commit: 'abc123', branch: 'main' })).toEqual({
            target: {
                type: 'pipeline_commit_target',
                commit: { type: 'commit', hash: 'abc123' },
                ref_type: 'branch',
                ref_name: 'main',
            },
        });
    });

    it('builds custom pipeline trigger on branch', () => {
        expect(buildTriggerBody({ branch: 'main', custom: 'nightly' })).toEqual({
            target: {
                type: 'pipeline_ref_target',
                ref_type: 'branch',
                ref_name: 'main',
                selector: { type: 'custom', pattern: 'nightly' },
            },
        });
    });

    it('builds trigger with variables', () => {
        expect(
            buildTriggerBody({
                branch: 'main',
                variables: [
                    { key: 'FOO', value: 'bar' },
                    { key: 'BAZ', value: 'qux' },
                ],
            }),
        ).toEqual({
            target: {
                type: 'pipeline_ref_target',
                ref_type: 'branch',
                ref_name: 'main',
            },
            variables: [
                { key: 'FOO', value: 'bar' },
                { key: 'BAZ', value: 'qux' },
            ],
        });
    });

    it('throws when neither branch nor commit is supplied', () => {
        expect(() => buildTriggerBody({})).toThrow(/--branch or --commit/);
    });
});

// --- Read surface: assert exact request URLs ----------------------------

const BASE = 'https://api.bitbucket.org/2.0';
const REPO = `${BASE}/repositories/ws/repo`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function* gen(items: any[]): AsyncGenerator<unknown> {
    for (const it of items) yield it;
}

describe('read surface client URLs', () => {
    beforeEach(() => {
        vi.mocked(bbRequestModule.bbRequest)
            .mockReset()
            .mockResolvedValue({} as never);
        vi.mocked(bbRequestModule.bbRequestText)
            .mockReset()
            .mockResolvedValue('' as never);
        vi.mocked(bbRequestModule.bbPaginate)
            .mockReset()
            .mockImplementation(() => gen([]) as never);
    });

    it('getCurrentUser hits /user', async () => {
        await getCurrentUser();
        expect(bbRequestModule.bbRequest).toHaveBeenCalledWith(`${BASE}/user`);
    });

    it('listRepositories targets the workspace with q/role/sort', async () => {
        await listRepositories('ws', {
            query: 'name~"api"',
            role: 'contributor',
            sort: '-updated_on',
        });
        const url = vi.mocked(bbRequestModule.bbPaginate).mock.calls[0][0] as string;
        expect(url.startsWith(`${BASE}/repositories/ws?`)).toBe(true);
        expect(url).toContain('role=contributor');
        expect(url).toContain('sort=-updated_on');
        expect(url).toContain('q=');
    });

    it('listBranches / getBranch hit refs/branches', async () => {
        await listBranches('ws', 'repo');
        expect(bbRequestModule.bbPaginate).toHaveBeenCalledWith(`${REPO}/refs/branches`);
        await getBranch('ws', 'repo', 'feature/x');
        expect(bbRequestModule.bbRequest).toHaveBeenCalledWith(`${REPO}/refs/branches/feature%2Fx`);
    });

    it('listTags / getTag hit refs/tags', async () => {
        await listTags('ws', 'repo');
        expect(bbRequestModule.bbPaginate).toHaveBeenCalledWith(`${REPO}/refs/tags`);
        await getTag('ws', 'repo', 'v1.2.0');
        expect(bbRequestModule.bbRequest).toHaveBeenCalledWith(`${REPO}/refs/tags/v1.2.0`);
    });

    it('listCommits scopes by branch and forwards include/exclude', async () => {
        await listCommits('ws', 'repo', {
            branch: 'main',
            include: ['feature'],
            exclude: ['main'],
        });
        expect(bbRequestModule.bbPaginate).toHaveBeenCalledWith(
            `${REPO}/commits/main?include=feature&exclude=main`,
        );
    });

    it('listCommits stops at the limit even when more pages exist', async () => {
        vi.mocked(bbRequestModule.bbPaginate).mockImplementation(
            () => gen([1, 2, 3, 4, 5].map(n => ({ hash: `h${n}` }))) as never,
        );
        const out = await listCommits('ws', 'repo', { limit: 2 });
        expect(out).toHaveLength(2);
    });

    it('getCommit hits /commit/{sha}', async () => {
        await getCommit('ws', 'repo', 'abc123');
        expect(bbRequestModule.bbRequest).toHaveBeenCalledWith(`${REPO}/commit/abc123`);
    });

    it('getDiff / getPatch use the text endpoint with the revspec', async () => {
        await getDiff('ws', 'repo', 'main..feature');
        expect(bbRequestModule.bbRequestText).toHaveBeenCalledWith(`${REPO}/diff/main..feature`);
        await getPatch('ws', 'repo', 'abc123');
        expect(bbRequestModule.bbRequestText).toHaveBeenCalledWith(`${REPO}/patch/abc123`);
    });

    it('getDiffStat paginates the diffstat endpoint', async () => {
        await getDiffStat('ws', 'repo', 'main..feature');
        expect(bbRequestModule.bbPaginate).toHaveBeenCalledWith(`${REPO}/diffstat/main..feature`);
    });

    it('readSource encodes ref segment but keeps the path slashes', async () => {
        await readSource('ws', 'repo', 'src/index.ts', 'develop');
        expect(bbRequestModule.bbRequestText).toHaveBeenCalledWith(
            `${REPO}/src/develop/src/index.ts`,
        );
    });

    it('browseSource lists a directory with a trailing slash and max_depth', async () => {
        await browseSource('ws', 'repo', 'src', { ref: 'main', recursive: true });
        expect(bbRequestModule.bbPaginate).toHaveBeenCalledWith(
            `${REPO}/src/main/src/?max_depth=100`,
        );
        await browseSource('ws', 'repo', '', { ref: 'main' });
        expect(bbRequestModule.bbPaginate).toHaveBeenCalledWith(`${REPO}/src/main/`);
    });

    it('PR activity and statuses hit their sub-resources', async () => {
        await listPullRequestActivity('ws', 'repo', 42);
        expect(bbRequestModule.bbPaginate).toHaveBeenCalledWith(`${REPO}/pullrequests/42/activity`);
        await listPullRequestStatuses('ws', 'repo', 42);
        expect(bbRequestModule.bbPaginate).toHaveBeenCalledWith(`${REPO}/pullrequests/42/statuses`);
    });

    it('readSource hash-resolves a slashed ref so the slash is not a path delimiter', async () => {
        vi.mocked(bbRequestModule.bbRequest).mockResolvedValueOnce({
            target: { hash: 'HASH123' },
        } as never);
        await readSource('ws', 'repo', 'a/b.ts', 'feature/x');
        // the slashed ref is looked up via the leaf branch endpoint...
        expect(bbRequestModule.bbRequest).toHaveBeenCalledWith(`${REPO}/refs/branches/feature%2Fx`);
        // ...and the file read uses the resolved hash in the ref position
        expect(bbRequestModule.bbRequestText).toHaveBeenCalledWith(`${REPO}/src/HASH123/a/b.ts`);
    });

    it('getDiff hash-resolves a slashed side of a revspec', async () => {
        vi.mocked(bbRequestModule.bbRequest).mockResolvedValueOnce({
            target: { hash: 'H9' },
        } as never);
        await getDiff('ws', 'repo', 'main..feature/x');
        expect(bbRequestModule.bbRequestText).toHaveBeenCalledWith(`${REPO}/diff/main..H9`);
    });

    it('getDiff does NOT fetch for a slash-free revspec', async () => {
        await getDiff('ws', 'repo', 'main..feature');
        expect(bbRequestModule.bbRequest).not.toHaveBeenCalled();
        expect(bbRequestModule.bbRequestText).toHaveBeenCalledWith(`${REPO}/diff/main..feature`);
    });

    it('listCommits clamps an invalid limit to the default instead of draining', async () => {
        vi.mocked(bbRequestModule.bbPaginate).mockImplementation(
            () => gen(Array.from({ length: 30 }, (_, i) => ({ hash: `h${i}` }))) as never,
        );
        const out = await listCommits('ws', 'repo', { limit: NaN as unknown as number });
        expect(out).toHaveLength(25);
    });
});

// --- Pull request state parameters ----------------------------------------

describe('pullRequestStates', () => {
    it('defaults to OPEN', () => {
        expect(pullRequestStates()).toEqual(['OPEN']);
    });

    it('passes a single state through', () => {
        expect(pullRequestStates('MERGED')).toEqual(['MERGED']);
    });

    it('expands ALL to every state', () => {
        expect(pullRequestStates('ALL')).toEqual(['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED']);
    });
});

describe('listPullRequests state params', () => {
    beforeEach(() => {
        vi.mocked(bbRequestModule.bbPaginate)
            .mockReset()
            .mockImplementation(() => gen([]) as never);
    });

    function requestedUrl(): URL {
        return new URL(vi.mocked(bbRequestModule.bbPaginate).mock.calls[0][0] as string);
    }

    it('sends every state as a repeated param for ALL', async () => {
        await listPullRequests('ws', 'repo', { state: 'ALL' });
        const url = requestedUrl();
        expect(url.pathname).toBe('/2.0/repositories/ws/repo/pullrequests');
        expect(url.searchParams.getAll('state')).toEqual([
            'OPEN',
            'MERGED',
            'DECLINED',
            'SUPERSEDED',
        ]);
    });

    it('sends a single state param for MERGED', async () => {
        await listPullRequests('ws', 'repo', { state: 'MERGED' });
        expect(requestedUrl().searchParams.getAll('state')).toEqual(['MERGED']);
    });

    it('sends state=OPEN when no state is given', async () => {
        await listPullRequests('ws', 'repo');
        expect(requestedUrl().searchParams.getAll('state')).toEqual(['OPEN']);
    });

    it('still forwards q', async () => {
        await listPullRequests('ws', 'repo', { state: 'OPEN', q: 'source.branch.name="feat"' });
        const url = requestedUrl();
        expect(url.searchParams.get('q')).toBe('source.branch.name="feat"');
        expect(url.searchParams.getAll('state')).toEqual(['OPEN']);
    });
});

// --- My pull requests across workspaces ---------------------------------------

const ME = { account_id: 'acc-1', display_name: 'Me', uuid: '{me-uuid}' };

function pr(id: number, repo: string, updated: string): BitbucketPullRequest {
    return {
        id,
        title: `PR ${id}`,
        state: 'OPEN',
        author: { type: 'user', account_id: 'acc-1', display_name: 'Me' },
        source: { branch: { name: `feature-${id}` } },
        destination: { branch: { name: 'main' }, repository: { full_name: repo } },
        created_on: updated,
        updated_on: updated,
    };
}

/** An async iterable whose first page request rejects with `err`. */
function failing(err: Error): AsyncIterable<never> {
    return { [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(err) }) };
}

/** Route bbPaginate by URL: `/user/workspaces` → slugs, `/workspaces/{ws}/…` → handler. */
function routePaginate(
    slugs: string[],
    byWorkspace: Record<string, () => AsyncIterable<unknown>>,
): void {
    vi.mocked(bbRequestModule.bbPaginate).mockImplementation(((url: string) => {
        if (url === `${BASE}/user/workspaces`) {
            return gen(slugs.map(slug => ({ workspace: { slug } })));
        }
        const match = /\/workspaces\/([^/]+)\/pullrequests\//.exec(url);
        const handler = match ? byWorkspace[decodeURIComponent(match[1] as string)] : undefined;
        if (!handler) throw new Error(`unexpected URL ${url}`);
        return handler();
    }) as never);
}

function paginatedUrls(): string[] {
    return vi.mocked(bbRequestModule.bbPaginate).mock.calls.map(c => c[0] as string);
}

describe('listUserWorkspaces / listWorkspacePullRequestsForUser', () => {
    beforeEach(() => {
        vi.mocked(bbRequestModule.bbPaginate)
            .mockReset()
            .mockImplementation(() => gen([]) as never);
    });

    it('listUserWorkspaces paginates /user/workspaces', async () => {
        vi.mocked(bbRequestModule.bbPaginate).mockImplementation(
            () => gen([{ workspace: { slug: 'a' } }, { workspace: { slug: 'b' } }]) as never,
        );
        const out = await listUserWorkspaces();
        expect(bbRequestModule.bbPaginate).toHaveBeenCalledWith(`${BASE}/user/workspaces`);
        expect(out.map(w => w.workspace.slug)).toEqual(['a', 'b']);
    });

    it('targets the workspace endpoint with encoded uuid, states, and sort', async () => {
        await listWorkspacePullRequestsForUser('ws', '{me-uuid}', { state: 'ALL' });
        const raw = paginatedUrls()[0] as string;
        expect(raw.startsWith(`${BASE}/workspaces/ws/pullrequests/%7Bme-uuid%7D?`)).toBe(true);
        const url = new URL(raw);
        expect(url.searchParams.getAll('state')).toEqual([
            'OPEN',
            'MERGED',
            'DECLINED',
            'SUPERSEDED',
        ]);
        expect(url.searchParams.get('sort')).toBe('-updated_on');
    });

    it('stops paginating once the limit is reached', async () => {
        let pulled = 0;
        vi.mocked(bbRequestModule.bbPaginate).mockImplementation(
            () =>
                (async function* () {
                    for (let i = 1; i <= 10; i++) {
                        pulled++;
                        yield pr(i, 'ws/r', `2026-01-${String(i).padStart(2, '0')}T00:00:00Z`);
                    }
                })() as never,
        );
        const out = await listWorkspacePullRequestsForUser('ws', '{me-uuid}', { limit: 3 });
        expect(out).toHaveLength(3);
        expect(pulled).toBe(3);
    });
});

describe('listMyPullRequests', () => {
    beforeEach(() => {
        vi.mocked(bbRequestModule.bbRequest)
            .mockReset()
            .mockResolvedValue(ME as never);
        vi.mocked(bbRequestModule.bbPaginate).mockReset();
    });

    it('discovers workspaces and queries each for the authenticated uuid', async () => {
        routePaginate(['w1', 'w2'], {
            w1: () => gen([pr(1, 'w1/api', '2026-09-01T00:00:00Z')]),
            w2: () => gen([pr(2, 'w2/web', '2026-09-02T00:00:00Z')]),
        });
        const { pullRequests, skipped } = await listMyPullRequests();

        expect(bbRequestModule.bbRequest).toHaveBeenCalledWith(`${BASE}/user`);
        const urls = paginatedUrls();
        expect(urls).toContain(`${BASE}/user/workspaces`);
        expect(
            urls.some(u => u.startsWith(`${BASE}/workspaces/w1/pullrequests/%7Bme-uuid%7D?`)),
        ).toBe(true);
        expect(
            urls.some(u => u.startsWith(`${BASE}/workspaces/w2/pullrequests/%7Bme-uuid%7D?`)),
        ).toBe(true);
        expect(new URL(urls[1] as string).searchParams.getAll('state')).toEqual(['OPEN']);
        expect(pullRequests.map(p => p.id)).toEqual([2, 1]);
        expect(skipped).toEqual([]);
    });

    it('falls back to account_id when the account has no uuid', async () => {
        vi.mocked(bbRequestModule.bbRequest).mockResolvedValue({
            account_id: 'acc-1',
            display_name: 'Me',
        } as never);
        routePaginate([], { w1: () => gen([]) });
        await listMyPullRequests({ workspace: 'w1' });
        expect(paginatedUrls()[0]?.startsWith(`${BASE}/workspaces/w1/pullrequests/acc-1?`)).toBe(
            true,
        );
    });

    it('an explicit workspace skips /user/workspaces', async () => {
        routePaginate(['w1', 'w2'], { w1: () => gen([pr(1, 'w1/api', '2026-09-01T00:00:00Z')]) });
        const { pullRequests } = await listMyPullRequests({ workspace: 'w1' });
        expect(paginatedUrls()).not.toContain(`${BASE}/user/workspaces`);
        expect(paginatedUrls()).toHaveLength(1);
        expect(pullRequests.map(p => p.id)).toEqual([1]);
    });

    it('merges results across workspaces newest-updated first', async () => {
        routePaginate(['w1', 'w2'], {
            w1: () =>
                gen([
                    pr(10, 'w1/a', '2026-09-05T00:00:00Z'),
                    pr(11, 'w1/a', '2026-09-01T00:00:00Z'),
                ]),
            w2: () =>
                gen([
                    pr(20, 'w2/b', '2026-09-07T00:00:00Z'),
                    pr(21, 'w2/b', '2026-09-03T00:00:00Z'),
                ]),
        });
        const { pullRequests } = await listMyPullRequests();
        expect(pullRequests.map(p => p.id)).toEqual([20, 10, 21, 11]);
    });

    it('a global limit returns the true top-N across workspaces and stops early', async () => {
        const pulled: Record<string, number> = { w1: 0, w2: 0 };
        function counted(ws: string, prs: BitbucketPullRequest[]) {
            return async function* () {
                for (const p of prs) {
                    pulled[ws] = (pulled[ws] ?? 0) + 1;
                    yield p;
                }
            };
        }
        routePaginate(['w1', 'w2'], {
            // Each workspace yields newest first, as requested via sort=-updated_on.
            w1: counted('w1', [
                pr(10, 'w1/a', '2026-09-09T00:00:00Z'),
                pr(11, 'w1/a', '2026-09-08T00:00:00Z'),
                pr(12, 'w1/a', '2026-09-01T00:00:00Z'),
                pr(13, 'w1/a', '2026-08-01T00:00:00Z'),
            ]),
            w2: counted('w2', [
                pr(20, 'w2/b', '2026-09-10T00:00:00Z'),
                pr(21, 'w2/b', '2026-09-02T00:00:00Z'),
                pr(22, 'w2/b', '2026-08-02T00:00:00Z'),
            ]),
        });
        const { pullRequests } = await listMyPullRequests({ limit: 2 });
        expect(pullRequests.map(p => p.id)).toEqual([20, 10]);
        expect(pulled).toEqual({ w1: 2, w2: 2 });
    });

    it.each([403, 404])('skips a workspace answering %i and reports it', async status => {
        routePaginate(['w1', 'w2'], {
            w1: () => gen([pr(1, 'w1/api', '2026-09-01T00:00:00Z')]),
            w2: () => failing(new AtlassianHttpError('You may not have access', status)),
        });
        const { pullRequests, skipped } = await listMyPullRequests();
        expect(pullRequests.map(p => p.id)).toEqual([1]);
        expect(skipped).toEqual([{ workspace: 'w2', status, message: 'You may not have access' }]);
    });

    it.each([401, 500])('propagates a %i from a workspace', async status => {
        routePaginate(['w1', 'w2'], {
            w1: () => gen([pr(1, 'w1/api', '2026-09-01T00:00:00Z')]),
            w2: () => failing(new AtlassianHttpError('boom', status)),
        });
        await expect(listMyPullRequests()).rejects.toThrow('boom');
    });

    it('propagates a failure of /user/workspaces itself', async () => {
        vi.mocked(bbRequestModule.bbPaginate).mockImplementation(
            () => failing(new AtlassianHttpError('nope', 403)) as never,
        );
        await expect(listMyPullRequests()).rejects.toThrow('nope');
    });

    it('rewrites a 403 on /user into the Account read scope hint', async () => {
        vi.mocked(bbRequestModule.bbRequest).mockRejectedValue(
            new AtlassianHttpError(
                'Your credentials lack one or more required privilege scopes.',
                403,
            ),
        );
        await expect(listMyPullRequests()).rejects.toThrow(/Account read scope/);
        expect(bbRequestModule.bbPaginate).not.toHaveBeenCalled();
    });

    it('queries at most 4 workspaces at once', async () => {
        let active = 0;
        let peak = 0;
        const slow = () =>
            (async function* () {
                active++;
                peak = Math.max(peak, active);
                await new Promise(resolve => setTimeout(resolve, 5));
                active--;
                yield* [];
            })();
        const slugs = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'];
        routePaginate(slugs, Object.fromEntries(slugs.map(s => [s, slow])));
        await listMyPullRequests();
        expect(peak).toBe(4);
        expect(paginatedUrls()).toHaveLength(7);
    });

    it('never requests the removed cross-workspace /pullrequests/{user} endpoint', async () => {
        routePaginate(['w1'], { w1: () => gen([pr(1, 'w1/api', '2026-09-01T00:00:00Z')]) });
        await listMyPullRequests({ state: 'ALL', limit: 5 });
        const all = [
            ...paginatedUrls(),
            ...vi.mocked(bbRequestModule.bbRequest).mock.calls.map(c => c[0] as string),
        ];
        expect(all.some(u => u.startsWith(`${BASE}/pullrequests/`))).toBe(false);
    });
});
