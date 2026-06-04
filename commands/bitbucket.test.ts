import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, handleBitbucket } from './bitbucket.ts';
import * as client from '../bitbucket/lib/client.ts';

vi.mock('../bitbucket/lib/client.ts', () => ({
    resolveComment: vi.fn(),
    reopenComment: vi.fn(),
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
