import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bbRequestModule from './request.ts';
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
