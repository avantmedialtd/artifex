import { describe, it, expect, vi } from 'vitest';
import { handleHelp } from './help.ts';
import { handleJira } from './jira.ts';
import { handleConfluence } from './confluence.ts';
import { handleBitbucket } from './bitbucket.ts';

// Captures everything a call prints through console.log.
async function printed(run: () => Promise<unknown>): Promise<string> {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        lines.push(args.map(String).join(' '));
    });
    try {
        await run();
    } finally {
        spy.mockRestore();
    }
    return lines.join('\n');
}

const PRODUCTS = [
    {
        name: 'jira',
        handler: handleJira,
        example: "af jira comment PROJ-123 --body-file - <<'AF_BODY'",
    },
    {
        name: 'confluence',
        handler: handleConfluence,
        example: "af confluence comment 12345 --body-file - <<'AF_BODY'",
    },
    {
        name: 'bitbucket',
        handler: handleBitbucket,
        example: "af bb pr comment add 42 --body-file - <<'AF_BODY'",
    },
];

describe('product help', () => {
    describe.each(PRODUCTS)('$name', ({ name, handler, example }) => {
        it(`af help ${name} prints the same reference as af ${name} --help`, async () => {
            const viaHelp = await printed(() => handleHelp(name));
            expect(viaHelp).toBe(await printed(() => handler(['--help'])));
            expect(viaHelp).toBe(await printed(() => handler([])));
            expect(viaHelp).toBe(await printed(() => handler(['help'])));
        });

        it('prints the multi-line example as five consecutive lines at column 0', async () => {
            const lines = (await printed(() => handleHelp(name))).split('\n');
            const start = lines.indexOf(example);
            expect(start).toBeGreaterThanOrEqual(0);
            expect(lines.slice(start, start + 5)).toEqual([
                example,
                '## Summary',
                '',
                '- First point',
                'AF_BODY',
            ]);
        });
    });

    it('af help bb prints the bitbucket reference', async () => {
        expect(await printed(() => handleHelp('bb'))).toBe(
            await printed(() => handleHelp('bitbucket')),
        );
    });

    it('documents the Jira prose flags and what their text becomes', async () => {
        const help = await printed(() => handleHelp('jira'));
        for (const required of [
            '--body-file',
            '--description-file',
            '--comment-file',
            '--add',
            'wiki markup',
            'plain text',
        ]) {
            expect(help).toContain(required);
        }
    });
});

describe('unknown help topics', () => {
    it.each(['__proto__', 'constructor', 'valueOf', 'hasOwnProperty', 'nope'])(
        'af help %s reports an unknown command',
        async topic => {
            const errors: string[] = [];
            const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
                errors.push(args.map(String).join(' '));
            });
            try {
                let code: number | undefined;
                const out = await printed(async () => {
                    code = await handleHelp(topic);
                });
                expect(code).toBe(0);
                expect(errors.join('\n')).toContain(`Unknown command: ${topic}`);
                expect(out).toContain("Run 'af help' to see all available commands.");
            } finally {
                spy.mockRestore();
            }
        },
    );
});
