import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bbRequestModule from './request.ts';
import {
    buildCommentBody,
    buildTaskBody,
    buildTriggerBody,
    resolveComment,
    reopenComment,
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
