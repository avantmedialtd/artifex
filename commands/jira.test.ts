// cspell:words descripton Dont frobnicate noequals
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';

// Partial mock: jira/lib/formatters.ts imports adfToText from the client, so
// the real module is spread and only the request functions are replaced.
vi.mock('../jira/lib/client.ts', async importOriginal => ({
    ...(await importOriginal<typeof import('../jira/lib/client.ts')>()),
    getIssue: vi.fn(),
    getComments: vi.fn(),
    addComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    addServiceDeskComment: vi.fn(),
    createIssue: vi.fn(),
    updateIssue: vi.fn(),
    transitionIssue: vi.fn(),
    getWorklogs: vi.fn(),
    addWorklog: vi.fn(),
    updateWorklog: vi.fn(),
    deleteWorklog: vi.fn(),
    createVersion: vi.fn(),
    updateVersion: vi.fn(),
}));

// `--field` resolves custom fields through the field registry, which fetches.
// The registry lookup is mocked; the real local --field / --field-json checks run.
vi.mock('../jira/lib/fields/resolve-flags.ts', async importOriginal => ({
    ...(await importOriginal<typeof import('../jira/lib/fields/resolve-flags.ts')>()),
    resolveFieldFlags: vi.fn(),
}));

import { handleJira, parseArgs } from './jira.ts';
import * as client from '../jira/lib/client.ts';
import { resolveFieldFlags } from '../jira/lib/fields/resolve-flags.ts';
import { defaultTextInputIo, type TextInputIo } from '../utils/text-input.ts';

const HINT = 'Reading --body-file from stdin. Type the text, then press Ctrl-D on an empty line.';
const MARKDOWN = '## Summary\n\n- First point\n';

const BODY = { inline: '--body', file: '--body-file' };
const DESCRIPTION = { inline: '--description', file: '--description-file' };
const COMMENT = { inline: '--comment', file: '--comment-file' };

// Design D10, row by row. `argv` is the subcommand and its action, followed by
// as many positional arguments as the rule takes. `options` leaves out the
// global --json, which every rule accepts last.
const D10_RULES: {
    argv: string[];
    command: string;
    options: string[];
    prose?: { inline: string; file: string };
}[] = [
    {
        argv: ['comment', 'PROJ-1'],
        command: 'af jira comment',
        options: ['--body', '--body-file', '--add', '--visibility', '--internal', '--public'],
        prose: BODY,
    },
    {
        argv: ['comment', 'edit', 'PROJ-1', '10042'],
        command: 'af jira comment edit',
        options: ['--body', '--body-file', '--add', '--visibility'],
        prose: BODY,
    },
    {
        argv: ['comment', 'delete', 'PROJ-1', '10042'],
        command: 'af jira comment delete',
        options: [],
    },
    {
        argv: ['create'],
        command: 'af jira create',
        options: [
            '--project',
            '--type',
            '--summary',
            '--description',
            '--description-file',
            '--priority',
            '--labels',
            '--parent',
            '--estimate',
            '--fix-version',
            '--affected-version',
            '--field',
            '--field-json',
        ],
        prose: DESCRIPTION,
    },
    {
        argv: ['update', 'PROJ-1'],
        command: 'af jira update',
        options: [
            '--summary',
            '--description',
            '--description-file',
            '--priority',
            '--labels',
            '--estimate',
            '--remaining',
            '--fix-version',
            '--affected-version',
            '--parent',
            '--clear-parent',
            '--field',
            '--field-json',
        ],
        prose: DESCRIPTION,
    },
    {
        argv: ['transition', 'PROJ-1'],
        command: 'af jira transition',
        options: ['--to', '--resolution', '--comment', '--comment-file', '--field'],
        prose: COMMENT,
    },
    {
        argv: ['worklog', 'list', 'PROJ-1'],
        command: 'af jira worklog list',
        options: [],
    },
    {
        argv: ['worklog', 'add', 'PROJ-1'],
        command: 'af jira worklog add',
        options: ['--time', '--started', '--comment', '--comment-file'],
        prose: COMMENT,
    },
    {
        argv: ['worklog', 'update', 'PROJ-1', '10100'],
        command: 'af jira worklog update',
        options: ['--time', '--started', '--comment', '--comment-file'],
        prose: COMMENT,
    },
    {
        argv: ['worklog', 'delete', 'PROJ-1', '10100'],
        command: 'af jira worklog delete',
        options: [],
    },
    {
        argv: ['version-create'],
        command: 'af jira version-create',
        options: [
            '--project',
            '--name',
            '--description',
            '--description-file',
            '--start-date',
            '--release-date',
            '--released',
        ],
        prose: DESCRIPTION,
    },
    {
        argv: ['version-update', '12345'],
        command: 'af jira version-update',
        options: [
            '--name',
            '--description',
            '--description-file',
            '--start-date',
            '--release-date',
            '--released',
            '--unreleased',
        ],
        prose: DESCRIPTION,
    },
];

/** The lines of the error parseArgs throws; fails the test when it throws none. */
function parseErrorLines(argv: string[]): string[] {
    try {
        parseArgs(argv);
    } catch (err) {
        return (err as Error).message.split('\n');
    }
    throw new Error(`parseArgs accepted ${JSON.stringify(argv)}`);
}

describe('jira parseArgs', () => {
    it('splits --name=value at the first =', () => {
        const { options, typedOptions } = parseArgs(['comment', 'PROJ-1', '--add=Looks good']);
        expect(options.add).toBe('Looks good');
        expect(typedOptions).toEqual(['--add']);
    });

    it('keeps an = inside the value and lets --field repeat in both forms', () => {
        const { options } = parseArgs([
            'update',
            'PROJ-1',
            '--field=storyPoints=5',
            '--field',
            'severity=High',
        ]);
        expect(options.field).toEqual(['storyPoints=5', 'severity=High']);
    });

    it('accepts --body-file=- as the stdin marker', () => {
        expect(parseArgs(['comment', 'PROJ-1', '--body-file=-']).options['body-file']).toBe('-');
    });

    it('accepts an empty value after =', () => {
        expect(parseArgs(['comment', 'PROJ-1', '--add=']).options.add).toBe('');
    });

    it('parses --limit as a number in both forms on a non-strict subcommand', () => {
        expect(parseArgs(['list', 'PROJ', '--limit=5']).options.limit).toBe(5);
        expect(parseArgs(['list', 'PROJ', '--limit', '7']).options.limit).toBe(7);
    });

    it.each(['--json=true', '--json=', '--internal=1', '--clear-parent=yes'])(
        'rejects a value on the boolean option %s',
        token => {
            const flag = token.slice(0, token.indexOf('='));
            expect(() => parseArgs(['get', 'PROJ-1', token])).toThrow(
                `Option ${flag} does not take a value`,
            );
        },
    );

    it('still consumes the next argument as the value, whatever it looks like', () => {
        const { options, typedOptions } = parseArgs(['comment', 'PROJ-1', '--body', '--json']);
        expect(options.body).toBe('--json');
        expect(options.json).toBeUndefined();
        expect(typedOptions).toEqual(['--body']);
    });

    it('reports a missing value with the option as typed', () => {
        expect(() => parseArgs(['comment', 'PROJ-1', '--add'])).toThrow(
            'Option --add requires a value',
        );
    });

    it('reports an unknown trailing option as unknown, not as missing its value', () => {
        expect(() => parseArgs(['comment', 'PROJ-1', '--comment'])).toThrow(
            "Unknown option --comment for 'af jira comment'. Did you mean --body?",
        );
    });

    it('reports a missing value on a subcommand without strict checking', () => {
        expect(() => parseArgs(['list', 'PROJ', '--limit'])).toThrow(
            'Option --limit requires a value',
        );
    });

    it('records the typed options for the strict check', () => {
        const { typedOptions } = parseArgs([
            'transition',
            'PROJ-1',
            '--to=Done',
            '--comment-file',
            '-',
            '--json',
        ]);
        expect(typedOptions).toEqual(['--to', '--comment-file', '--json']);
    });

    it('rejects an unknown option on a prose subcommand', () => {
        expect(() => parseArgs(['comment', 'PROJ-1', '--comment', 'x'])).toThrow(
            "Unknown option --comment for 'af jira comment'. Did you mean --body?",
        );
    });

    it('keeps other subcommands lenient', () => {
        expect(() => parseArgs(['list', 'PROJ', '--whatever', 'x', 'extra'])).not.toThrow();
    });

    it('applies no rule to an unknown worklog action', () => {
        expect(() => parseArgs(['worklog', 'frobnicate', 'PROJ-1', '--nope', 'x'])).not.toThrow();
    });

    // The rule table of design D10: every documented option, plus --json. No
    // value below contains a space, so each line splits into its argv.
    it.each([
        'comment PROJ-1 --body x --visibility r --internal --public',
        'comment PROJ-1 --add x --json',
        'comment PROJ-1 --body-file f',
        'comment edit PROJ-1 1 --body x --add y --visibility r',
        'comment edit PROJ-1 1 --body-file f --json',
        'comment delete PROJ-1 1 --json',
        'create --project P --type Task --summary S --description d --description-file f' +
            ' --priority High --labels a,b --parent P-1 --estimate 1h --fix-version v1' +
            ' --affected-version v0 --field a=b --field-json {} --json',
        'update PROJ-1 --summary S --description d --description-file f --priority High' +
            ' --labels a --estimate 1h --remaining 1h --fix-version v1 --affected-version v0' +
            ' --parent P-1 --clear-parent --field a=b --field-json {} --json',
        'transition PROJ-1 --to Done --resolution Fixed --comment c --comment-file f' +
            ' --field a=b --json',
        'worklog list PROJ-1 --json',
        'worklog add PROJ-1 --time 1h --started s --comment c',
        'worklog update PROJ-1 1 --time 1h --comment-file f --json',
        'worklog delete PROJ-1 1 --json',
        'version-create --project P --name v1 --description d --description-file f' +
            ' --start-date d --release-date d --released --json',
        'version-update 1 --name v1 --description d --description-file f --start-date d' +
            ' --release-date d --released --unreleased --json',
    ])('accepts the documented options: %s', line => {
        expect(() => parseArgs(line.split(' '))).not.toThrow();
    });

    describe.each(D10_RULES)('the $command rule', ({ argv, command, options, prose }) => {
        it('accepts exactly its documented options, with --json last', () => {
            expect(parseErrorLines([...argv, '--zzz', 'x'])).toEqual([
                `Unknown option --zzz for '${command}'.`,
                `Accepted options: ${[...options, '--json'].join(', ')}`,
                "Run 'af jira --help' for usage.",
            ]);
        });

        it('takes its positional arguments and no more, and names its prose pair', () => {
            expect(() => parseArgs(argv)).not.toThrow();
            const lines = parseErrorLines([...argv, 'extra']);
            expect(lines[0]).toBe(`Unexpected argument "extra" for '${command}'.`);
            if (prose) {
                // The quoting hint names the file flag; another command's
                // prose flag (--text) maps to the inline one.
                expect(lines).toHaveLength(2);
                expect(lines[1]).toContain(`sent with ${prose.file} (a path`);
                expect(parseErrorLines([...argv, '--text', 'x'])[0]).toBe(
                    `Unknown option --text for '${command}'. Did you mean ${prose.inline}?`,
                );
            } else {
                expect(lines).toHaveLength(1);
            }
        });
    });

    it.each([
        [['comment', 'delete', 'PROJ-1', '1', '--body', 'x'], '--body', 'af jira comment delete'],
        [['worklog', 'list', 'PROJ-1', '--comment', 'x'], '--comment', 'af jira worklog list'],
        [['worklog', 'delete', 'PROJ-1', '1', '--time', '1h'], '--time', 'af jira worklog delete'],
        [['create', '--limit', '5'], '--limit', 'af jira create'],
        [['version-create', '--unreleased'], '--unreleased', 'af jira version-create'],
        [['transition', 'PROJ-1', '--field-json', '{}'], '--field-json', 'af jira transition'],
    ])('rejects an option the action does not take: %j', (argv, option, command) => {
        expect(() => parseArgs(argv)).toThrow(`Unknown option ${option} for '${command}'.`);
    });
});

describe('handleJira prose input', () => {
    let logs: string[];
    let errors: string[];
    let dir: string;
    let readStdin: MockInstance<TextInputIo['readStdin']>;
    let readFile: MockInstance<TextInputIo['readFile']>;
    let stdinIsTTY: MockInstance<TextInputIo['stdinIsTTY']>;

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(client.getComments).mockResolvedValue([]);
        vi.mocked(client.addComment).mockResolvedValue({ id: '10001' } as never);
        vi.mocked(client.updateComment).mockResolvedValue({ id: '10042' } as never);
        vi.mocked(client.addServiceDeskComment).mockResolvedValue({ id: '10002' } as never);
        vi.mocked(client.createIssue).mockResolvedValue({ id: '1', key: 'PROJ-9' } as never);
        vi.mocked(client.updateIssue).mockResolvedValue(undefined);
        vi.mocked(client.transitionIssue).mockResolvedValue(undefined);
        vi.mocked(client.addWorklog).mockResolvedValue({ id: '10100' } as never);
        vi.mocked(client.updateWorklog).mockResolvedValue({ id: '10100' } as never);
        vi.mocked(client.createVersion).mockResolvedValue({ id: '5', name: 'v1.0.0' } as never);
        vi.mocked(client.updateVersion).mockResolvedValue({ id: '5', name: 'v1.0.0' } as never);
        vi.mocked(resolveFieldFlags).mockResolvedValue(undefined);
        // Anything the mocks above do not cover must never reach the network.
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('unexpected network request');
            }),
        );

        logs = [];
        errors = [];
        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logs.push(args.map(String).join(' '));
        });
        vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            errors.push(args.map(String).join(' '));
        });
        // Reading stdin is an explicit opt-in per test; the real fd 0 is never touched.
        readStdin = vi.spyOn(defaultTextInputIo, 'readStdin').mockImplementation(() => {
            throw new Error('stdin must not be read');
        });
        readFile = vi.spyOn(defaultTextInputIo, 'readFile');
        stdinIsTTY = vi.spyOn(defaultTextInputIo, 'stdinIsTTY').mockReturnValue(false);

        dir = mkdtempSync(join(tmpdir(), 'af-text-input-'));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        rmSync(dir, { recursive: true, force: true });
    });

    function run(...argv: string[]): Promise<number> {
        return handleJira(argv);
    }

    function stdin(text: string): void {
        readStdin.mockReturnValue(text);
    }

    function writeTemp(name: string, content: string): string {
        const path = join(dir, name);
        writeFileSync(path, content);
        return path;
    }

    const stderr = (): string => errors.join('\n');

    describe('comment', () => {
        it('adds --body text exactly as typed, with a literal backslash-n kept', async () => {
            const typed = '## Summary\\n\\n- one';
            expect(await run('comment', 'PROJ-1', '--body', typed)).toBe(0);
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', typed, undefined);
            expect(client.getComments).not.toHaveBeenCalled();
            expect(readStdin).not.toHaveBeenCalled();
        });

        it('treats --add as an alias of --body', async () => {
            expect(await run('comment', 'PROJ-1', '--add', 'Comment text')).toBe(0);
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', 'Comment text', undefined);
        });

        it('reads --body-file from a path, keeping the text byte-for-byte', async () => {
            const path = writeTemp('note.md', MARKDOWN);
            expect(await run('comment', 'PROJ-1', '--body-file', path)).toBe(0);
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', MARKDOWN, undefined);
        });

        it('resolves a relative --body-file path against the working directory', async () => {
            const relativePath = relative(process.cwd(), writeTemp('notes.md', MARKDOWN));
            expect(isAbsolute(relativePath)).toBe(false);
            expect(await run('comment', 'PROJ-1', '--body-file', relativePath)).toBe(0);
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', MARKDOWN, undefined);
        });

        it('drops a leading byte-order mark from the file and keeps CRLF', async () => {
            const crlf = '## Title\r\n\r\n- one\r\n';
            const path = writeTemp('bom.md', String.fromCharCode(0xfeff) + crlf);
            expect(await run('comment', 'PROJ-1', '--body-file', path)).toBe(0);
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', crlf, undefined);
        });

        it('reads --body-file - from stdin', async () => {
            stdin(MARKDOWN);
            expect(await run('comment', 'PROJ-1', '--body-file', '-')).toBe(0);
            expect(readStdin).toHaveBeenCalledOnce();
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', MARKDOWN, undefined);
        });

        it('reads stdin for --body-file=- too', async () => {
            stdin('From stdin');
            expect(await run('comment', 'PROJ-1', '--body-file=-')).toBe(0);
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', 'From stdin', undefined);
        });

        it('posts a lone - given to --body as text, without reading stdin', async () => {
            expect(await run('comment', 'PROJ-1', '--body', '-')).toBe(0);
            expect(readStdin).not.toHaveBeenCalled();
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', '-', undefined);
        });

        it('prints the stdin hint to stderr only when stdin is a terminal', async () => {
            stdin('Typed');
            stdinIsTTY.mockReturnValue(true);
            expect(await run('comment', 'PROJ-1', '--body-file', '-')).toBe(0);
            expect(errors).toEqual([HINT]);
            expect(logs.join('\n')).not.toContain(HINT);

            errors.length = 0;
            stdinIsTTY.mockReturnValue(false);
            expect(await run('comment', 'PROJ-1', '--body-file', '-')).toBe(0);
            expect(errors).toEqual([]);
            expect(client.addComment).toHaveBeenCalledTimes(2);
        });

        it('prints only the JSON result for --body-file - --json on a pipe', async () => {
            stdin(MARKDOWN);
            expect(await run('comment', 'PROJ-1', '--body-file', '-', '--json')).toBe(0);
            expect(errors).toEqual([]);
            expect(JSON.parse(logs.join('\n'))).toEqual({ id: '10001' });
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', MARKDOWN, undefined);
        });

        it('passes --visibility to the platform comment', async () => {
            expect(
                await run('comment', 'PROJ-1', '--body', 'Note', '--visibility', 'group:Admins'),
            ).toBe(0);
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', 'Note', {
                type: 'group',
                value: 'Admins',
            });
        });

        it('sends a JSM internal note from a file as typed', async () => {
            const path = writeTemp('note.txt', MARKDOWN);
            expect(await run('comment', 'PROJ-1', '--internal', '--body-file', path)).toBe(0);
            expect(client.addServiceDeskComment).toHaveBeenCalledWith('PROJ-1', MARKDOWN, false);
            expect(client.addComment).not.toHaveBeenCalled();
        });

        it('sends a JSM public reply with public set', async () => {
            expect(await run('comment', 'PROJ-1', '--public', '--body', 'Hello')).toBe(0);
            expect(client.addServiceDeskComment).toHaveBeenCalledWith('PROJ-1', 'Hello', true);
        });

        it('lists the comments when no body flag is given, without reading stdin', async () => {
            expect(await run('comment', 'PROJ-1')).toBe(0);
            expect(client.getComments).toHaveBeenCalledWith('PROJ-1');
            expect(client.addComment).not.toHaveBeenCalled();
            expect(readStdin).not.toHaveBeenCalled();
        });

        it('rejects --add together with --body before anything else', async () => {
            expect(await run('comment', 'PROJ-1', '--add', 'a', '--body', 'b')).toBe(1);
            expect(stderr()).toContain(
                'Cannot use both --add and --body (--add is an alias of --body)',
            );
            expect(client.addComment).not.toHaveBeenCalled();
            expect(client.getComments).not.toHaveBeenCalled();
        });

        it('rejects --add together with --body-file without reading stdin', async () => {
            expect(await run('comment', 'PROJ-1', '--add', 'a', '--body-file', '-')).toBe(1);
            expect(stderr()).toContain('Cannot use both --add and --body-file');
            expect(readStdin).not.toHaveBeenCalled();
        });

        it('rejects --body together with --body-file without reading the file', async () => {
            const path = writeTemp('note.md', MARKDOWN);
            expect(await run('comment', 'PROJ-1', '--body', 'x', '--body-file', path)).toBe(1);
            expect(stderr()).toContain('Cannot use both --body and --body-file');
            expect(readFile).not.toHaveBeenCalled();
            expect(client.addComment).not.toHaveBeenCalled();
        });

        it.each([[''], ['   ']])('rejects the empty --add value %j', async value => {
            expect(await run('comment', 'PROJ-1', '--add', value)).toBe(1);
            expect(stderr()).toContain(
                '--add is empty. Give the text, or use --body-file (a path, or - for stdin)',
            );
            expect(client.addComment).not.toHaveBeenCalled();
            expect(client.getComments).not.toHaveBeenCalled();
        });

        it.each(['--internal', '--public'])('rejects an empty body with %s too', async flag => {
            expect(await run('comment', 'PROJ-1', flag, '--body', '')).toBe(1);
            expect(stderr()).toContain('--body is empty');
            expect(client.addServiceDeskComment).not.toHaveBeenCalled();
            expect(client.getComments).not.toHaveBeenCalled();
        });

        it('rejects empty stdin without listing or posting', async () => {
            stdin('');
            expect(await run('comment', 'PROJ-1', '--body-file', '-')).toBe(1);
            expect(stderr()).toContain('--body-file -: no text on stdin');
            expect(client.addComment).not.toHaveBeenCalled();
            expect(client.getComments).not.toHaveBeenCalled();
        });

        it('reports a missing file as File not found', async () => {
            expect(existsSync('missing.md')).toBe(false);
            expect(await run('comment', 'PROJ-1', '--body-file', 'missing.md')).toBe(1);
            expect(stderr()).toContain('Error: File not found: missing.md');
            expect(client.addComment).not.toHaveBeenCalled();
        });

        it('names the flag and the reason when the path is a directory', async () => {
            const docs = join(dir, 'docs');
            mkdirSync(docs);
            expect(await run('comment', 'PROJ-1', '--body-file', docs)).toBe(1);
            expect(stderr()).toContain(`Cannot read --body-file ${docs}: `);
            expect(client.addComment).not.toHaveBeenCalled();
        });

        it('rejects an empty --body-file path', async () => {
            expect(await run('comment', 'PROJ-1', '--body-file', '')).toBe(1);
            expect(stderr()).toContain('--body-file needs a path, or - for stdin');
            expect(client.getComments).not.toHaveBeenCalled();
            expect(client.addComment).not.toHaveBeenCalled();
        });

        it('checks the issue key before reading stdin', async () => {
            expect(await run('comment', '--body-file', '-')).toBe(1);
            expect(stderr()).toContain('Issue key required');
            expect(stderr()).toContain('--body-file');
            expect(readStdin).not.toHaveBeenCalled();
        });

        it('reports input errors as JSON with --json', async () => {
            expect(await run('comment', 'PROJ-1', '--add', '', '--json')).toBe(1);
            expect(JSON.parse(errors[0]!)).toEqual({
                error: '--add is empty. Give the text, or use --body-file (a path, or - for stdin)',
            });
            expect(logs).toEqual([]);
        });
    });

    describe('comment edit', () => {
        it('replaces the comment with text from stdin', async () => {
            stdin(MARKDOWN);
            expect(await run('comment', 'edit', 'PROJ-1', '10042', '--body-file', '-')).toBe(0);
            expect(client.updateComment).toHaveBeenCalledWith(
                'PROJ-1',
                '10042',
                MARKDOWN,
                undefined,
            );
        });

        it('accepts --add', async () => {
            expect(await run('comment', 'edit', 'PROJ-1', '10042', '--add', 'Updated text')).toBe(
                0,
            );
            expect(client.updateComment).toHaveBeenCalledWith(
                'PROJ-1',
                '10042',
                'Updated text',
                undefined,
            );
        });

        it('fails without a body, naming both flags', async () => {
            expect(await run('comment', 'edit', 'PROJ-1', '10042')).toBe(1);
            expect(stderr()).toContain(
                'Error: Issue key, comment id, and --body or --body-file required',
            );
            expect(stderr()).toContain('--body-file -');
            expect(client.updateComment).not.toHaveBeenCalled();
        });

        it('checks the comment id before reading stdin', async () => {
            expect(await run('comment', 'edit', 'PROJ-1', '--body-file', '-')).toBe(1);
            expect(stderr()).toContain('Issue key, comment id, and --body or --body-file required');
            expect(readStdin).not.toHaveBeenCalled();
        });

        it.each([
            ['--body', ''],
            ['--add', ''],
            ['--add', '  '],
        ])('rejects the empty value %s %j', async (flag, value) => {
            expect(await run('comment', 'edit', 'PROJ-1', '10042', flag, value)).toBe(1);
            expect(stderr()).toContain(`${flag} is empty`);
            expect(client.updateComment).not.toHaveBeenCalled();
        });

        it('rejects --add together with --body', async () => {
            expect(
                await run('comment', 'edit', 'PROJ-1', '10042', '--add', 'a', '--body', 'b'),
            ).toBe(1);
            expect(stderr()).toContain('Cannot use both --add and --body');
            expect(client.updateComment).not.toHaveBeenCalled();
        });

        it('rejects --internal, which only adding supports', async () => {
            expect(
                await run('comment', 'edit', 'PROJ-1', '10042', '--body', 'x', '--internal'),
            ).toBe(1);
            expect(stderr()).toContain("Unknown option --internal for 'af jira comment edit'.");
            expect(client.updateComment).not.toHaveBeenCalled();
            expect(client.addServiceDeskComment).not.toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('takes the description from stdin', async () => {
            stdin(MARKDOWN);
            expect(
                await run(
                    'create',
                    '--project',
                    'PROJ',
                    '--type',
                    'Task',
                    '--summary',
                    'Title',
                    '--description-file',
                    '-',
                ),
            ).toBe(0);
            expect(vi.mocked(client.createIssue).mock.calls[0]!.slice(0, 4)).toEqual([
                'PROJ',
                'Task',
                'Title',
                MARKDOWN,
            ]);
        });

        it('passes an empty --description through as ""', async () => {
            expect(
                await run(
                    'create',
                    '--project',
                    'PROJ',
                    '--type',
                    'Task',
                    '--summary',
                    'Title',
                    '--description',
                    '',
                ),
            ).toBe(0);
            expect(vi.mocked(client.createIssue).mock.calls[0]![3]).toBe('');
        });

        it('checks the required options before reading stdin', async () => {
            expect(await run('create', '--type', 'Task', '--description-file', '-')).toBe(1);
            expect(stderr()).toContain('--project, --type, and --summary are required');
            expect(readStdin).not.toHaveBeenCalled();
            expect(client.createIssue).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('updates only the description from a file', async () => {
            const path = writeTemp('desc.md', MARKDOWN);
            expect(await run('update', 'PROJ-1', '--description-file', path)).toBe(0);
            expect(client.updateIssue).toHaveBeenCalledWith('PROJ-1', { description: MARKDOWN });
        });

        it('passes an empty --description through as "", which clears it', async () => {
            expect(await run('update', 'PROJ-1', '--description', '')).toBe(0);
            expect(client.updateIssue).toHaveBeenCalledWith('PROJ-1', { description: '' });
        });

        it('changes nothing when the description file is missing', async () => {
            expect(existsSync('missing.md')).toBe(false);
            expect(
                await run('update', 'PROJ-1', '--summary', 'X', '--description-file', 'missing.md'),
            ).toBe(1);
            expect(stderr()).toContain('File not found: missing.md');
            expect(client.updateIssue).not.toHaveBeenCalled();
        });

        it('rejects a whitespace-only description file', async () => {
            const path = writeTemp('blank.md', '  \n\n');
            expect(await run('update', 'PROJ-1', '--description-file', path)).toBe(1);
            expect(stderr()).toContain(`--description-file ${path}: the file contains no text`);
            expect(client.updateIssue).not.toHaveBeenCalled();
        });

        it('rejects --description with --description-file without reading stdin', async () => {
            expect(
                await run('update', 'PROJ-1', '--description', 'x', '--description-file', '-'),
            ).toBe(1);
            expect(stderr()).toContain('Cannot use both --description and --description-file');
            expect(readStdin).not.toHaveBeenCalled();
        });

        it('lists --description-file when no update option is given', async () => {
            expect(await run('update', 'PROJ-1')).toBe(1);
            expect(stderr()).toContain('No update options provided');
            expect(stderr()).toContain('--description-file');
            expect(client.updateIssue).not.toHaveBeenCalled();
        });

        it('resolves --field=name=value into custom fields', async () => {
            vi.mocked(resolveFieldFlags).mockResolvedValue({
                customFields: { customfield_10016: 5 },
            } as never);
            expect(await run('update', 'PROJ-1', '--field=storyPoints=5')).toBe(0);
            expect(resolveFieldFlags).toHaveBeenCalledWith({
                fieldPairs: ['storyPoints=5'],
                fieldJson: undefined,
            });
            expect(client.updateIssue).toHaveBeenCalledWith('PROJ-1', {
                customFields: { customfield_10016: 5 },
            });
        });
    });

    describe('transition', () => {
        it('takes the transition comment from stdin', async () => {
            stdin(MARKDOWN);
            expect(
                await run(
                    'transition',
                    'PROJ-1',
                    '--to',
                    'Done',
                    '--resolution',
                    'Fixed',
                    '--comment-file',
                    '-',
                ),
            ).toBe(0);
            expect(client.transitionIssue).toHaveBeenCalledWith('PROJ-1', 'Done', {
                resolution: 'Fixed',
                comment: MARKDOWN,
                fields: undefined,
            });
        });

        it('checks --to before reading stdin, even on a terminal', async () => {
            stdinIsTTY.mockReturnValue(true);
            expect(await run('transition', 'PROJ-1', '--comment-file', '-')).toBe(1);
            expect(stderr()).toContain('Issue key and --to required');
            expect(readStdin).not.toHaveBeenCalled();
            expect(errors).not.toContain(HINT.replace('--body-file', '--comment-file'));
            expect(client.transitionIssue).not.toHaveBeenCalled();
        });

        it('rejects --comment "" with --comment-file', async () => {
            const path = writeTemp('notes.md', MARKDOWN);
            expect(
                await run(
                    'transition',
                    'PROJ-1',
                    '--to',
                    'Done',
                    '--comment',
                    '',
                    '--comment-file',
                    path,
                ),
            ).toBe(1);
            expect(stderr()).toContain('Cannot use both --comment and --comment-file');
            expect(client.transitionIssue).not.toHaveBeenCalled();
        });
    });

    describe('worklog', () => {
        it('takes the worklog add comment from a file', async () => {
            const path = writeTemp('log.md', MARKDOWN);
            expect(
                await run('worklog', 'add', 'PROJ-1', '--time', '2h', '--comment-file', path),
            ).toBe(0);
            expect(client.addWorklog).toHaveBeenCalledWith('PROJ-1', {
                timeSpent: '2h',
                started: undefined,
                comment: MARKDOWN,
            });
        });

        it('takes the worklog update comment from stdin', async () => {
            stdin(MARKDOWN);
            expect(await run('worklog', 'update', 'PROJ-1', '10100', '--comment-file', '-')).toBe(
                0,
            );
            expect(client.updateWorklog).toHaveBeenCalledWith('PROJ-1', '10100', {
                timeSpent: undefined,
                started: undefined,
                comment: MARKDOWN,
            });
        });

        it('checks --time before reading stdin', async () => {
            expect(await run('worklog', 'add', 'PROJ-1', '--comment-file', '-')).toBe(1);
            expect(stderr()).toContain('Issue key and --time required');
            expect(stderr()).toContain('--comment-file');
            expect(readStdin).not.toHaveBeenCalled();
        });
    });

    describe('versions', () => {
        it('sends a version description from a file as a plain string', async () => {
            const notes = '# Not a heading\n\n**kept as typed**\n';
            const path = writeTemp('notes.txt', notes);
            expect(
                await run(
                    'version-create',
                    '--project',
                    'PROJ',
                    '--name',
                    'v1.0.0',
                    '--description-file',
                    path,
                ),
            ).toBe(0);
            expect(client.createVersion).toHaveBeenCalledWith(
                'PROJ',
                'v1.0.0',
                expect.objectContaining({ description: notes }),
            );
        });

        it('updates a version description from stdin', async () => {
            stdin('Release notes\n');
            expect(await run('version-update', '12345', '--description-file', '-')).toBe(0);
            expect(client.updateVersion).toHaveBeenCalledWith('12345', {
                description: 'Release notes\n',
            });
        });

        it('lists --description-file when no version update option is given', async () => {
            expect(await run('version-update', '12345')).toBe(1);
            expect(stderr()).toContain('No update options provided');
            expect(stderr()).toContain('--description-file');
            expect(client.updateVersion).not.toHaveBeenCalled();
        });
    });

    describe('empty inline values keep their meaning', () => {
        it('transition --comment "" passes ""', async () => {
            expect(await run('transition', 'PROJ-1', '--to', 'Done', '--comment', '')).toBe(0);
            expect(client.transitionIssue).toHaveBeenCalledWith('PROJ-1', 'Done', {
                resolution: undefined,
                comment: '',
                fields: undefined,
            });
        });

        it('worklog add --comment "" passes ""', async () => {
            expect(await run('worklog', 'add', 'PROJ-1', '--time', '1h', '--comment', '')).toBe(0);
            expect(vi.mocked(client.addWorklog).mock.calls[0]![1].comment).toBe('');
        });

        it('worklog update --comment "" passes ""', async () => {
            expect(await run('worklog', 'update', 'PROJ-1', '10100', '--comment', '')).toBe(0);
            expect(vi.mocked(client.updateWorklog).mock.calls[0]![2].comment).toBe('');
        });

        it('version-create --description "" passes ""', async () => {
            expect(
                await run(
                    'version-create',
                    '--project',
                    'PROJ',
                    '--name',
                    'v1.0.0',
                    '--description',
                    '',
                ),
            ).toBe(0);
            expect(vi.mocked(client.createVersion).mock.calls[0]![2]!.description).toBe('');
        });

        it('version-update --description "" passes ""', async () => {
            expect(await run('version-update', '12345', '--description', '')).toBe(0);
            expect(client.updateVersion).toHaveBeenCalledWith('12345', { description: '' });
        });
    });

    // Design D8: the argument checks come first, then the input is read, and
    // only then do lookups and requests run. A command that is going to fail
    // never reads stdin, and an input error stops it before any request.
    describe('order of operations', () => {
        function expectNoRequest(): void {
            for (const fn of Object.values(client)) {
                if (vi.isMockFunction(fn)) expect(fn).not.toHaveBeenCalled();
            }
            expect(resolveFieldFlags).not.toHaveBeenCalled();
            expect(globalThis.fetch).not.toHaveBeenCalled();
        }

        it.each([
            [['update', '--description-file', '-'], 'Issue key required'],
            [
                ['worklog', 'update', 'PROJ-1', '--comment-file', '-'],
                'Issue key and worklog id required',
            ],
            [
                ['version-create', '--project', 'PROJ', '--description-file', '-'],
                '--project and --name are required',
            ],
            [['version-update', '--description-file', '-'], 'Version ID required'],
        ])('checks the arguments before reading stdin: %j', async (argv, message) => {
            stdinIsTTY.mockReturnValue(true);
            expect(await run(...argv)).toBe(1);
            expect(stderr()).toContain(message);
            expect(readStdin).not.toHaveBeenCalled();
            expect(stderr()).not.toContain('from stdin');
            expectNoRequest();
        });

        it.each([
            [
                [
                    'create',
                    '--project',
                    'PROJ',
                    '--type',
                    'Task',
                    '--summary',
                    'Title',
                    '--field-json',
                    '{bad',
                    '--description-file',
                    '-',
                ],
                'Invalid --field-json value',
            ],
            [
                ['update', 'PROJ-1', '--field', 'noequals', '--description-file', '-'],
                'Invalid --field value "noequals". Expected name=value.',
            ],
        ])('rejects a malformed custom field before reading stdin: %j', async (argv, message) => {
            stdinIsTTY.mockReturnValue(true);
            expect(await run(...argv)).toBe(1);
            expect(stderr()).toContain(message);
            expect(readStdin).not.toHaveBeenCalled();
            expect(stderr()).not.toContain('from stdin');
            expectNoRequest();
        });

        it('rejects empty stdin on create before resolving custom fields', async () => {
            stdin('');
            expect(
                await run(
                    'create',
                    '--project',
                    'PROJ',
                    '--type',
                    'Task',
                    '--summary',
                    'Title',
                    '--field',
                    'storyPoints=5',
                    '--description-file',
                    '-',
                ),
            ).toBe(1);
            expect(stderr()).toContain('--description-file -: no text on stdin');
            expectNoRequest();
        });

        it('reports a missing file on update before resolving custom fields', async () => {
            expect(existsSync('missing.md')).toBe(false);
            expect(
                await run(
                    'update',
                    'PROJ-1',
                    '--summary',
                    'X',
                    '--field',
                    'storyPoints=5',
                    '--description-file',
                    'missing.md',
                ),
            ).toBe(1);
            expect(stderr()).toContain('File not found: missing.md');
            expectNoRequest();
        });
    });

    describe('strict checks', () => {
        it('suggests --body for --comment on comment and does not list', async () => {
            expect(await run('comment', 'PROJ-1', '--comment', 'Looks good')).toBe(1);
            expect(stderr()).toContain(
                "Unknown option --comment for 'af jira comment'. Did you mean --body?",
            );
            expect(stderr()).toContain(
                'Accepted options: --body, --body-file, --add, --visibility, --internal, --public, --json',
            );
            expect(client.getComments).not.toHaveBeenCalled();
            expect(client.addComment).not.toHaveBeenCalled();
        });

        it('suggests --description for a misspelling on create', async () => {
            expect(
                await run(
                    'create',
                    '--project',
                    'PROJ',
                    '--type',
                    'Bug',
                    '--summary',
                    'Title',
                    '--descripton',
                    'Steps',
                ),
            ).toBe(1);
            expect(stderr()).toContain('Unknown option --descripton');
            expect(stderr()).toContain('Did you mean --description?');
            expect(client.createIssue).not.toHaveBeenCalled();
        });

        it('suggests --comment-file for --body-file on transition', async () => {
            expect(
                await run('transition', 'PROJ-1', '--to', 'Done', '--body-file', 'notes.md'),
            ).toBe(1);
            expect(stderr()).toContain('Unknown option --body-file');
            expect(stderr()).toContain('Did you mean --comment-file?');
            expect(readFile).not.toHaveBeenCalled();
            expect(client.transitionIssue).not.toHaveBeenCalled();
        });

        it('names the first word split off by an apostrophe', async () => {
            expect(
                await run('comment', 'PROJ-1', '--add', 'Dont', 'merge', 'until', 'QAs done'),
            ).toBe(1);
            expect(stderr()).toContain('Unexpected argument "merge"');
            expect(stderr()).toContain('must be quoted');
            expect(client.addComment).not.toHaveBeenCalled();
        });

        it('points a stray - at --body-file -', async () => {
            expect(await run('comment', 'PROJ-1', '-')).toBe(1);
            expect(stderr()).toContain('To read stdin, use --body-file -.');
            expect(readStdin).not.toHaveBeenCalled();
        });

        it('rejects an extra argument on comment delete', async () => {
            expect(await run('comment', 'delete', 'PROJ-1', '10042', 'extra')).toBe(1);
            expect(stderr()).toContain(
                'Unexpected argument "extra" for \'af jira comment delete\'.',
            );
            expect(client.deleteComment).not.toHaveBeenCalled();
        });

        it('accepts --json and prints the result as JSON', async () => {
            expect(await run('comment', 'PROJ-1', '--body', 'Looks good', '--json')).toBe(0);
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', 'Looks good', undefined);
            expect(JSON.parse(logs.join('\n'))).toEqual({ id: '10001' });
        });

        it('accepts --add=value with --json', async () => {
            expect(await run('comment', 'PROJ-1', '--add=Looks good', '--json')).toBe(0);
            expect(client.addComment).toHaveBeenCalledWith('PROJ-1', 'Looks good', undefined);
            expect(JSON.parse(logs.join('\n'))).toEqual({ id: '10001' });
        });

        it('rejects a value on a boolean option before any request', async () => {
            expect(await run('get', 'PROJ-1', '--json=true')).toBe(1);
            expect(stderr()).toContain('Option --json does not take a value');
            expect(client.getIssue).not.toHaveBeenCalled();
        });

        it('leaves an unknown worklog action to the handler', async () => {
            expect(await run('worklog', 'frobnicate', 'PROJ-1')).toBe(1);
            expect(stderr()).toContain('worklog requires an action');
        });
    });
});
