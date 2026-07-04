import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, handleBitbucket } from './bitbucket.ts';
import * as client from '../bitbucket/lib/client.ts';

vi.mock('../bitbucket/lib/client.ts', () => ({
    resolveComment: vi.fn(),
    reopenComment: vi.fn(),
    listComments: vi.fn(),
    listTasks: vi.fn(),
}));

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
