import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, handleBitbucket } from './bitbucket.ts';
import * as client from '../bitbucket/lib/client.ts';
import * as bbConfig from '../bitbucket/lib/config.ts';

vi.mock('../bitbucket/lib/client.ts', () => ({
    resolveComment: vi.fn(),
    reopenComment: vi.fn(),
    listComments: vi.fn(),
    listTasks: vi.fn(),
    listPullRequests: vi.fn(),
    listMyPullRequests: vi.fn(),
}));

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
