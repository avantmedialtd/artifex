import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { parseArgs, handleBitbucket, showBitbucketHelp } from './bitbucket.ts';
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
    updatePullRequest: vi.fn(),
    getCurrentBranch: vi.fn(),
    getRepository: vi.fn(),
    triggerPipeline: vi.fn(),
}));

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
        const message = parseError(['pr', 'update', '42', '--draft']);
        expect(message).toContain("Unknown option --draft for 'af bitbucket pr update'.");
        expect(message).toContain(
            'Accepted options: --title, --description, --description-file, --reviewers, --json, --workspace, --repo',
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
            ['--title', '--description', '--description-file', '--reviewers'],
            2,
            description,
        ],
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
    const booleans = new Set(['--draft', '--resolved', '--unresolved', '--json']);
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

        it('pr update --description-file - sends the stdin text as the description', async () => {
            readStdin.mockReturnValue(heredoc);
            const code = await run('pr', 'update', '42', '--description-file', '-');
            expect(code).toBe(0);
            expect(client.updatePullRequest).toHaveBeenCalledWith('ws', 'repo', 42, {
                title: undefined,
                description: heredoc,
                reviewerAccountIds: undefined,
            });
        });

        it('pr update --description "" sends an empty description, clearing it', async () => {
            const code = await run('pr', 'update', '42', '--description', '');
            expect(code).toBe(0);
            expect(client.updatePullRequest).toHaveBeenCalledWith('ws', 'repo', 42, {
                title: undefined,
                description: '',
                reviewerAccountIds: undefined,
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
                '--draft on pr update',
                ['pr', 'update', '42', '--draft'],
                ["Unknown option --draft for 'af bitbucket pr update'."],
                client.updatePullRequest,
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
