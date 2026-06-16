import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    createIssue,
    updateIssue,
    getFields,
    getCreateMeta,
    getTransitions,
    transitionIssue,
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
});
