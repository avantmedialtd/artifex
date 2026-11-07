import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { parseArgs, handleBitbucket, showBitbucketHelp } from './bitbucket.ts';
import { AtlassianHttpError } from '../atlassian/lib/request.ts';
import * as client from '../bitbucket/lib/client.ts';
import * as bbConfig from '../bitbucket/lib/config.ts';
import { bbRequest } from '../bitbucket/lib/request.ts';
import { defaultTextInputIo } from '../utils/text-input.ts';

vi.mock('../bitbucket/lib/client.ts', () => ({
    resolveComment: vi.fn(),
    reopenComment: vi.fn(),
    listComments: vi.fn(),
    listTasks: vi.fn(),
    listPullRequests: vi.fn(),
    listMyPullRequests: vi.fn(),
    listPullRequestSignals: vi.fn(),
    addComment: vi.fn(),
    updateComment: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    createPullRequest: vi.fn(),
    getPullRequest: vi.fn(),
    updatePullRequest: vi.fn(),
    mergePullRequest: vi.fn(),
    getCurrentBranch: vi.fn(),
    getRepository: vi.fn(),
    triggerPipeline: vi.fn(),
}));

/**
 * Asserts that no client function was called and no request was sent directly.
 * Mock histories accumulate across tests, so clear them first (`vi.clearAllMocks`).
 */
function expectNothingSent(): void {
    const mocks = Object.entries(client).filter(([, fn]) => vi.isMockFunction(fn));
    expect(mocks.length).toBeGreaterThan(0);
    for (const [name, fn] of mocks) expect(fn, name).not.toHaveBeenCalled();
    expect(bbRequest).not.toHaveBeenCalled();
}

// `pr list --mine` resolves `/user` through `bbRequest` directly, not the client.
vi.mock('../bitbucket/lib/request.ts', () => ({ bbRequest: vi.fn() }));

// Pass through to the real resolver by default; individual tests override it to
// simulate "no Bitbucket context" or "af.json names a workspace" without
// depending on this checkout's git remote.
vi.mock('../bitbucket/lib/config.ts', async importOriginal => {
    const actual = await importOriginal<typeof import('../bitbucket/lib/config.ts')>();
    return { ...actual, resolveTarget: vi.fn(actual.resolveTarget) };
});

// These tests cover the flag-alias contract for `af bb pr create`: the canonical
// keys `from` and `to` accept `--source`/`--src` and `--destination`/`--dest`
// respectively. Aliases normalize at parse time, so the rest of the handler
// only ever sees canonical option keys.
describe('parseArgs flag aliases', () => {
    it('resolves --source to from', () => {
        const { options } = parseArgs(['pr', 'create', '--source', 'feature/x']);
        expect(options.from).toBe('feature/x');
        expect((options as Record<string, unknown>).source).toBeUndefined();
    });

    it('resolves --src to from', () => {
        const { options } = parseArgs(['pr', 'create', '--src', 'feature/x']);
        expect(options.from).toBe('feature/x');
    });

    it('resolves --destination to to', () => {
        const { options } = parseArgs(['pr', 'create', '--destination', 'develop']);
        expect(options.to).toBe('develop');
        expect((options as Record<string, unknown>).destination).toBeUndefined();
    });

    it('resolves --dest to to', () => {
        const { options } = parseArgs(['pr', 'create', '--dest', 'develop']);
        expect(options.to).toBe('develop');
    });

    it('lets the later flag win when canonical and alias both appear', () => {
        const { options } = parseArgs(['pr', 'create', '--to', 'main', '--dest', 'develop']);
        expect(options.to).toBe('develop');
    });

    it('lets the later flag win between two aliases', () => {
        const { options } = parseArgs([
            'pr',
            'create',
            '--src',
            'feature/a',
            '--source',
            'feature/b',
        ]);
        expect(options.from).toBe('feature/b');
    });

    it('lets a later canonical flag override an earlier alias', () => {
        const { options } = parseArgs([
            'pr',
            'create',
            '--src',
            'feature/a',
            '--from',
            'feature/b',
        ]);
        expect(options.from).toBe('feature/b');
    });

    it('reports the user-typed alias when the value is missing', () => {
        expect(() => parseArgs(['pr', 'create', '--dest'])).toThrow(/--dest/);
    });
});

// Workspace/repo are passed explicitly so target resolution does not depend on
// a Bitbucket git remote. The client is mocked; we assert routing + exit codes.
describe('pr comment resolve/reopen routing', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.mocked(client.resolveComment)
            .mockReset()
            .mockResolvedValue({
                id: 5,
                resolution: { type: 'pullrequest_comment_resolution' },
            } as never);
        vi.mocked(client.reopenComment)
            .mockReset()
            .mockResolvedValue({} as never);
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    const base = ['--workspace', 'ws', '--repo', 'repo'];

    it('routes resolve to client.resolveComment with pr + comment ids', async () => {
        const code = await handleBitbucket(['pr', 'comment', 'resolve', '42', '5', ...base]);
        expect(code).toBe(0);
        expect(client.resolveComment).toHaveBeenCalledWith('ws', 'repo', 42, 5);
    });

    it('routes reopen to client.reopenComment with pr + comment ids', async () => {
        const code = await handleBitbucket(['pr', 'comment', 'reopen', '42', '5', ...base]);
        expect(code).toBe(0);
        expect(client.reopenComment).toHaveBeenCalledWith('ws', 'repo', 42, 5);
    });

    it('errors with exit 1 when the comment id is missing', async () => {
        const code = await handleBitbucket(['pr', 'comment', 'resolve', '42', ...base]);
        expect(code).toBe(1);
        expect(client.resolveComment).not.toHaveBeenCalled();
    });

    it('emits raw JSON with --json', async () => {
        const code = await handleBitbucket([
            'pr',
            'comment',
            'resolve',
            '42',
            '5',
            '--json',
            ...base,
        ]);
        expect(code).toBe(0);
        const printed = logSpy.mock.calls.map(c => String(c[0])).join('\n');
        expect(printed).toContain('pullrequest_comment_resolution');
    });
});

// Resolution-state filtering on the two list surfaces. The client is mocked to
// return a fixed mixed set; we assert the rendered/JSON output only carries the
// threads/tasks matching the filter, and that the flags are mutually exclusive.
describe('pr comment list --resolved / --unresolved', () => {
    const fakeUser = {
        type: 'user' as const,
        account_id: 'acct1',
        nickname: 'alice',
        display_name: 'Alice',
    };
    // #1 resolved root + reply #2 ; #3 open root + reply #4.
    const mixedComments = [
        {
            id: 1,
            content: { raw: 'resolved root' },
            user: fakeUser,
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
            resolution: { type: 'pullrequest_comment_resolution', user: fakeUser },
        },
        {
            id: 2,
            content: { raw: 'reply to resolved' },
            user: fakeUser,
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
            parent: { id: 1 },
        },
        {
            id: 3,
            content: { raw: 'open root' },
            user: fakeUser,
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
        },
        {
            id: 4,
            content: { raw: 'reply to open' },
            user: fakeUser,
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
            parent: { id: 3 },
        },
    ];

    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.mocked(client.listComments)
            .mockReset()
            .mockResolvedValue(mixedComments as never);
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    const base = ['--workspace', 'ws', '--repo', 'repo'];
    const printed = () => logSpy.mock.calls.map(c => String(c[0])).join('\n');

    it('renders only resolved threads (with replies) under --resolved', async () => {
        const code = await handleBitbucket(['pr', 'comment', 'list', '42', '--resolved', ...base]);
        expect(code).toBe(0);
        const out = printed();
        expect(out).toContain('**#1**');
        expect(out).toContain('**#2**');
        expect(out).not.toContain('**#3**');
        expect(out).not.toContain('**#4**');
    });

    it('renders only open threads (with replies) under --unresolved', async () => {
        const code = await handleBitbucket([
            'pr',
            'comment',
            'list',
            '42',
            '--unresolved',
            ...base,
        ]);
        expect(code).toBe(0);
        const out = printed();
        expect(out).toContain('**#3**');
        expect(out).toContain('**#4**');
        expect(out).not.toContain('**#1**');
        expect(out).not.toContain('**#2**');
    });

    it('filters the --json payload too', async () => {
        const code = await handleBitbucket([
            'pr',
            'comment',
            'list',
            '42',
            '--resolved',
            '--json',
            ...base,
        ]);
        expect(code).toBe(0);
        const out = printed();
        expect(out).toContain('"id": 1');
        expect(out).toContain('"id": 2');
        expect(out).not.toContain('"id": 3');
        expect(out).not.toContain('"id": 4');
    });

    it('rejects --resolved --unresolved together with exit 1', async () => {
        const code = await handleBitbucket([
            'pr',
            'comment',
            'list',
            '42',
            '--resolved',
            '--unresolved',
            ...base,
        ]);
        expect(code).toBe(1);
        expect(client.listComments).not.toHaveBeenCalled();
    });
});

describe('pr task list --resolved / --unresolved', () => {
    const fakeUser = {
        type: 'user' as const,
        account_id: 'acct1',
        nickname: 'alice',
        display_name: 'Alice',
    };
    const mixedTasks = [
        {
            id: 1,
            content: { raw: 'open task' },
            state: 'UNRESOLVED' as const,
            creator: fakeUser,
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
        },
        {
            id: 2,
            content: { raw: 'done task' },
            state: 'RESOLVED' as const,
            creator: fakeUser,
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
        },
        {
            id: 3,
            content: { raw: 'another open task' },
            state: 'UNRESOLVED' as const,
            creator: fakeUser,
            created_on: '2025-01-01T00:00:00Z',
            updated_on: '2025-01-01T00:00:00Z',
        },
    ];

    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.mocked(client.listTasks)
            .mockReset()
            .mockResolvedValue(mixedTasks as never);
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    const base = ['--workspace', 'ws', '--repo', 'repo'];
    const printed = () => logSpy.mock.calls.map(c => String(c[0])).join('\n');

    it('renders only resolved tasks under --resolved', async () => {
        const code = await handleBitbucket(['pr', 'task', 'list', '42', '--resolved', ...base]);
        expect(code).toBe(0);
        const out = printed();
        expect(out).toContain('**#2**');
        expect(out).not.toContain('**#1**');
        expect(out).not.toContain('**#3**');
    });

    it('renders only unresolved tasks under --unresolved', async () => {
        const code = await handleBitbucket(['pr', 'task', 'list', '42', '--unresolved', ...base]);
        expect(code).toBe(0);
        const out = printed();
        expect(out).toContain('**#1**');
        expect(out).toContain('**#3**');
        expect(out).not.toContain('**#2**');
    });

    it('filters the --json payload too', async () => {
        const code = await handleBitbucket([
            'pr',
            'task',
            'list',
            '42',
            '--resolved',
            '--json',
            ...base,
        ]);
        expect(code).toBe(0);
        const out = printed();
        expect(out).toContain('"id": 2');
        expect(out).toContain('RESOLVED');
        expect(out).not.toContain('"id": 1');
        expect(out).not.toContain('"id": 3');
    });

    it('rejects --resolved --unresolved together with exit 1', async () => {
        const code = await handleBitbucket([
            'pr',
            'task',
            'list',
            '42',
            '--resolved',
            '--unresolved',
            ...base,
        ]);
        expect(code).toBe(1);
        expect(client.listTasks).not.toHaveBeenCalled();
    });
});

describe('pr mine', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errSpy: ReturnType<typeof vi.spyOn>;

    const mine = {
        id: 42,
        title: 'Add rate limit',
        state: 'OPEN',
        author: { type: 'user', account_id: 'acc-1', display_name: 'Me' },
        source: { branch: { name: 'feature/rl' } },
        destination: { branch: { name: 'main' }, repository: { full_name: 'w1/api' } },
        created_on: '2026-09-01T00:00:00Z',
        updated_on: '2026-09-02T00:00:00Z',
    };

    const stdout = () => logSpy.mock.calls.map(c => String(c[0])).join('\n');
    const stderr = () => errSpy.mock.calls.map(c => String(c[0])).join('\n');

    beforeEach(() => {
        vi.mocked(client.listMyPullRequests)
            .mockReset()
            .mockResolvedValue({ pullRequests: [mine], skipped: [] } as never);
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errSpy.mockRestore();
        vi.mocked(bbConfig.resolveTarget).mockClear();
    });

    it('works with no resolvable workspace or repository', async () => {
        vi.mocked(bbConfig.resolveTarget).mockImplementationOnce(() => {
            throw new Error('Could not resolve Bitbucket workspace/repo');
        });
        const code = await handleBitbucket(['pr', 'mine']);
        expect(code).toBe(0);
        expect(client.listMyPullRequests).toHaveBeenCalledWith({
            workspace: undefined,
            state: 'OPEN',
            limit: undefined,
        });
        expect(stderr()).not.toContain('Could not resolve');
        expect(stdout()).toContain('| Repo | ID |');
        expect(stdout()).toContain('w1/api');
    });

    it('does not narrow to a workspace resolved from af.json or the git remote', async () => {
        vi.mocked(bbConfig.resolveTarget).mockReturnValueOnce({ workspace: 'W1', repo: 'R' });
        const code = await handleBitbucket(['pr', 'mine']);
        expect(code).toBe(0);
        expect(vi.mocked(client.listMyPullRequests).mock.calls[0]?.[0]?.workspace).toBeUndefined();
    });

    it('narrows to an explicit --workspace', async () => {
        const code = await handleBitbucket(['pr', 'mine', '--workspace', 'W1']);
        expect(code).toBe(0);
        expect(vi.mocked(client.listMyPullRequests).mock.calls[0]?.[0]?.workspace).toBe('W1');
    });

    it('normalizes --state and forwards --limit', async () => {
        const code = await handleBitbucket(['pr', 'mine', '--state', 'all', '--limit', '5']);
        expect(code).toBe(0);
        expect(client.listMyPullRequests).toHaveBeenCalledWith({
            workspace: undefined,
            state: 'ALL',
            limit: 5,
        });
    });

    it('rejects an invalid --state without making requests', async () => {
        const code = await handleBitbucket(['pr', 'mine', '--state', 'BOGUS']);
        expect(code).toBe(1);
        expect(client.listMyPullRequests).not.toHaveBeenCalled();
        expect(stderr()).toContain('invalid --state BOGUS');
    });

    it('rejects --limit 0 without making requests', async () => {
        const code = await handleBitbucket(['pr', 'mine', '--limit', '0']);
        expect(code).toBe(1);
        expect(client.listMyPullRequests).not.toHaveBeenCalled();
        expect(stderr()).toContain('--limit must be a positive integer');
    });

    it('warns about skipped workspaces on stderr and still exits 0', async () => {
        vi.mocked(client.listMyPullRequests).mockResolvedValue({
            pullRequests: [mine],
            skipped: [{ workspace: 'W2', status: 403, message: 'No access' }],
        } as never);
        const code = await handleBitbucket(['pr', 'mine']);
        expect(code).toBe(0);
        expect(stderr()).toContain('skipped workspace "W2" (HTTP 403): No access');
        expect(stdout()).not.toContain('W2');
        expect(stdout()).toContain('w1/api');
    });

    it('emits a single parseable JSON array on stdout with warnings kept off it', async () => {
        vi.mocked(client.listMyPullRequests).mockResolvedValue({
            pullRequests: [mine],
            skipped: [{ workspace: 'W2', status: 404, message: 'Not found' }],
        } as never);
        const code = await handleBitbucket(['pr', 'mine', '--json']);
        expect(code).toBe(0);
        const parsed = JSON.parse(stdout());
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].id).toBe(42);
        expect(stderr()).toContain('W2');
    });

    it('renders the empty state', async () => {
        vi.mocked(client.listMyPullRequests).mockResolvedValue({
            pullRequests: [],
            skipped: [],
        } as never);
        const code = await handleBitbucket(['pr', 'mine']);
        expect(code).toBe(0);
        expect(stdout()).toContain('_No pull requests._');
    });

    it('exits 1 on an unexpected error with nothing on stdout', async () => {
        vi.mocked(client.listMyPullRequests).mockRejectedValue(new Error('HTTP 500: boom'));
        const code = await handleBitbucket(['pr', 'mine', '--json']);
        expect(code).toBe(1);
        expect(stderr()).toContain('HTTP 500: boom');
        expect(logSpy).not.toHaveBeenCalled();
    });
});

describe('pr list --state', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.mocked(client.listPullRequests)
            .mockReset()
            .mockResolvedValue([] as never);
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errSpy.mockRestore();
    });

    const base = ['--workspace', 'ws', '--repo', 'repo'];

    it('passes ALL through so the client requests every state', async () => {
        const code = await handleBitbucket(['pr', 'list', '--state', 'ALL', ...base]);
        expect(code).toBe(0);
        expect(client.listPullRequests).toHaveBeenCalledWith('ws', 'repo', {
            state: 'ALL',
            q: undefined,
        });
    });

    it('accepts SUPERSEDED', async () => {
        const code = await handleBitbucket(['pr', 'list', '--state', 'superseded', ...base]);
        expect(code).toBe(0);
        expect(client.listPullRequests).toHaveBeenCalledWith('ws', 'repo', {
            state: 'SUPERSEDED',
            q: undefined,
        });
    });

    it('rejects an invalid state with exit 1', async () => {
        const code = await handleBitbucket(['pr', 'list', '--state', 'nope', ...base]);
        expect(code).toBe(1);
        expect(client.listPullRequests).not.toHaveBeenCalled();
        expect(errSpy.mock.calls.map(c => String(c[0])).join('\n')).toContain(
            'invalid --state NOPE',
        );
    });
});

// Review/Tasks columns are always rendered; `--checks` adds Builds/Conflicts for
// exactly the displayed pull requests. Signals never change the exit code.
describe('pr list / pr mine --checks', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errSpy: ReturnType<typeof vi.spyOn>;

    const user = (id: string) => ({ type: 'user', account_id: id, display_name: id });
    const openPr = (id: number, authorId = 'acc-1') => ({
        id,
        title: `PR ${id}`,
        state: 'OPEN',
        author: user(authorId),
        source: { branch: { name: `feature/${id}` }, commit: { hash: 'abc123def456' } },
        destination: { branch: { name: 'main' }, repository: { full_name: 'w1/api' } },
        participants: [],
        reviewers: [],
        created_on: '2026-09-01T00:00:00Z',
        updated_on: '2026-09-02T00:00:00Z',
    });
    const ok = { builds: { value: [] }, conflicts: { value: { values: [] } } };

    const base = ['--workspace', 'ws', '--repo', 'repo'];
    const stdout = (): string => logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    const stderr = (): string => errSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    /** Table rows (header and separator dropped). */
    const rows = (): string[] => stdout().split('\n').slice(2);

    beforeEach(() => {
        vi.mocked(client.listPullRequests)
            .mockReset()
            .mockResolvedValue([openPr(1)] as never);
        vi.mocked(client.listMyPullRequests)
            .mockReset()
            .mockResolvedValue({ pullRequests: [openPr(1)], skipped: [] } as never);
        vi.mocked(client.listPullRequestSignals)
            .mockReset()
            .mockImplementation(async prs => prs.map(() => ok) as never);
        vi.mocked(bbRequest).mockReset();
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        errSpy.mockRestore();
    });

    it.each([
        ['pr list', ['pr', 'list', ...base]],
        ['pr mine', ['pr', 'mine']],
    ])('%s without --checks fetches no signals and renders Review and Tasks', async (_, argv) => {
        const code = await handleBitbucket(argv);
        expect(code).toBe(0);
        expect(client.listPullRequestSignals).not.toHaveBeenCalled();
        expect(stdout()).toContain('| Review | Tasks | Updated |');
        expect(stdout()).not.toContain('Builds');
        expect(stdout()).not.toContain('Conflicts');
    });

    it('pr list --mine --checks fetches signals only for the caller’s pull requests', async () => {
        const mine = openPr(1, 'acc-1');
        const theirs = openPr(2, 'acc-2');
        const mineToo = openPr(3, 'acc-1');
        vi.mocked(client.listPullRequests).mockResolvedValue([mine, theirs, mineToo] as never);
        vi.mocked(bbRequest).mockResolvedValue({ account_id: 'acc-1' } as never);

        const code = await handleBitbucket(['pr', 'list', '--mine', '--checks', ...base]);

        expect(code).toBe(0);
        expect(bbRequest).toHaveBeenCalledWith('https://api.bitbucket.org/2.0/user');
        expect(client.listPullRequestSignals).toHaveBeenCalledTimes(1);
        expect(client.listPullRequestSignals).toHaveBeenCalledWith([mine, mineToo]);
        expect(stdout()).toContain('| Review | Tasks | Builds | Conflicts | Updated |');
        expect(rows()).toHaveLength(2);
    });

    it('pr mine --limit 5 --checks fetches signals for exactly the listed pull requests', async () => {
        const listed = [1, 2, 3, 4, 5].map(id => openPr(id));
        vi.mocked(client.listMyPullRequests).mockResolvedValue({
            pullRequests: listed,
            skipped: [],
        } as never);

        const code = await handleBitbucket(['pr', 'mine', '--limit', '5', '--checks']);

        expect(code).toBe(0);
        expect(client.listMyPullRequests).toHaveBeenCalledWith({
            workspace: undefined,
            state: 'OPEN',
            limit: 5,
        });
        expect(client.listPullRequestSignals).toHaveBeenCalledTimes(1);
        expect(vi.mocked(client.listPullRequestSignals).mock.calls[0]?.[0]).toBe(listed);
        expect(rows()).toHaveLength(5);
    });

    it.each([
        ['pr mine', ['pr', 'mine', '--checks', '--json']],
        ['pr list', ['pr', 'list', '--checks', '--json', ...base]],
    ])('%s --checks --json prints the raw array and a notice on stderr', async (_, argv) => {
        const code = await handleBitbucket(argv);
        expect(code).toBe(0);
        expect(client.listPullRequestSignals).not.toHaveBeenCalled();
        expect(JSON.parse(stdout())).toEqual([openPr(1)]);
        expect(stderr()).toContain('--checks has no effect with --json');
        expect(errSpy).toHaveBeenCalledTimes(1);
    });

    it('reports repeated signal failures as one stderr line and exits 0', async () => {
        const listed = Array.from({ length: 12 }, (_, i) => openPr(i + 1));
        vi.mocked(client.listMyPullRequests).mockResolvedValue({
            pullRequests: listed,
            skipped: [],
        } as never);
        vi.mocked(client.listPullRequestSignals).mockResolvedValue(
            listed.map(() => ({
                builds: { value: [] },
                conflicts: { error: { status: 401, message: 'Unauthorized' } },
            })) as never,
        );

        const code = await handleBitbucket(['pr', 'mine', '--checks']);

        expect(code).toBe(0);
        expect(errSpy).toHaveBeenCalledTimes(1);
        expect(stderr()).toBe(
            'Warning: conflicts unavailable for 12 pull requests (HTTP 401: Unauthorized)',
        );
        expect(rows()).toHaveLength(12);
        // Builds — (no statuses), Conflicts ? (unavailable), then Updated.
        expect(rows().every(row => /\| — \| \? \| [^|]+ \|$/.test(row))).toBe(true);
    });

    it('renders an unavailable signal as ? and keeps every other row intact', async () => {
        vi.mocked(client.listMyPullRequests).mockResolvedValue({
            pullRequests: [openPr(1), openPr(2)],
            skipped: [],
        } as never);
        vi.mocked(client.listPullRequestSignals).mockResolvedValue([
            { builds: { value: [] }, conflicts: { error: { status: 403, message: 'Forbidden' } } },
            ok,
        ] as never);

        const code = await handleBitbucket(['pr', 'mine', '--checks']);

        expect(code).toBe(0);
        const [first, second] = rows();
        expect(first).toMatch(/^\| w1\/api \| #1 \| OPEN \| PR 1 \| .* \| — \| \? \| /);
        expect(second).toMatch(/^\| w1\/api \| #2 \| OPEN \| PR 2 \| .* \| — \| ✓ none \| /);
        expect(stderr()).toBe(
            'Warning: conflicts unavailable for 1 pull request (HTTP 403: Forbidden)',
        );
    });

    it('renders — without a warning for a pull request that was not checked', async () => {
        const merged = { ...openPr(2), state: 'MERGED' };
        vi.mocked(client.listMyPullRequests).mockResolvedValue({
            pullRequests: [openPr(1), merged],
            skipped: [],
        } as never);
        vi.mocked(client.listPullRequestSignals).mockResolvedValue([ok, null] as never);

        const code = await handleBitbucket(['pr', 'mine', '--state', 'ALL', '--checks']);

        expect(code).toBe(0);
        expect(rows()[1]).toMatch(/^\| w1\/api \| #2 \| MERGED \| .* \| — \| — \| [^|]+ \|$/);
        expect(errSpy).not.toHaveBeenCalled();
    });

    it('still exits 0 when the signals are adverse, rendering them', async () => {
        const adverse = {
            ...openPr(1),
            task_count: 3,
            reviewers: [user('r1')],
            participants: [
                { user: user('r1'), role: 'REVIEWER', approved: false, state: 'changes_requested' },
            ],
        };
        vi.mocked(client.listMyPullRequests).mockResolvedValue({
            pullRequests: [adverse],
            skipped: [],
        } as never);
        vi.mocked(client.listPullRequestSignals).mockResolvedValue([
            {
                builds: {
                    value: [{ key: 'ci', state: 'FAILED', commit: { hash: 'abc123def456' } }],
                },
                conflicts: { value: { values: [{ path: 'a.ts' }, { path: 'b.ts' }] } },
            },
        ] as never);

        const code = await handleBitbucket(['pr', 'mine', '--checks']);

        expect(code).toBe(0);
        expect(rows()[0]).toContain('| ✗1 | 3 | ✗ 1 failed | ✗ 2 |');
        expect(errSpy).not.toHaveBeenCalled();
    });

    it('a failing list request with --checks exits 1 without fetching signals', async () => {
        vi.mocked(client.listPullRequests).mockRejectedValue(new Error('HTTP 500: boom'));

        const code = await handleBitbucket(['pr', 'list', '--checks', ...base]);

        expect(code).toBe(1);
        expect(client.listPullRequestSignals).not.toHaveBeenCalled();
        expect(stderr()).toContain('HTTP 500: boom');
        expect(logSpy).not.toHaveBeenCalled();
    });
});

/** The message `parseArgs` throws for argv; fails the test when it accepts argv. */
function parseError(argv: string[]): string {
    try {
        parseArgs(argv);
    } catch (err) {
        return (err as Error).message;
    }
    throw new Error(`expected parseArgs to reject: ${argv.join(' ')}`);
}

// `--name=value` is split at the first `=` on every subcommand, before the alias
// lookup, so the value may be empty or contain `=`. Boolean flags take no value.
describe('parseArgs --name=value', () => {
    it('takes an inline body after =', () => {
        const { options } = parseArgs(['pr', 'comment', 'add', '42', '--body=LGTM']);
        expect(options.body).toBe('LGTM');
    });

    it('resolves a branch alias written with =', () => {
        const { options } = parseArgs(['pr', 'create', '--title', 'T', '--src=feature/x']);
        expect(options.from).toBe('feature/x');
        expect((options as Record<string, unknown>).src).toBeUndefined();
    });

    it('splits a repeatable option at its first = only', () => {
        const { options } = parseArgs([
            'pipeline',
            'trigger',
            '--branch',
            'main',
            '--var=FOO=bar',
            '--var',
            'X=1',
        ]);
        expect(options.var).toEqual(['FOO=bar', 'X=1']);
    });

    it('parses a numeric option written with =', () => {
        const { options } = parseArgs([
            'pr',
            'comment',
            'add',
            '42',
            '--body',
            'x',
            '--file',
            'a.ts',
            '--line=10',
        ]);
        expect(options.line).toBe(10);
    });

    it('takes - after = as the stdin marker of a file flag', () => {
        const { options } = parseArgs(['pr', 'comment', 'add', '42', '--body-file=-']);
        expect(options['body-file']).toBe('-');
    });

    it('keeps an empty value and does not consume the next argument', () => {
        const { args, options } = parseArgs(['pr', 'update', '42', '--description=', '--json']);
        expect(options.description).toBe('');
        expect(options.json).toBe(true);
        expect(args).toEqual(['update', '42']);
    });

    it.each([
        ['--draft=true', 'Option --draft does not take a value'],
        ['--draft=', 'Option --draft does not take a value'],
        ['--json=1', 'Option --json does not take a value'],
    ])('rejects the boolean %s', (token, message) => {
        expect(parseError(['pr', 'create', '--title', 'T', token])).toBe(message);
    });
});

// The pull request prose commands (pr create, pr update, and every pr comment and
// pr task action) reject unknown options and extra positional arguments while
// parsing, so nothing is read or sent. Other subcommands stay lenient.
describe('parseArgs strict checking on pull request prose commands', () => {
    it('rejects --add on pr comment add, suggests --body and lists the accepted options', () => {
        expect(parseError(['pr', 'comment', 'add', '42', '--add', 'LGTM'])).toBe(
            [
                "Unknown option --add for 'af bitbucket pr comment add'. Did you mean --body?",
                'Accepted options: --body, --body-file, --file, --line, --reply-to, --json, --workspace, --repo',
                "Run 'af bitbucket --help' for usage.",
            ].join('\n'),
        );
    });

    it('rejects --body on pr create and suggests --description', () => {
        expect(parseError(['pr', 'create', '--title', 'Fix', '--body', 'Details'])).toMatch(
            /^Unknown option --body for 'af bitbucket pr create'\. Did you mean --description\?\n/,
        );
    });

    it('names the second word of an unquoted body and explains quoting', () => {
        expect(parseError(['pr', 'comment', 'add', '42', '--body', 'Looks', 'good'])).toBe(
            [
                'Unexpected argument "good" for \'af bitbucket pr comment add\'.',
                'Text with spaces or apostrophes must be quoted, or sent with --body-file (a path, or - with a quoted heredoc).',
            ].join('\n'),
        );
    });

    it('rejects an option the action does not accept, naming it and the command', () => {
        const message = parseError(['pr', 'update', '42', '--close-source']);
        expect(message).toContain("Unknown option --close-source for 'af bitbucket pr update'.");
        expect(message).toContain(
            'Accepted options: --title, --description, --description-file, --reviewers, --ready, --draft, --json, --workspace, --repo',
        );
    });

    it('accepts --ready and --draft on pr update', () => {
        expect(parseArgs(['pr', 'update', '42', '--draft']).options.draft).toBe(true);
        const { options } = parseArgs(['pr', 'update', '42', '--ready', '--title', 'T']);
        expect(options).toEqual({ ready: true, title: 'T' });
    });

    it('rejects an update option on the draft aliases, naming it and the alias', () => {
        expect(parseError(['pr', 'ready', '42', '--title', 'New title']).split('\n')).toEqual([
            "Unknown option --title for 'af bitbucket pr ready'.",
            'Accepted options: --json, --workspace, --repo',
            "Run 'af bitbucket --help' for usage.",
        ]);
        expect(parseError(['pr', 'draft', '42', '--ready'])).toMatch(
            /^Unknown option --ready for 'af bitbucket pr draft'\.\n/,
        );
    });

    it('rejects --ready written with a value', () => {
        expect(parseError(['pr', 'update', '42', '--ready=true'])).toBe(
            'Option --ready does not take a value',
        );
    });

    it('accepts the global options and the branch aliases', () => {
        const { subcommand, args, options } = parseArgs([
            'pr',
            'create',
            '--title',
            'T',
            '--src',
            'feature/x',
            '--dest',
            'main',
            '--workspace',
            'ws',
            '--repo',
            'r',
            '--json',
        ]);
        expect(subcommand).toBe('pr');
        expect(args).toEqual(['create']);
        expect(options).toEqual({
            title: 'T',
            from: 'feature/x',
            to: 'main',
            workspace: 'ws',
            repo: 'r',
            json: true,
        });
        expect(() =>
            parseArgs(['pr', 'create', '--source', 'a', '--destination', 'b', '--draft']),
        ).not.toThrow();
    });

    it('checks an alias and an option written with = by the name as typed', () => {
        expect(parseError(['pr', 'update', '42', '--src', 'x'])).toMatch(
            /^Unknown option --src for 'af bitbucket pr update'\.\n/,
        );
        expect(parseError(['pr', 'comment', 'add', '42', '--add=LGTM'])).toMatch(
            /^Unknown option --add for 'af bitbucket pr comment add'\. Did you mean --body\?\n/,
        );
    });

    it('points a stray - at the file flag', () => {
        expect(parseError(['pr', 'task', 'add', '42', '-'])).toBe(
            [
                'Unexpected argument "-" for \'af bitbucket pr task add\'.',
                'To read stdin, use --body-file -.',
            ].join('\n'),
        );
    });

    it('covers the actions that take no body, without the quoting hint', () => {
        expect(parseError(['pr', 'comment', 'resolve', '42', '5', '6'])).toBe(
            'Unexpected argument "6" for \'af bitbucket pr comment resolve\'.',
        );
        expect(parseError(['pr', 'task', 'delete', '42', '7', '--body', 'x'])).toMatch(
            /^Unknown option --body for 'af bitbucket pr task delete'\.\n/,
        );
        expect(parseError(['pr', 'comment', 'list', '42', '--state', 'OPEN'])).toMatch(
            /^Unknown option --state for 'af bitbucket pr comment list'\.\n/,
        );
    });

    it('accepts the options of every pr comment and pr task action', () => {
        const accepted = [
            ['pr', 'comment', 'list', '42', '--resolved', '--json'],
            ['pr', 'comment', 'get', '42', '5'],
            ['pr', 'comment', 'add', '42', '--body', 'x', '--file', 'a.ts', '--line', '3'],
            ['pr', 'comment', 'add', '42', '--body-file', '-', '--reply-to', '5'],
            ['pr', 'comment', 'update', '42', '5', '--body', 'x'],
            ['pr', 'comment', 'delete', '42', '5', '--workspace', 'ws'],
            ['pr', 'comment', 'resolve', '42', '5', '--repo', 'r'],
            ['pr', 'comment', 'reopen', '42', '5'],
            ['pr', 'task', 'list', '42', '--unresolved'],
            ['pr', 'task', 'add', '42', '--body', 'x', '--on-comment', '5'],
            ['pr', 'task', 'update', '42', '7', '--body-file', 'f.md', '--resolved'],
            ['pr', 'task', 'delete', '42', '7'],
            ['pr', 'update', '42', '--title', 'T', '--description-file', '-', '--reviewers', 'a'],
            ['pr', 'update', '42', '--description-file', 'final.md', '--ready'],
            ['pr', 'ready', '42', '--json'],
            ['pr', 'draft', '42', '--workspace', 'ws', '--repo', 'r'],
        ];
        for (const argv of accepted) expect(() => parseArgs(argv)).not.toThrow();
    });

    it('leaves other subcommands and unknown actions lenient', () => {
        expect(() => parseArgs(['pr', 'list', '--bogus', 'x', 'extra'])).not.toThrow();
        expect(() => parseArgs(['pr', 'comment', 'archive', '42', '--bogus', 'x'])).not.toThrow();
        expect(() => parseArgs(['pr', 'merge', '42', '--body', 'x'])).not.toThrow();
        expect(() => parseArgs(['pipeline', 'list', '--bogus', 'x'])).not.toThrow();
    });

    // A trailing option has no value to take. When the command does not accept
    // it, it is reported as unknown, with its suggestion, rather than as an
    // option that needs a value (which would suggest that it exists).
    it('names a trailing option the action does not accept as unknown', () => {
        expect(parseError(['pr', 'task', 'update', '42', '7', '--resolve'])).toBe(
            [
                "Unknown option --resolve for 'af bitbucket pr task update'. Did you mean --resolved?",
                'Accepted options: --body, --body-file, --resolved, --unresolved, --json, --workspace, --repo',
                "Run 'af bitbucket --help' for usage.",
            ].join('\n'),
        );
        expect(parseError(['pr', 'comment', 'add', '42', '--body', 'x', '--comment'])).toMatch(
            /^Unknown option --comment for 'af bitbucket pr comment add'\. Did you mean --body\?\n/,
        );
    });

    it('still reports a missing value for an accepted option and on lenient commands', () => {
        expect(parseError(['pr', 'comment', 'add', '42', '--body'])).toBe(
            'Option --body requires a value',
        );
        expect(parseError(['pr', 'list', '--state'])).toBe('Option --state requires a value');
    });
});

// Design D10, row by row: each strict command's options besides the globals (in
// order), its positional limit after `pr`, and its prose pair. The messages show
// all three, so these tests fail when the rule table drifts from the design.
describe('parseArgs strict rule table (design D10)', () => {
    type Prose = { inline: string; file: string };
    const description: Prose = { inline: '--description', file: '--description-file' };
    const body: Prose = { inline: '--body', file: '--body-file' };
    const rows: [string, string[], number, Prose | undefined][] = [
        [
            'create',
            [
                '--title',
                '--description',
                '--description-file',
                '--from',
                '--source',
                '--src',
                '--to',
                '--destination',
                '--dest',
                '--reviewers',
                '--draft',
            ],
            1,
            description,
        ],
        [
            'update',
            ['--title', '--description', '--description-file', '--reviewers', '--ready', '--draft'],
            2,
            description,
        ],
        ['ready', [], 2, undefined],
        ['draft', [], 2, undefined],
        ['comment list', ['--resolved', '--unresolved'], 3, undefined],
        ['comment add', ['--body', '--body-file', '--file', '--line', '--reply-to'], 3, body],
        ['comment update', ['--body', '--body-file'], 4, body],
        ['comment get', [], 4, undefined],
        ['comment delete', [], 4, undefined],
        ['comment resolve', [], 4, undefined],
        ['comment reopen', [], 4, undefined],
        ['task list', ['--resolved', '--unresolved'], 3, undefined],
        ['task add', ['--body', '--body-file', '--on-comment'], 3, body],
        ['task update', ['--body', '--body-file', '--resolved', '--unresolved'], 4, body],
        ['task delete', [], 4, undefined],
    ];
    const globals = ['--json', '--workspace', '--repo'];
    const booleans = new Set(['--draft', '--ready', '--resolved', '--unresolved', '--json']);
    /** `pr <words>` followed by ids up to the command's positional limit. */
    const commandLine = (words: string, maxPositionals: number): string[] => {
        const head = words.split(' ');
        return ['pr', ...head, ...['42', '5'].slice(0, maxPositionals - head.length)];
    };

    it.each(rows)('pr %s accepts exactly its options and the globals', (words, options, max) => {
        const accepted = [...options, ...globals];
        const argv = [
            ...commandLine(words, max),
            ...accepted.flatMap(option => (booleans.has(option) ? [option] : [option, '1'])),
        ];
        expect(() => parseArgs(argv)).not.toThrow();
        expect(parseError([...commandLine(words, max), '--zzz=1']).split('\n')).toEqual([
            `Unknown option --zzz for 'af bitbucket pr ${words}'.`,
            `Accepted options: ${accepted.join(', ')}`,
            "Run 'af bitbucket --help' for usage.",
        ]);
    });

    it.each(rows)('pr %s rejects one positional argument too many', (words, _, max, prose) => {
        const lines = parseError([...commandLine(words, max), 'extra']).split('\n');
        expect(lines[0]).toBe(`Unexpected argument "extra" for 'af bitbucket pr ${words}'.`);
        expect(lines.slice(1)).toEqual(
            prose
                ? [
                      `Text with spaces or apostrophes must be quoted, or sent with ${prose.file} (a path, or - with a quoted heredoc).`,
                  ]
                : [],
        );
    });

    it.each(rows.filter(row => row[3] !== undefined))(
        'pr %s maps the prose flags of other commands to its own pair',
        (words, _, max, prose) => {
            const firstLine = (option: string): string =>
                parseError([...commandLine(words, max), `${option}=x`]).split('\n')[0];
            const command = `'af bitbucket pr ${words}'`;
            expect(firstLine('--comment')).toBe(
                `Unknown option --comment for ${command}. Did you mean ${prose?.inline}?`,
            );
            expect(firstLine('--comment-file')).toBe(
                `Unknown option --comment-file for ${command}. Did you mean ${prose?.file}?`,
            );
        },
    );

    it.each(rows.filter(row => row[3] === undefined))(
        'pr %s, which takes no prose, suggests nothing for a prose flag',
        (words, _, max) => {
            const message = parseError([...commandLine(words, max), '--comment=x']);
            expect(message.split('\n')[0]).toBe(
                `Unknown option --comment for 'af bitbucket pr ${words}'.`,
            );
        },
    );

    // The Bitbucket rows of the design D11 suggestion table.
    it.each([
        [['pr', 'comment', 'add', '42', '--reply', '5'], 'comment add', '--reply', '--reply-to'],
        [['pr', 'create', '--reviewer', 'a'], 'create', '--reviewer', '--reviewers'],
        [['pr', 'create', '--target', 'main'], 'create', '--target', undefined],
    ])('%j gives the design D11 suggestion', (argv, words, typed, suggestion) => {
        expect(parseError(argv).split('\n')[0]).toBe(
            `Unknown option ${typed} for 'af bitbucket pr ${words}'.` +
                (suggestion ? ` Did you mean ${suggestion}?` : ''),
        );
    });
});

// Comment and task bodies and PR descriptions come inline, from a file, or from
// stdin with `-`. The client is mocked; stdin goes through the spied
// `defaultTextInputIo`, and files are written at runtime to a temporary directory.
describe('pull request prose input', () => {
    const user = { type: 'user', account_id: 'acc-1', display_name: 'Me' };
    const stamp = '2026-09-01T00:00:00Z';
    const comment = { id: 5, content: { raw: 'ok' }, user, created_on: stamp, updated_on: stamp };
    const task = {
        id: 7,
        content: { raw: 'ok' },
        state: 'UNRESOLVED',
        creator: user,
        created_on: stamp,
        updated_on: stamp,
    };
    const pullRequest = {
        id: 42,
        title: 'T',
        state: 'OPEN',
        author: user,
        source: { branch: { name: 'a' } },
        destination: { branch: { name: 'b' } },
        created_on: stamp,
        updated_on: stamp,
    };
    const heredoc = '## Summary\n\n- First point\n';
    const BOM = String.fromCharCode(0xfeff);
    const base = ['--workspace', 'ws', '--repo', 'repo'];
    const run = (...argv: string[]): Promise<number> => handleBitbucket([...argv, ...base]);

    let logSpy: MockInstance<typeof console.log>;
    let errSpy: MockInstance<typeof console.error>;
    let readStdin: MockInstance<() => string>;
    let stdinIsTTY: MockInstance<() => boolean>;
    let dir: string;

    const stdout = (): string => logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    const stderr = (): string => errSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    /** Writes a fixture at runtime (fixtures are never committed) and returns its path. */
    const inputFile = (name: string, text: string): string => {
        const path = join(dir, name);
        writeFileSync(path, text);
        return path;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(client.addComment)
            .mockReset()
            .mockResolvedValue(comment as never);
        vi.mocked(client.updateComment)
            .mockReset()
            .mockResolvedValue(comment as never);
        vi.mocked(client.addTask)
            .mockReset()
            .mockResolvedValue(task as never);
        vi.mocked(client.updateTask)
            .mockReset()
            .mockResolvedValue(task as never);
        vi.mocked(client.createPullRequest)
            .mockReset()
            .mockResolvedValue(pullRequest as never);
        vi.mocked(client.getPullRequest)
            .mockReset()
            .mockResolvedValue(pullRequest as never);
        vi.mocked(client.updatePullRequest)
            .mockReset()
            .mockResolvedValue(pullRequest as never);
        vi.mocked(client.getCurrentBranch).mockReset().mockReturnValue('feature/current');
        vi.mocked(client.getRepository)
            .mockReset()
            .mockResolvedValue({ mainbranch: { name: 'main' } } as never);
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        // A test that reads stdin gives it text; any other read fails the command.
        readStdin = vi.spyOn(defaultTextInputIo, 'readStdin').mockImplementation(() => {
            throw new Error('stdin must not be read');
        });
        stdinIsTTY = vi.spyOn(defaultTextInputIo, 'stdinIsTTY').mockReturnValue(false);
        dir = mkdtempSync(join(tmpdir(), 'af-text-input-'));
    });

    afterEach(() => {
        logSpy.mockRestore();
        errSpy.mockRestore();
        readStdin.mockRestore();
        stdinIsTTY.mockRestore();
        rmSync(dir, { recursive: true, force: true });
    });

    describe('pr comment add', () => {
        it.each([[['--body-file', '-']], [['--body-file=-']]])(
            'posts a quoted heredoc from stdin byte for byte with %j',
            async flags => {
                readStdin.mockReturnValue(heredoc);
                const code = await run('pr', 'comment', 'add', '42', ...flags);
                expect(code).toBe(0);
                expect(readStdin).toHaveBeenCalledTimes(1);
                expect(client.addComment).toHaveBeenCalledWith('ws', 'repo', 42, {
                    body: heredoc,
                    inline: undefined,
                    parentId: undefined,
                });
                expect(errSpy).not.toHaveBeenCalled();
            },
        );

        it('prints the stdin hint to stderr on a terminal and keeps --json stdout clean', async () => {
            stdinIsTTY.mockReturnValue(true);
            readStdin.mockReturnValue(heredoc);
            const code = await run('pr', 'comment', 'add', '42', '--body-file', '-', '--json');
            expect(code).toBe(0);
            expect(stderr()).toBe(
                'Reading --body-file from stdin. Type the text, then press Ctrl-D on an empty line.',
            );
            expect(JSON.parse(stdout())).toEqual(comment);
        });

        it('rejects --body with --body-file - without reading stdin', async () => {
            const code = await run('pr', 'comment', 'add', '42', '--body', 'x', '--body-file', '-');
            expect(code).toBe(1);
            expect(stderr()).toContain('Cannot use both --body and --body-file');
            expect(readStdin).not.toHaveBeenCalled();
            expect(client.addComment).not.toHaveBeenCalled();
        });

        it('reports a missing file as File not found', async () => {
            expect(existsSync('missing.md')).toBe(false);
            const code = await run('pr', 'comment', 'add', '42', '--body-file', 'missing.md');
            expect(code).toBe(1);
            expect(stderr()).toContain('File not found: missing.md');
            expect(client.addComment).not.toHaveBeenCalled();
        });

        it.each([
            [
                'escape-like sequences',
                'Logs are in C:\\new\\notes\\app.log\n',
                'Logs are in C:\\new\\notes\\app.log\n',
            ],
            ['CRLF line endings', '## Title\r\n\r\n- one\r\n', '## Title\r\n\r\n- one\r\n'],
            ['a leading byte-order mark', `${BOM}## Title\n`, '## Title\n'],
        ])(
            'sends file text with %s as typed, dropping only a leading BOM',
            async (_, text, sent) => {
                const path = inputFile('notes.md', text);
                const code = await run('pr', 'comment', 'add', '42', '--body-file', path);
                expect(code).toBe(0);
                expect(vi.mocked(client.addComment).mock.calls[0]?.[3]?.body).toBe(sent);
            },
        );

        it('takes - on --body as the text itself, without reading stdin', async () => {
            const code = await run('pr', 'comment', 'add', '42', '--body', '-');
            expect(code).toBe(0);
            expect(readStdin).not.toHaveBeenCalled();
            expect(vi.mocked(client.addComment).mock.calls[0]?.[3]?.body).toBe('-');
        });

        it('takes an inline body written with =', async () => {
            const code = await run('pr', 'comment', 'add', '42', '--body=LGTM');
            expect(code).toBe(0);
            expect(client.addComment).toHaveBeenCalledWith('ws', 'repo', 42, {
                body: 'LGTM',
                inline: undefined,
                parentId: undefined,
            });
        });
    });

    describe('empty bodies', () => {
        it.each<[string, unknown]>([
            ['pr comment add 42', client.addComment],
            ['pr comment update 42 5', client.updateComment],
            ['pr task add 42', client.addTask],
            ['pr task update 42 7', client.updateTask],
        ])('%s rejects an empty inline --body without a request', async (command, request) => {
            const code = await run(...command.split(' '), '--body', '');
            expect(code).toBe(1);
            expect(stderr()).toContain(
                '--body is empty. Give the text, or use --body-file (a path, or - for stdin)',
            );
            expect(request).not.toHaveBeenCalled();
        });

        it('rejects a whitespace-only inline body', async () => {
            const code = await run('pr', 'task', 'add', '42', '--body', ' \n\t');
            expect(code).toBe(1);
            expect(stderr()).toContain('--body is empty');
            expect(client.addTask).not.toHaveBeenCalled();
        });

        it('pr task add rejects empty stdin without creating a task', async () => {
            readStdin.mockReturnValue('');
            const code = await run('pr', 'task', 'add', '42', '--body-file', '-');
            expect(code).toBe(1);
            expect(stderr()).toContain('--body-file -: no text on stdin');
            expect(client.addTask).not.toHaveBeenCalled();
        });

        it('pr comment update rejects a whitespace-only file', async () => {
            const path = inputFile('blank.md', '  \n\n');
            const code = await run('pr', 'comment', 'update', '42', '5', '--body-file', path);
            expect(code).toBe(1);
            expect(stderr()).toContain(`--body-file ${path}: the file contains no text`);
            expect(client.updateComment).not.toHaveBeenCalled();
        });
    });

    describe('pr comment update and pr task update', () => {
        it('pr comment update sends the file text', async () => {
            const path = inputFile('reply.md', heredoc);
            const code = await run('pr', 'comment', 'update', '42', '5', '--body-file', path);
            expect(code).toBe(0);
            expect(client.updateComment).toHaveBeenCalledWith('ws', 'repo', 42, 5, heredoc);
        });

        it('pr comment update --body-file - sends the stdin text', async () => {
            readStdin.mockReturnValue(heredoc);
            const code = await run('pr', 'comment', 'update', '42', '5', '--body-file', '-');
            expect(code).toBe(0);
            expect(readStdin).toHaveBeenCalledTimes(1);
            expect(client.updateComment).toHaveBeenCalledWith('ws', 'repo', 42, 5, heredoc);
        });

        it('pr task update --body "" --resolved exits 1 without updating the task', async () => {
            const code = await run('pr', 'task', 'update', '42', '7', '--body', '', '--resolved');
            expect(code).toBe(1);
            expect(stderr()).toContain('--body is empty');
            expect(client.updateTask).not.toHaveBeenCalled();
        });

        it('pr task update --resolved without a body flag leaves the body alone', async () => {
            const code = await run('pr', 'task', 'update', '42', '7', '--resolved');
            expect(code).toBe(0);
            expect(client.updateTask).toHaveBeenCalledWith('ws', 'repo', 42, 7, {
                body: undefined,
                state: 'RESOLVED',
            });
        });

        it('pr task update --body-file - sends the stdin text', async () => {
            readStdin.mockReturnValue(heredoc);
            const code = await run('pr', 'task', 'update', '42', '7', '--body-file', '-');
            expect(code).toBe(0);
            expect(client.updateTask).toHaveBeenCalledWith('ws', 'repo', 42, 7, {
                body: heredoc,
                state: undefined,
            });
        });

        it('pr task add --body-file - creates the task from the stdin text', async () => {
            readStdin.mockReturnValue(heredoc);
            const code = await run(
                'pr',
                'task',
                'add',
                '42',
                '--body-file',
                '-',
                '--on-comment',
                '5',
            );
            expect(code).toBe(0);
            expect(client.addTask).toHaveBeenCalledWith('ws', 'repo', 42, {
                body: heredoc,
                onCommentId: 5,
            });
        });
    });

    describe('pr create and pr update descriptions', () => {
        it('pr create --description-file - passes the stdin text as the description', async () => {
            readStdin.mockReturnValue(heredoc);
            const code = await run(
                'pr',
                'create',
                '--title',
                'T',
                '--from',
                'a',
                '--to',
                'b',
                '--description-file',
                '-',
            );
            expect(code).toBe(0);
            expect(client.createPullRequest).toHaveBeenCalledWith('ws', 'repo', {
                title: 'T',
                source: 'a',
                destination: 'b',
                description: heredoc,
                reviewerAccountIds: undefined,
                draft: undefined,
            });
        });

        it('pr create --description "" still sends an empty description', async () => {
            const code = await run(
                'pr',
                'create',
                '--title',
                'T',
                '--from',
                'a',
                '--to',
                'b',
                '--description',
                '',
            );
            expect(code).toBe(0);
            expect(vi.mocked(client.createPullRequest).mock.calls[0]?.[2]?.description).toBe('');
        });

        // The spec scenario as typed: no --from or --to. The current branch is
        // detected first (local git), then stdin is read, and only then is the
        // repository's main branch looked up over the network (design D8).
        it('pr create --title "Fix bug" --description-file - reads stdin before the main branch lookup', async () => {
            readStdin.mockReturnValue(heredoc);
            const code = await run('pr', 'create', '--title', 'Fix bug', '--description-file', '-');
            expect(code).toBe(0);
            expect(client.createPullRequest).toHaveBeenCalledWith('ws', 'repo', {
                title: 'Fix bug',
                source: 'feature/current',
                destination: 'main',
                description: heredoc,
                reviewerAccountIds: undefined,
                draft: undefined,
            });
            const [branch] = vi.mocked(client.getCurrentBranch).mock.invocationCallOrder;
            const [read] = readStdin.mock.invocationCallOrder;
            const [lookup] = vi.mocked(client.getRepository).mock.invocationCallOrder;
            expect(branch).toBeLessThan(read);
            expect(read).toBeLessThan(lookup);
        });

        // The PUT also resends the fetched title and (empty) reviewer list.
        it('pr update --description-file - sends the stdin text as the description', async () => {
            readStdin.mockReturnValue(heredoc);
            const code = await run('pr', 'update', '42', '--description-file', '-');
            expect(code).toBe(0);
            expect(client.updatePullRequest).toHaveBeenCalledWith('ws', 'repo', 42, {
                title: 'T',
                description: heredoc,
                reviewers: [],
            });
            // The text is read before the pull request is fetched.
            const [read] = readStdin.mock.invocationCallOrder;
            const [fetch] = vi.mocked(client.getPullRequest).mock.invocationCallOrder;
            expect(read).toBeLessThan(fetch);
        });

        it('pr update --description "" sends an empty description, clearing it', async () => {
            const code = await run('pr', 'update', '42', '--description', '');
            expect(code).toBe(0);
            expect(client.updatePullRequest).toHaveBeenCalledWith('ws', 'repo', 42, {
                title: 'T',
                description: '',
                reviewers: [],
            });
        });

        it('pr update rejects --description with --description-file - without reading stdin', async () => {
            const code = await run(
                'pr',
                'update',
                '42',
                '--description',
                'x',
                '--description-file',
                '-',
            );
            expect(code).toBe(1);
            expect(stderr()).toContain('Cannot use both --description and --description-file');
            expect(readStdin).not.toHaveBeenCalled();
            expect(client.updatePullRequest).not.toHaveBeenCalled();
        });

        it('pr create reports a missing description file before any request', async () => {
            expect(existsSync('missing.md')).toBe(false);
            const code = await run(
                'pr',
                'create',
                '--title',
                'T',
                '--description-file',
                'missing.md',
            );
            expect(code).toBe(1);
            expect(stderr()).toContain('File not found: missing.md');
            expect(client.getRepository).not.toHaveBeenCalled();
            expect(client.createPullRequest).not.toHaveBeenCalled();
        });

        it.each<[string, string[], string]>([
            ['--title is missing', ['--from', 'a', '--description-file', '-'], '--title required'],
            [
                'no source branch is found',
                ['--title', 'T', '--description-file', '-'],
                '--from required',
            ],
        ])(
            'pr create checks its arguments before reading stdin when %s',
            async (_, flags, message) => {
                vi.mocked(client.getCurrentBranch).mockReturnValue(null);
                const code = await run('pr', 'create', ...flags);
                expect(code).toBe(1);
                expect(stderr()).toContain(message);
                expect(readStdin).not.toHaveBeenCalled();
                expect(client.createPullRequest).not.toHaveBeenCalled();
            },
        );

        it('pr create resolves a branch alias written with =', async () => {
            const code = await run('pr', 'create', '--title', 'T', '--src=feature/x');
            expect(code).toBe(0);
            expect(client.createPullRequest).toHaveBeenCalledWith(
                'ws',
                'repo',
                expect.objectContaining({ source: 'feature/x', destination: 'main' }),
            );
        });

        it('pr create accepts the global options and the branch aliases', async () => {
            const code = await handleBitbucket([
                'pr',
                'create',
                '--title',
                'T',
                '--src',
                'feature/x',
                '--dest',
                'main',
                '--workspace',
                'ws',
                '--repo',
                'r',
                '--json',
            ]);
            expect(code).toBe(0);
            expect(client.createPullRequest).toHaveBeenCalledWith(
                'ws',
                'r',
                expect.objectContaining({ title: 'T', source: 'feature/x', destination: 'main' }),
            );
            expect(client.getRepository).not.toHaveBeenCalled();
            expect(JSON.parse(stdout())).toEqual(pullRequest);
        });
    });

    describe('strict checking in the handler', () => {
        it.each<[string, string[], string[], unknown]>([
            [
                '--add on pr comment add',
                ['pr', 'comment', 'add', '42', '--add', 'LGTM'],
                ["Unknown option --add for 'af bitbucket pr comment add'. Did you mean --body?"],
                client.addComment,
            ],
            [
                '--body on pr create',
                ['pr', 'create', '--title', 'Fix', '--body', 'Details'],
                ["Unknown option --body for 'af bitbucket pr create'. Did you mean --description?"],
                client.createPullRequest,
            ],
            [
                'an unquoted multi-word body',
                ['pr', 'comment', 'add', '42', '--body', 'Looks', 'good'],
                ['Unexpected argument "good"', 'must be quoted'],
                client.addComment,
            ],
            [
                '--title on pr ready',
                ['pr', 'ready', '42', '--title', 'New title'],
                ["Unknown option --title for 'af bitbucket pr ready'."],
                client.getPullRequest,
            ],
            [
                '--ready=true on pr update',
                ['pr', 'update', '42', '--ready=true'],
                ['Option --ready does not take a value'],
                client.getPullRequest,
            ],
            [
                '--draft=true on pr create',
                ['pr', 'create', '--title', 'T', '--draft=true'],
                ['Option --draft does not take a value'],
                client.createPullRequest,
            ],
        ])('rejects %s with exit 1 and sends nothing', async (_, argv, messages, request) => {
            const code = await run(...argv);
            expect(code).toBe(1);
            for (const message of messages) expect(stderr()).toContain(message);
            expect(request).not.toHaveBeenCalled();
            expectNothingSent();
            expect(readStdin).not.toHaveBeenCalled();
            expect(logSpy).not.toHaveBeenCalled();
        });
    });

    // Design D8: every argument check runs before the text is read. Stdin holds
    // text here, so reading it too early would go unnoticed without the
    // `readStdin` assertion.
    describe('argument checks before stdin is read', () => {
        const requests = [
            client.addComment,
            client.updateComment,
            client.addTask,
            client.updateTask,
            client.createPullRequest,
            client.getPullRequest,
            client.updatePullRequest,
            client.getRepository,
        ];

        it.each<[string, string[], string]>([
            [
                'pr comment add has no pr id',
                ['pr', 'comment', 'add', '--body-file', '-'],
                'pr id required',
            ],
            [
                'pr comment add has --file without --line',
                ['pr', 'comment', 'add', '42', '--body-file', '-', '--file', 'a.ts'],
                '--file and --line must be supplied together',
            ],
            [
                'pr comment update has no comment id',
                ['pr', 'comment', 'update', '42', '--body-file', '-'],
                'comment id required',
            ],
            [
                'pr task add has no pr id',
                ['pr', 'task', 'add', '--body-file', '-'],
                'pr id required',
            ],
            [
                'pr task update has no task id',
                ['pr', 'task', 'update', '42', '--body-file', '-'],
                'task id required',
            ],
            [
                'pr task update has --resolved and --unresolved',
                [
                    'pr',
                    'task',
                    'update',
                    '42',
                    '7',
                    '--body-file',
                    '-',
                    '--resolved',
                    '--unresolved',
                ],
                '--resolved and --unresolved are mutually exclusive',
            ],
            [
                'pr update has no pr id',
                ['pr', 'update', '--description-file', '-'],
                'pr id required',
            ],
            [
                'pr update has --ready and --draft',
                ['pr', 'update', '42', '--description-file', '-', '--ready', '--draft'],
                'Error: --ready and --draft are mutually exclusive',
            ],
        ])('exits 1 without reading stdin when %s', async (_, argv, message) => {
            readStdin.mockReturnValue(heredoc);
            const code = await run(...argv);
            expect(code).toBe(1);
            expect(stderr()).toContain(message);
            expect(readStdin).not.toHaveBeenCalled();
            for (const request of requests) expect(request).not.toHaveBeenCalled();
        });

        it.each([
            [['pr', 'comment', 'add', '42', '--body-file', '-']],
            [['pr', 'create', '--title', 'T', '--description-file', '-']],
        ])('%j exits 1 without reading stdin when no repository resolves', async argv => {
            vi.mocked(bbConfig.resolveTarget).mockImplementationOnce(() => {
                throw new Error('Could not resolve Bitbucket workspace and repo');
            });
            readStdin.mockReturnValue(heredoc);
            const code = await handleBitbucket(argv);
            expect(code).toBe(1);
            expect(stderr()).toContain('Could not resolve Bitbucket workspace and repo');
            expect(readStdin).not.toHaveBeenCalled();
            for (const request of requests) expect(request).not.toHaveBeenCalled();
        });
    });
});

// `pr update --ready | --draft`, the `pr ready` / `pr draft` aliases, the list
// filters and the merge hint. Every PUT resends the current title, description
// and reviewers (bitbucket/lib/update.ts); the client is mocked.
describe('pull request draft state', () => {
    const user = (id: string) => ({ type: 'user', account_id: id, display_name: id });
    const stamp = '2026-11-01T00:00:00Z';
    /** Pull request 42: open, not a draft, with a description and reviewers a1 and a2. */
    const openPr = (overrides: Record<string, unknown> = {}) => ({
        id: 42,
        title: 'Current title',
        description: 'Current description',
        state: 'OPEN',
        draft: false,
        author: user('me'),
        source: { branch: { name: 'feature/x' } },
        destination: { branch: { name: 'main' }, repository: { full_name: 'ws/repo' } },
        reviewers: [user('a1'), user('a2')],
        participants: [],
        created_on: stamp,
        updated_on: stamp,
        ...overrides,
    });
    const draftPr = () => openPr({ draft: true });
    /** What the mocked PUT returns. */
    const updated = openPr({ title: 'Returned by the PUT' });
    const CURRENT_REVIEWERS = [{ account_id: 'a1' }, { account_id: 'a2' }];
    const base = ['--workspace', 'ws', '--repo', 'repo'];
    const run = (...argv: string[]): Promise<number> => handleBitbucket([...argv, ...base]);

    let logSpy: MockInstance<typeof console.log>;
    let errSpy: MockInstance<typeof console.error>;
    let readStdin: MockInstance<() => string>;
    let dir: string;

    const stdout = (): string => logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    const stderr = (): string => errSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    /** The body of the one PUT that was sent. */
    const putBody = (): unknown => {
        expect(client.updatePullRequest).toHaveBeenCalledTimes(1);
        return vi.mocked(client.updatePullRequest).mock.calls[0]?.[3];
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(client.getPullRequest)
            .mockReset()
            .mockResolvedValue(openPr() as never);
        vi.mocked(client.updatePullRequest)
            .mockReset()
            .mockResolvedValue(updated as never);
        vi.mocked(client.mergePullRequest)
            .mockReset()
            .mockResolvedValue(openPr({ state: 'MERGED' }) as never);
        vi.mocked(client.listPullRequests)
            .mockReset()
            .mockResolvedValue([] as never);
        vi.mocked(client.listMyPullRequests)
            .mockReset()
            .mockResolvedValue({ pullRequests: [], skipped: [] } as never);
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        readStdin = vi.spyOn(defaultTextInputIo, 'readStdin').mockImplementation(() => {
            throw new Error('stdin must not be read');
        });
        dir = mkdtempSync(join(tmpdir(), 'af-draft-state-'));
    });

    afterEach(() => {
        logSpy.mockRestore();
        errSpy.mockRestore();
        readStdin.mockRestore();
        rmSync(dir, { recursive: true, force: true });
    });

    describe('argument errors', () => {
        it.each<[string, string[], string]>([
            [
                'pr update --ready --draft',
                ['pr', 'update', '42', '--ready', '--draft'],
                'Error: --ready and --draft are mutually exclusive',
            ],
            [
                'pr list --draft --ready',
                ['pr', 'list', '--draft', '--ready'],
                'Error: --ready and --draft are mutually exclusive',
            ],
            [
                'pr mine --draft --ready',
                ['pr', 'mine', '--draft', '--ready'],
                'Error: --ready and --draft are mutually exclusive',
            ],
            [
                'pr update without a change flag',
                ['pr', 'update', '42'],
                'Error: pr update needs at least one of --title, --description, ' +
                    '--description-file, --reviewers, --ready or --draft',
            ],
            ['pr ready without an id', ['pr', 'ready'], 'Error: pr id required'],
            ['pr draft without an id', ['pr', 'draft'], 'Error: pr id required'],
            [
                'pr ready with --title',
                ['pr', 'ready', '42', '--title', 'New title'],
                "Unknown option --title for 'af bitbucket pr ready'.",
            ],
            [
                'pr update --ready=true',
                ['pr', 'update', '42', '--ready=true'],
                'Option --ready does not take a value',
            ],
        ])('%s exits 1 and sends nothing', async (_, argv, message) => {
            const code = await run(...argv);
            expect(code).toBe(1);
            expect(stderr()).toContain(message);
            expectNothingSent();
            expect(readStdin).not.toHaveBeenCalled();
            expect(logSpy).not.toHaveBeenCalled();
        });
    });

    describe('pr update', () => {
        it('fetches the pull request before the PUT', async () => {
            const code = await run('pr', 'update', '42', '--title', 'New title');
            expect(code).toBe(0);
            expect(client.getPullRequest).toHaveBeenCalledWith('ws', 'repo', 42);
            const [fetch] = vi.mocked(client.getPullRequest).mock.invocationCallOrder;
            const [put] = vi.mocked(client.updatePullRequest).mock.invocationCallOrder;
            expect(fetch).toBeLessThan(put);
            expect(client.updatePullRequest).toHaveBeenCalledWith('ws', 'repo', 42, {
                title: 'New title',
                description: 'Current description',
                reviewers: CURRENT_REVIEWERS,
            });
            expect(stdout()).toContain('Returned by the PUT');
        });

        it('replaces the reviewer list with --reviewers', async () => {
            await run('pr', 'update', '42', '--reviewers', 'a3');
            expect(putBody()).toEqual({
                title: 'Current title',
                description: 'Current description',
                reviewers: [{ account_id: 'a3' }],
            });
        });

        it.each<[string, string[]]>([
            ['--reviewers ""', ['--reviewers', '']],
            ['--reviewers=', ['--reviewers=']],
        ])('%s clears the reviewers', async (_, flag) => {
            const code = await run('pr', 'update', '42', ...flag);
            expect(code).toBe(0);
            expect(putBody()).toEqual({
                title: 'Current title',
                description: 'Current description',
                reviewers: [],
            });
        });

        it('--ready with --reviewers "" on a ready pull request still clears the reviewers', async () => {
            const code = await run('pr', 'update', '42', '--ready', '--reviewers', '');
            expect(code).toBe(0);
            expect(putBody()).toEqual({
                title: 'Current title',
                description: 'Current description',
                reviewers: [],
            });
        });

        it('accepts --draft and moves an open pull request back to draft', async () => {
            const code = await run('pr', 'update', '42', '--draft');
            expect(code).toBe(0);
            expect(putBody()).toEqual({
                title: 'Current title',
                description: 'Current description',
                reviewers: CURRENT_REVIEWERS,
                draft: true,
            });
        });

        it('--ready marks a draft ready, keeping its reviewers', async () => {
            vi.mocked(client.getPullRequest).mockResolvedValue(draftPr() as never);
            const code = await run('pr', 'update', '42', '--ready');
            expect(code).toBe(0);
            expect(putBody()).toEqual({
                title: 'Current title',
                description: 'Current description',
                reviewers: CURRENT_REVIEWERS,
                draft: false,
            });
        });

        it('finishes a draft in one PUT with --description-file and --ready', async () => {
            vi.mocked(client.getPullRequest).mockResolvedValue(draftPr() as never);
            const path = join(dir, 'final.md');
            writeFileSync(path, '## Final\n\nReady for review.\n');
            const code = await run('pr', 'update', '42', '--description-file', path, '--ready');
            expect(code).toBe(0);
            expect(putBody()).toEqual({
                title: 'Current title',
                description: '## Final\n\nReady for review.\n',
                reviewers: CURRENT_REVIEWERS,
                draft: false,
            });
        });

        it('leaves an unchanged draft state out of the body', async () => {
            await run('pr', 'update', '42', '--title', 'T2', '--ready');
            expect(putBody()).not.toHaveProperty('draft');
            expect(putBody()).toMatchObject({ title: 'T2' });
        });

        it.each(['MERGED', 'DECLINED', 'SUPERSEDED'])(
            'reports a %s pull request and sends no PUT',
            async state => {
                vi.mocked(client.getPullRequest).mockResolvedValue(openPr({ state }) as never);
                const code = await run('pr', 'update', '42', '--title', 'T');
                expect(code).toBe(1);
                expect(stderr()).toContain(
                    `Error: pull request 42 is ${state}; only open pull requests can be updated`,
                );
                expect(client.updatePullRequest).not.toHaveBeenCalled();
                expect(logSpy).not.toHaveBeenCalled();
            },
        );

        it('prints the notice and sends no PUT when the pull request is already ready', async () => {
            const code = await run('pr', 'update', '42', '--ready');
            expect(code).toBe(0);
            expect(stdout()).toBe('Pull request 42 is already ready for review');
            expect(client.getPullRequest).toHaveBeenCalledTimes(1);
            expect(client.updatePullRequest).not.toHaveBeenCalled();
            expect(errSpy).not.toHaveBeenCalled();
        });

        it('with --json, prints the fetched pull request on stdout and the notice on stderr', async () => {
            const code = await run('pr', 'update', '42', '--ready', '--json');
            expect(code).toBe(0);
            expect(JSON.parse(stdout())).toEqual(openPr());
            expect(stderr()).toBe('Pull request 42 is already ready for review');
            expect(client.updatePullRequest).not.toHaveBeenCalled();
        });

        it('with --json, prints the pull request the PUT returned', async () => {
            const code = await run('pr', 'update', '42', '--title', 'New title', '--json');
            expect(code).toBe(0);
            expect(JSON.parse(stdout())).toEqual(updated);
        });
    });

    describe('pr ready and pr draft', () => {
        it('pr ready sends draft: false to a draft, keeping title, description and reviewers', async () => {
            vi.mocked(client.getPullRequest).mockResolvedValue(draftPr() as never);
            const code = await run('pr', 'ready', '42');
            expect(code).toBe(0);
            expect(client.updatePullRequest).toHaveBeenCalledWith('ws', 'repo', 42, {
                title: 'Current title',
                description: 'Current description',
                reviewers: CURRENT_REVIEWERS,
                draft: false,
            });
            expect(stdout()).toContain('Returned by the PUT');
        });

        it('pr draft sends draft: true to an open pull request', async () => {
            const code = await run('pr', 'draft', '42');
            expect(code).toBe(0);
            expect(putBody()).toMatchObject({ draft: true });
        });

        it('pr draft prints the notice and sends no PUT when it is already a draft', async () => {
            vi.mocked(client.getPullRequest).mockResolvedValue(draftPr() as never);
            const code = await run('pr', 'draft', '42');
            expect(code).toBe(0);
            expect(stdout()).toBe('Pull request 42 is already a draft');
            expect(client.updatePullRequest).not.toHaveBeenCalled();
        });

        it('pr ready prints the notice when the pull request is already ready', async () => {
            const code = await run('pr', 'ready', '42');
            expect(code).toBe(0);
            expect(stdout()).toBe('Pull request 42 is already ready for review');
            expect(client.updatePullRequest).not.toHaveBeenCalled();
        });

        it('pr ready reports a pull request that is not open', async () => {
            vi.mocked(client.getPullRequest).mockResolvedValue(
                openPr({ state: 'DECLINED', draft: true }) as never,
            );
            const code = await run('pr', 'ready', '42');
            expect(code).toBe(1);
            expect(stderr()).toContain('pull request 42 is DECLINED');
            expect(client.updatePullRequest).not.toHaveBeenCalled();
        });

        it('pr ready --json prints the raw pull request the PUT returned', async () => {
            vi.mocked(client.getPullRequest).mockResolvedValue(draftPr() as never);
            const code = await run('pr', 'ready', '42', '--json');
            expect(code).toBe(0);
            expect(JSON.parse(stdout())).toEqual(updated);
        });
    });

    // The resent reviewer list can contain an inactive user, which Bitbucket
    // rejects with "Malformed reviewers list" (BCLOUD-23093, design Risks).
    describe('a rejected reviewer list', () => {
        it('adds the --reviewers hint after Bitbucket’s message on a 400 that mentions reviewers', async () => {
            vi.mocked(client.getPullRequest).mockResolvedValue(draftPr() as never);
            vi.mocked(client.updatePullRequest).mockRejectedValue(
                new AtlassianHttpError('Malformed reviewers list', 400),
            );
            const code = await run('pr', 'ready', '42');
            expect(code).toBe(1);
            expect(errSpy).toHaveBeenCalledTimes(2);
            const [message, hint] = errSpy.mock.calls.map((c: unknown[]) => String(c[0]));
            expect(message).toContain('Error: Malformed reviewers list');
            expect(hint).toContain('an update resends the current reviewers');
            expect(hint).toContain('Pass --reviewers to pr update');
            expect(hint).toContain('remove the inactive reviewer in Bitbucket');
            expect(logSpy).not.toHaveBeenCalled();
        });

        it('adds the hint when only Bitbucket’s field errors mention reviewers', async () => {
            // atlassian/lib/request.ts appends the envelope's error.fields to a generic message.
            vi.mocked(client.updatePullRequest).mockRejectedValue(
                new AtlassianHttpError('Bad request\nreviewers: Malformed reviewers list', 400),
            );
            const code = await run('pr', 'update', '42', '--title', 'T');
            expect(code).toBe(1);
            expect(stderr()).toContain('Error: Bad request\nreviewers: Malformed reviewers list');
            expect(stderr()).toContain('Pass --reviewers to pr update');
        });

        it.each<[string, Error]>([
            ['a 400 that does not mention reviewers', new AtlassianHttpError('Bad title', 400)],
            ['a 500 that mentions reviewers', new AtlassianHttpError('reviewers unavailable', 500)],
            ['a network error that mentions reviewers', new Error('reviewers: fetch failed')],
        ])('prints only Bitbucket’s message for %s', async (_, failure) => {
            vi.mocked(client.updatePullRequest).mockRejectedValue(failure);
            const code = await run('pr', 'update', '42', '--title', 'T');
            expect(code).toBe(1);
            expect(errSpy).toHaveBeenCalledTimes(1);
            expect(stderr()).toContain(`Error: ${failure.message}`);
            expect(stderr()).not.toContain('--reviewers');
        });
    });

    describe('list filters', () => {
        it('pr list --draft sends q=draft=true', async () => {
            const code = await run('pr', 'list', '--draft');
            expect(code).toBe(0);
            expect(client.listPullRequests).toHaveBeenCalledWith('ws', 'repo', {
                state: 'OPEN',
                q: 'draft=true',
            });
        });

        it('pr list --ready sends q=draft=false', async () => {
            await run('pr', 'list', '--ready');
            expect(vi.mocked(client.listPullRequests).mock.calls[0]?.[2]?.q).toBe('draft=false');
        });

        it('pr list --author alice --draft joins both clauses with AND', async () => {
            await run('pr', 'list', '--author', 'alice', '--draft');
            expect(vi.mocked(client.listPullRequests).mock.calls[0]?.[2]?.q).toBe(
                'author.nickname="alice" AND draft=true',
            );
        });

        it('pr mine --ready passes q=draft=false', async () => {
            const code = await handleBitbucket(['pr', 'mine', '--ready']);
            expect(code).toBe(0);
            expect(client.listMyPullRequests).toHaveBeenCalledWith({
                workspace: undefined,
                state: 'OPEN',
                q: 'draft=false',
                limit: undefined,
            });
        });

        it('pr mine --draft --limit 2 filters on the server and keeps the limit', async () => {
            await handleBitbucket(['pr', 'mine', '--draft', '--limit', '2']);
            expect(client.listMyPullRequests).toHaveBeenCalledWith(
                expect.objectContaining({ q: 'draft=true', limit: 2 }),
            );
        });

        it('pr list and pr mine send no q without a filter', async () => {
            await run('pr', 'list');
            await handleBitbucket(['pr', 'mine']);
            expect(vi.mocked(client.listPullRequests).mock.calls[0]?.[2]?.q).toBeUndefined();
            expect(vi.mocked(client.listMyPullRequests).mock.calls[0]?.[0]?.q).toBeUndefined();
        });

        it('pr list marks a draft as OPEN (draft) in the State cell', async () => {
            vi.mocked(client.listPullRequests).mockResolvedValue([
                openPr({ id: 7, draft: true }),
                openPr({ id: 8 }),
            ] as never);
            await run('pr', 'list');
            const rows = stdout().split('\n').slice(2);
            expect(rows[0]).toMatch(/^\| #7 \| OPEN \(draft\) \| /);
            expect(rows[1]).toMatch(/^\| #8 \| OPEN \| /);
        });
    });

    // The merge-error fixture of task 1.5 does not exist: the sandbox spike did
    // not run. These errors are synthetic. The hint must depend only on the
    // `draft` field of the follow-up GET, never on the error text.
    describe('pr merge of a draft', () => {
        it('prints Bitbucket’s message, then the draft hint, and exits 1', async () => {
            vi.mocked(client.mergePullRequest).mockRejectedValue(
                new AtlassianHttpError('Merge checks failed', 400),
            );
            vi.mocked(client.getPullRequest).mockResolvedValue(draftPr() as never);
            const code = await run('pr', 'merge', '42');
            expect(code).toBe(1);
            expect(client.getPullRequest).toHaveBeenCalledWith('ws', 'repo', 42);
            const lines = errSpy.mock.calls.map((c: unknown[]) => String(c[0]));
            expect(lines).toHaveLength(2);
            expect(lines[0]).toContain('Error: Merge checks failed');
            expect(lines[1]).toContain(
                'Error: PR #42 is a draft and cannot be merged. Mark it ready first: af bb pr ready 42',
            );
            expect(logSpy).not.toHaveBeenCalled();
        });

        it('prints only Bitbucket’s message when the pull request is not a draft', async () => {
            // The text mentions a draft, yet only the fetched draft field counts.
            vi.mocked(client.mergePullRequest).mockRejectedValue(
                new AtlassianHttpError('Draft pull requests cannot be merged', 400),
            );
            const code = await run('pr', 'merge', '42');
            expect(code).toBe(1);
            expect(client.getPullRequest).toHaveBeenCalledTimes(1);
            expect(errSpy).toHaveBeenCalledTimes(1);
            expect(stderr()).toContain('Error: Draft pull requests cannot be merged');
            expect(stderr()).not.toContain('af bb pr ready');
        });

        it('prints only Bitbucket’s message when the follow-up GET fails', async () => {
            vi.mocked(client.mergePullRequest).mockRejectedValue(
                new AtlassianHttpError('Merge checks failed', 400),
            );
            vi.mocked(client.getPullRequest).mockRejectedValue(new AtlassianHttpError('Gone', 404));
            const code = await run('pr', 'merge', '42');
            expect(code).toBe(1);
            expect(errSpy).toHaveBeenCalledTimes(1);
            expect(stderr()).toContain('Error: Merge checks failed');
            expect(stderr()).not.toContain('Gone');
        });

        it('does not fetch the pull request after a failure that is not an HTTP error', async () => {
            vi.mocked(client.mergePullRequest).mockRejectedValue(new TypeError('fetch failed'));
            const code = await run('pr', 'merge', '42');
            expect(code).toBe(1);
            expect(client.getPullRequest).not.toHaveBeenCalled();
            expect(stderr()).toContain('Error: fetch failed');
        });

        it('makes no request besides the merge when it succeeds', async () => {
            const code = await run('pr', 'merge', '42');
            expect(code).toBe(0);
            expect(client.mergePullRequest).toHaveBeenCalledTimes(1);
            expect(client.getPullRequest).not.toHaveBeenCalled();
            expect(stdout()).toContain('| State | MERGED |');
        });
    });
});

describe('pipeline trigger --var=KEY=VALUE', () => {
    let logSpy: MockInstance<typeof console.log>;

    beforeEach(() => {
        vi.mocked(client.triggerPipeline)
            .mockReset()
            .mockResolvedValue({ uuid: '{p}' } as never);
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('passes the variable split at its first =', async () => {
        const code = await handleBitbucket([
            'pipeline',
            'trigger',
            '--branch',
            'main',
            '--var=FOO=bar',
            '--json',
            '--workspace',
            'ws',
            '--repo',
            'repo',
        ]);
        expect(code).toBe(0);
        expect(client.triggerPipeline).toHaveBeenCalledWith('ws', 'repo', {
            branch: 'main',
            commit: undefined,
            custom: undefined,
            variables: [{ key: 'FOO', value: 'bar' }],
        });
    });
});

// The full reference, which `af help bitbucket` and `af help bb` also print.
describe('showBitbucketHelp', () => {
    let logSpy: MockInstance<typeof console.log>;
    const printed = (): string => logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');

    /** The reference as `showBitbucketHelp` prints it. */
    const reference = (): string => {
        logSpy.mockClear();
        showBitbucketHelp();
        const text = printed();
        logSpy.mockClear();
        return text;
    };

    beforeEach(() => {
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it.each([[['--help']], [['-h']], [[]], [['help']], [['pr', 'comment', 'add', '--help']]])(
        'handleBitbucket(%j) prints the full reference',
        async argv => {
            const expected = reference();
            expect(await handleBitbucket(argv)).toBe(0);
            expect(printed()).toBe(expected);
        },
    );

    it('documents - on the file flags and how the text is sent', () => {
        const help = reference();
        expect(help).toContain('--body-file <path|->');
        expect(help).toContain('--description-file <path|->');
        expect(help).toContain('sent as typed; Bitbucket renders');
        expect(help).toContain('as markdown');
        expect(help).toContain('\\n stays a backslash and an n; it is never');
        expect(help).toContain('pr comment add');
        expect(help).toContain('pr task add');
    });

    it('documents the draft commands, flags and behaviour', () => {
        const help = reference();
        const prose = help.replace(/\s+/g, ' ');
        expect(help).toContain('pr ready <id>');
        expect(help).toContain('pr draft <id>');
        expect(help).toContain('[--reviewers a,b] [--ready | --draft]');
        // pr list and pr mine each wrap the draft filter onto their second line.
        expect(help.match(/^ {10}\[--draft \| --ready\] \[--checks\]$/gm)).toHaveLength(2);
        expect(prose).toContain(
            'Reviewers on a draft are not notified until it is marked ready, and a draft cannot be merged',
        );
        expect(help).toContain('af bb pr update 42 --description-file final.md --ready');
        expect(prose).toContain('pr create, pr update, pr ready, pr draft, pr comment and pr task');
    });

    it('prints the multi-line example flush-left so it can be copied', () => {
        const lines = reference().split('\n');
        const start = lines.indexOf("af bb pr comment add 42 --body-file - <<'AF_BODY'");
        expect(start).toBeGreaterThan(-1);
        expect(lines.slice(start, start + 5)).toEqual([
            "af bb pr comment add 42 --body-file - <<'AF_BODY'",
            '## Summary',
            '',
            '- First point',
            'AF_BODY',
        ]);
    });

    it('prints the MULTI-LINE TEXT section in the design D12 wording', () => {
        const lines = reference().split('\n');
        const start = lines.indexOf('MULTI-LINE TEXT:');
        expect(start).toBeGreaterThan(-1);
        expect(lines.slice(start, start + 11)).toEqual([
            'MULTI-LINE TEXT:',
            `  Inside "double" or 'single' quotes, \\n stays a backslash and an n; it is never`,
            '  a newline. Double quotes also run `commands` and expand $VARS. For multi-line',
            '  text, use a -file flag: pass a path, or - and a quoted heredoc (keep AF_BODY',
            '  at the start of its line):',
            '',
            "af bb pr comment add 42 --body-file - <<'AF_BODY'",
            '## Summary',
            '',
            '- First point',
            'AF_BODY',
        ]);
    });
});
