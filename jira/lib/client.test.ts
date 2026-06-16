import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    createIssue,
    updateIssue,
    getFields,
    getCreateMeta,
    getTransitions,
    transitionIssue,
    addComment,
    updateComment,
    deleteComment,
    getEditMeta,
    moveIssue,
    pollBulkTask,
    chunk,
    runBulkOverKeys,
    submitBulkDelete,
    submitBulkTransition,
    getWorklogs,
    addWorklog,
    updateWorklog,
    deleteWorklog,
} from './client.ts';

const BASE_URL = 'https://test.atlassian.net';

function mockJsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function mockEmpty(status = 204): Response {
    return new Response(null, { status });
}

describe('jira client', () => {
    const originalEnv = process.env;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            ATLASSIAN_BASE_URL: BASE_URL,
            ATLASSIAN_EMAIL: 'user@test.com',
            ATLASSIAN_API_TOKEN: 'tok',
        };
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.unstubAllGlobals();
    });

    describe('createIssue', () => {
        it('merges customFields into the request body', async () => {
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse({ id: '1', key: 'PROJ-1', self: '', fields: {} }),
            );

            await createIssue(
                'PROJ',
                'Story',
                'Summary',
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                { customfield_10016: 5, customfield_10099: { value: 'High' } },
            );

            expect(fetchMock).toHaveBeenCalledOnce();
            const [, init] = fetchMock.mock.calls[0]!;
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.fields.customfield_10016).toBe(5);
            expect(body.fields.customfield_10099).toEqual({ value: 'High' });
            expect(body.fields.project).toEqual({ key: 'PROJ' });
            expect(body.fields.issuetype).toEqual({ name: 'Story' });
            expect(body.fields.summary).toBe('Summary');
        });

        it('omits custom fields key when not provided', async () => {
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse({ id: '1', key: 'PROJ-1', self: '', fields: {} }),
            );

            await createIssue('PROJ', 'Story', 'Summary');

            const [, init] = fetchMock.mock.calls[0]!;
            const body = JSON.parse((init as RequestInit).body as string);
            const customKeys = Object.keys(body.fields).filter(k => k.startsWith('customfield_'));
            expect(customKeys).toEqual([]);
        });
    });

    describe('updateIssue', () => {
        it('merges customFields into the PUT body and supports null for clear', async () => {
            fetchMock.mockResolvedValueOnce(mockEmpty());

            await updateIssue('PROJ-1', {
                customFields: { customfield_10016: 8, customfield_10099: null },
            });

            expect(fetchMock).toHaveBeenCalledOnce();
            const [url, init] = fetchMock.mock.calls[0]!;
            expect(String(url)).toContain('/issue/PROJ-1');
            expect((init as RequestInit).method).toBe('PUT');
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.fields.customfield_10016).toBe(8);
            expect(body.fields.customfield_10099).toBeNull();
        });
    });

    describe('getFields', () => {
        it('calls /rest/api/3/field and returns the array', async () => {
            const catalog = [
                { id: 'customfield_10016', name: 'Story Points', custom: true },
                { id: 'summary', name: 'Summary', custom: false },
            ];
            fetchMock.mockResolvedValueOnce(mockJsonResponse(catalog));

            const result = await getFields();

            expect(result).toEqual(catalog);
            const [url] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/field`);
        });
    });

    describe('getCreateMeta', () => {
        it('resolves issue type name to id before hitting createmeta', async () => {
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse({
                    issueTypes: [
                        { id: '10001', name: 'Story', subtask: false },
                        { id: '10002', name: 'Bug', subtask: false },
                    ],
                }),
            );
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ fields: [] }));

            const meta = await getCreateMeta('PROJ', 'Story');

            expect(meta.fields).toEqual([]);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(String(fetchMock.mock.calls[0]![0])).toBe(`${BASE_URL}/rest/api/3/project/PROJ`);
            expect(String(fetchMock.mock.calls[1]![0])).toBe(
                `${BASE_URL}/rest/api/3/issue/createmeta/PROJ/issuetypes/10001`,
            );
        });

        it('throws with available-type list when the name does not match', async () => {
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse({
                    issueTypes: [{ id: '10002', name: 'Bug', subtask: false }],
                }),
            );

            await expect(getCreateMeta('PROJ', 'Story')).rejects.toThrow(/Available: Bug/);
        });

        it('matches issue type case-insensitively', async () => {
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse({
                    issueTypes: [{ id: '10001', name: 'Story', subtask: false }],
                }),
            );
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ fields: [] }));

            await getCreateMeta('PROJ', 'STORY');

            expect(String(fetchMock.mock.calls[1]![0])).toBe(
                `${BASE_URL}/rest/api/3/issue/createmeta/PROJ/issuetypes/10001`,
            );
        });
    });

    describe('getTransitions', () => {
        it('requests screen fields when expandFields is set', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ transitions: [] }));

            await getTransitions('PROJ-3', { expandFields: true });

            const [url] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(
                `${BASE_URL}/rest/api/3/issue/PROJ-3/transitions?expand=transitions.fields`,
            );
        });

        it('omits the expand query by default', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ transitions: [] }));

            await getTransitions('PROJ-3');

            const [url] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/issue/PROJ-3/transitions`);
        });
    });

    describe('transitionIssue', () => {
        function mockTransitionLookup(): void {
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse({
                    transitions: [
                        { id: '5', name: 'Done', to: { name: 'Done' } },
                        { id: '7', name: 'In Review', to: { name: 'In Review' } },
                    ],
                }),
            );
        }

        it('sends the resolution in fields alongside the transition id', async () => {
            mockTransitionLookup();
            fetchMock.mockResolvedValueOnce(mockEmpty());

            await transitionIssue('PROJ-1', 'Done', { resolution: 'Fixed' });

            expect(fetchMock).toHaveBeenCalledTimes(2);
            const [postUrl, postInit] = fetchMock.mock.calls[1]!;
            expect(String(postUrl)).toContain('/issue/PROJ-1/transitions');
            const body = JSON.parse((postInit as RequestInit).body as string);
            expect(body.transition).toEqual({ id: '5' });
            expect(body.fields.resolution).toEqual({ name: 'Fixed' });
            expect(body.update).toBeUndefined();
        });

        it('emits the comment as ADF under update.comment', async () => {
            mockTransitionLookup();
            fetchMock.mockResolvedValueOnce(mockEmpty());

            await transitionIssue('PROJ-2', 'In Review', { comment: 'Ready for QA' });

            const [, postInit] = fetchMock.mock.calls[1]!;
            const body = JSON.parse((postInit as RequestInit).body as string);
            expect(body.update.comment[0].add.body.type).toBe('doc');
            expect(JSON.stringify(body.update.comment[0].add.body)).toContain('Ready for QA');
            expect(body.fields).toBeUndefined();
        });

        it('retries on 409 conflict then succeeds', async () => {
            mockTransitionLookup();
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ errorMessages: ['conflict'] }, 409));
            fetchMock.mockResolvedValueOnce(mockEmpty());

            await transitionIssue('PROJ-4', 'Done');

            // GET transitions + POST(409) + POST(204)
            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        it('throws with available transitions when the name does not match', async () => {
            mockTransitionLookup();

            await expect(transitionIssue('PROJ-5', 'Nope')).rejects.toThrow(/Available: Done/);
        });
    });

    describe('updateIssue reparent', () => {
        it('sets fields.parent.key when parent is given', async () => {
            fetchMock.mockResolvedValueOnce(mockEmpty());

            await updateIssue('PROJ-1', { parent: 'PROJ-5' });

            const [, init] = fetchMock.mock.calls[0]!;
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.fields.parent).toEqual({ key: 'PROJ-5' });
        });

        it('sets fields.parent to null when clearParent is set', async () => {
            fetchMock.mockResolvedValueOnce(mockEmpty());

            await updateIssue('PROJ-1', { clearParent: true });

            const [, init] = fetchMock.mock.calls[0]!;
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.fields.parent).toBeNull();
        });
    });

    describe('comments', () => {
        it('addComment attaches a visibility restriction when provided', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: '1' }));

            await addComment('PROJ-1', 'Internal note', {
                type: 'role',
                value: 'Administrators',
            });

            const [url, init] = fetchMock.mock.calls[0]!;
            expect(String(url)).toContain('/issue/PROJ-1/comment');
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.visibility).toEqual({ type: 'role', value: 'Administrators' });
            expect(body.body.type).toBe('doc');
        });

        it('updateComment PUTs the new body to the comment id', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: '9' }));

            await updateComment('PROJ-1', '9', 'Edited text');

            const [url, init] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/issue/PROJ-1/comment/9`);
            expect((init as RequestInit).method).toBe('PUT');
            const body = JSON.parse((init as RequestInit).body as string);
            expect(JSON.stringify(body.body)).toContain('Edited text');
        });

        it('deleteComment DELETEs the comment id', async () => {
            fetchMock.mockResolvedValueOnce(mockEmpty());

            await deleteComment('PROJ-1', '9');

            const [url, init] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/issue/PROJ-1/comment/9`);
            expect((init as RequestInit).method).toBe('DELETE');
        });
    });

    describe('getEditMeta', () => {
        it('GETs the editmeta endpoint', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ fields: {} }));

            await getEditMeta('PROJ-1');

            const [url] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/issue/PROJ-1/editmeta`);
        });
    });

    describe('pollBulkTask', () => {
        it('resolves when the task reaches a COMPLETE state', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ taskId: '1', status: 'RUNNING' }));
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ taskId: '1', status: 'COMPLETE' }));

            const result = await pollBulkTask('1', { intervalMs: 0 });

            expect(result.status).toBe('COMPLETE');
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('throws when the task reaches a failure state', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ taskId: '2', status: 'FAILED' }));

            await expect(pollBulkTask('2', { intervalMs: 0 })).rejects.toThrow(/FAILED/);
        });
    });

    describe('moveIssue', () => {
        it('resolves the target type, submits a bulk move, and polls to completion', async () => {
            // getIssueTypes(NEWPROJ)
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse({
                    issueTypes: [{ id: '10001', name: 'Story', subtask: false }],
                }),
            );
            // POST /bulk/issues/move
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ taskId: '42' }, 201));
            // GET /bulk/queue/42
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ taskId: '42', status: 'COMPLETE' }));

            const result = await moveIssue('PROJ-1', 'NEWPROJ', { type: 'Story', intervalMs: 0 });

            expect(result.status).toBe('COMPLETE');
            const [moveUrl, moveInit] = fetchMock.mock.calls[1]!;
            expect(String(moveUrl)).toBe(`${BASE_URL}/rest/api/3/bulk/issues/move`);
            const body = JSON.parse((moveInit as RequestInit).body as string);
            expect(body.targetToSourcesMapping['NEWPROJ,10001'].issueIdsOrKeys).toEqual(['PROJ-1']);
            expect(body.targetToSourcesMapping['NEWPROJ,10001'].inferStatusDefaults).toBe(true);
            expect(String(fetchMock.mock.calls[2]![0])).toBe(
                `${BASE_URL}/rest/api/3/bulk/queue/42`,
            );
        });

        it('throws when the move task fails', async () => {
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse({
                    issueTypes: [{ id: '10001', name: 'Story', subtask: false }],
                }),
            );
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ taskId: '7' }, 201));
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ taskId: '7', status: 'FAILED' }));

            await expect(
                moveIssue('PROJ-1', 'NEWPROJ', { type: 'Story', intervalMs: 0 }),
            ).rejects.toThrow(/FAILED/);
        });
    });

    describe('chunk', () => {
        it('splits a list into chunks of the given size', () => {
            const keys = Array.from({ length: 1500 }, (_, i) => `K-${i}`);
            const parts = chunk(keys, 1000);
            expect(parts.map(p => p.length)).toEqual([1000, 500]);
        });
    });

    describe('runBulkOverKeys', () => {
        it('submits one task per 1000-issue chunk and polls each serially', async () => {
            const keys = Array.from({ length: 1500 }, (_, i) => `K-${i}`);
            // Fresh Response per poll — a Response body can only be read once.
            fetchMock.mockImplementation(async () =>
                mockJsonResponse({ taskId: 'x', status: 'COMPLETE' }),
            );
            let submitted = 0;

            const tasks = await runBulkOverKeys(
                keys,
                async () => {
                    submitted++;
                    return `task-${submitted}`;
                },
                { intervalMs: 0 },
            );

            expect(submitted).toBe(2);
            expect(tasks).toHaveLength(2);
            expect(tasks.every(t => t.status === 'COMPLETE')).toBe(true);
        });
    });

    describe('bulk submit shapes', () => {
        it('submitBulkDelete posts selectedIssueIdsOrKeys', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ taskId: '1' }, 201));

            const id = await submitBulkDelete(['A-1', 'A-2']);

            expect(id).toBe('1');
            const [url, init] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/bulk/issues/delete`);
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.selectedIssueIdsOrKeys).toEqual(['A-1', 'A-2']);
        });

        it('submitBulkTransition wraps keys in bulkTransitionInputs', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ taskId: '2' }, 201));

            await submitBulkTransition(['A-1'], '31');

            const [url, init] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/bulk/issues/transition`);
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.bulkTransitionInputs[0]).toEqual({
                selectedIssueIdsOrKeys: ['A-1'],
                transitionId: '31',
            });
        });
    });

    describe('worklogs', () => {
        it('addWorklog posts timeSpent + started and an ADF comment', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: '100' }, 201));

            await addWorklog('PROJ-1', {
                timeSpent: '2h',
                started: '2026-01-01T09:00:00.000+0000',
                comment: 'Investigated root cause',
            });

            const [url, init] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/issue/PROJ-1/worklog`);
            const body = JSON.parse((init as RequestInit).body as string);
            expect(body.timeSpent).toBe('2h');
            expect(body.started).toBe('2026-01-01T09:00:00.000+0000');
            expect(body.comment.type).toBe('doc');
            expect(JSON.stringify(body.comment)).toContain('Investigated root cause');
        });

        it('addWorklog defaults started when omitted', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: '101' }, 201));

            await addWorklog('PROJ-1', { timeSpent: '1h' });

            const [, init] = fetchMock.mock.calls[0]!;
            const body = JSON.parse((init as RequestInit).body as string);
            expect(typeof body.started).toBe('string');
            expect(body.started).toMatch(/\+0000$/);
        });

        it('getWorklogs returns the worklogs array', async () => {
            fetchMock.mockResolvedValueOnce(
                mockJsonResponse({ worklogs: [{ id: '1', timeSpent: '2h' }] }),
            );

            const worklogs = await getWorklogs('PROJ-1');

            expect(worklogs).toEqual([{ id: '1', timeSpent: '2h' }]);
            const [url] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/issue/PROJ-1/worklog`);
        });

        it('updateWorklog PUTs to the worklog id', async () => {
            fetchMock.mockResolvedValueOnce(mockJsonResponse({ id: '9' }));

            await updateWorklog('PROJ-1', '9', { timeSpent: '3h' });

            const [url, init] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/issue/PROJ-1/worklog/9`);
            expect((init as RequestInit).method).toBe('PUT');
        });

        it('deleteWorklog DELETEs the worklog id', async () => {
            fetchMock.mockResolvedValueOnce(mockEmpty());

            await deleteWorklog('PROJ-1', '9');

            const [url, init] = fetchMock.mock.calls[0]!;
            expect(String(url)).toBe(`${BASE_URL}/rest/api/3/issue/PROJ-1/worklog/9`);
            expect((init as RequestInit).method).toBe('DELETE');
        });
    });
});
