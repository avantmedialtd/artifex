// cspell:words flie
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { textToAdf } from '../atlassian/lib/adf.ts';
import * as client from '../confluence/lib/client.ts';
import { defaultTextInputIo } from '../utils/text-input.ts';
import { handleConfluence, parseArgs, showConfluenceHelp } from './confluence.ts';

// Every client function that sends a request is mocked, so no test can reach a
// live Confluence. The ADF converters the module re-exports stay real.
vi.mock('../confluence/lib/client.ts', async importOriginal => ({
    ...(await importOriginal<typeof import('../confluence/lib/client.ts')>()),
    listSpaces: vi.fn(),
    getSpace: vi.fn(),
    getSpaceByKey: vi.fn(),
    getPage: vi.fn(),
    listPages: vi.fn(),
    createPage: vi.fn(),
    updatePage: vi.fn(),
    deletePage: vi.fn(),
    getChildPages: vi.fn(),
    getAncestors: vi.fn(),
    getComments: vi.fn(),
    addComment: vi.fn(),
    getLabels: vi.fn(),
    addLabels: vi.fn(),
    removeLabel: vi.fn(),
    getAttachments: vi.fn(),
    addAttachment: vi.fn(),
    search: vi.fn(),
}));

const BOM = String.fromCharCode(0xfeff);
const HINT = 'Reading --body-file from stdin. Type the text, then press Ctrl-D on an empty line.';

let out: string[];
let err: string[];
let dir: string;

beforeEach(() => {
    vi.resetAllMocks();
    out = [];
    err = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        out.push(args.join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        err.push(args.join(' '));
    });
    // Stdin is never the real one: reading it fails unless a test supplies text.
    vi.spyOn(defaultTextInputIo, 'stdinIsTTY').mockReturnValue(false);
    vi.spyOn(defaultTextInputIo, 'readStdin').mockImplementation(() => {
        throw new Error('unexpected stdin read');
    });
    // A last guard against live requests, should a client call escape the mock.
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
            throw new Error('unexpected network request');
        }),
    );
    vi.mocked(client.addComment).mockResolvedValue({ id: 'c1' } as never);
    vi.mocked(client.createPage).mockResolvedValue({ id: '777', title: 'Runbook' } as never);
    vi.mocked(client.updatePage).mockResolvedValue({ id: '12345', title: 'New' } as never);
    dir = mkdtempSync(join(tmpdir(), 'af-text-input-'));
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
});

/** Makes stdin carry `text`; `tty` says whether it is a terminal. */
function stdin(text: string, tty = false): void {
    vi.mocked(defaultTextInputIo.readStdin).mockReturnValue(text);
    vi.mocked(defaultTextInputIo.stdinIsTTY).mockReturnValue(tty);
}

/** Writes a fixture into this test's temp directory and returns its path. */
function file(name: string, content: string): string {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
}

/** Everything printed to stderr, without colors. */
function stderr(): string {
    return stripVTControlCharacters(err.join('\n'));
}

describe('parseArgs', () => {
    describe('--name=value', () => {
        it('splits at the first =, so the value may contain = or be empty', () => {
            expect(parseArgs(['update', '12345', '--title=New Title']).options.title).toBe(
                'New Title',
            );
            expect(parseArgs(['update', '12345', '--message=a=b']).options.message).toBe('a=b');
            expect(parseArgs(['update', '12345', '--title=']).options.title).toBe('');
        });

        it('takes --body-file=- as the stdin marker', () => {
            const { options } = parseArgs([
                'create',
                '--space',
                'MYSPACE',
                '--title',
                'T',
                '--body-file=-',
            ]);
            expect(options['body-file']).toBe('-');
        });

        it('keeps --limit numeric in both forms, and =value never consumes the next argument', () => {
            const parsed = parseArgs(['list', 'MYSPACE', '--limit=5', 'next']);
            expect(parsed.options.limit).toBe(5);
            expect(parsed.args).toEqual(['MYSPACE', 'next']);
            expect(parseArgs(['list', 'MYSPACE', '--limit', '7']).options.limit).toBe(7);
        });

        it('rejects a value on --json', () => {
            expect(() => parseArgs(['spaces', '--json=1'])).toThrow(
                'Option --json does not take a value',
            );
            expect(parseArgs(['spaces', '--json']).options.json).toBe(true);
        });

        it('still requires a value after a space-separated option', () => {
            expect(() => parseArgs(['create', '--space'])).toThrow(
                'Option --space requires a value',
            );
        });
    });

    describe('strict subcommands', () => {
        it('accept their documented options and --json', () => {
            const accepted = [
                [
                    'create',
                    '--space',
                    'S',
                    '--title',
                    'T',
                    '--body',
                    'b',
                    '--parent',
                    '1',
                    '--status',
                    'draft',
                    '--json',
                ],
                ['create', '--space', 'S', '--title', 'T', '--body-file', 'doc.md'],
                [
                    'update',
                    '12345',
                    '--title',
                    'T',
                    '--body',
                    'b',
                    '--status',
                    'draft',
                    '--message',
                    'm',
                    '--json',
                ],
                ['update', '12345', '--body-file', '-'],
                ['comment', '12345', '--body', 'b', '--json'],
                ['comment', '12345', '--add', 'b'],
                ['comment', '12345', '--body-file=-'],
            ];
            for (const argv of accepted) {
                expect(() => parseArgs(argv)).not.toThrow();
            }
        });

        it('reject an unknown option, suggesting a near miss and listing the accepted options', () => {
            expect(() =>
                parseArgs(['create', '--space', 'S', '--title', 'T', '--body-flie', 'doc.md']),
            ).toThrow(
                [
                    "Unknown option --body-flie for 'af confluence create'. Did you mean --body-file?",
                    'Accepted options: --space, --title, --body, --body-file, --parent, --status, --json',
                    "Run 'af confluence --help' for usage.",
                ].join('\n'),
            );
        });

        it("map other commands' prose flags to --body and --body-file", () => {
            expect(() => parseArgs(['comment', '12345', '--comment', 'x'])).toThrow(
                "Unknown option --comment for 'af confluence comment'. Did you mean --body?",
            );
            expect(() =>
                parseArgs(['create', '--space', 'S', '--title', 'T', '--description', 'x']),
            ).toThrow('Did you mean --body?');
            expect(() => parseArgs(['comment', '12345', '--file', 'notes.md'])).toThrow(
                'Did you mean --body-file?',
            );
        });

        it('reject --limit, which only the listing subcommands take, without a guess', () => {
            expect(() => parseArgs(['update', '12345', '--title', 'T', '--limit', '5'])).toThrow(
                [
                    "Unknown option --limit for 'af confluence update'.",
                    'Accepted options: --title, --body, --body-file, --status, --message, --json',
                ].join('\n'),
            );
        });

        it('reject extra positional arguments, naming the first one', () => {
            expect(() => parseArgs(['comment', '12345', '--body', 'Looks', 'good'])).toThrow(
                [
                    `Unexpected argument "good" for 'af confluence comment'.`,
                    'Text with spaces or apostrophes must be quoted, or sent with --body-file (a path, or - with a quoted heredoc).',
                ].join('\n'),
            );
            expect(() => parseArgs(['create', 'MYSPACE', '--title', 'T'])).toThrow(
                `Unexpected argument "MYSPACE" for 'af confluence create'.`,
            );
            expect(() => parseArgs(['update', '12345', '67890'])).toThrow(
                `Unexpected argument "67890" for 'af confluence update'.`,
            );
        });

        it('report an unknown last option as unknown, not as missing its value', () => {
            expect(() => parseArgs(['comment', '12345', '--body', 'x', '--internal'])).toThrow(
                [
                    "Unknown option --internal for 'af confluence comment'.",
                    'Accepted options: --body, --body-file, --add, --json',
                ].join('\n'),
            );
            expect(() => parseArgs(['comment', '12345', '--comment'])).toThrow(
                "Unknown option --comment for 'af confluence comment'. Did you mean --body?",
            );
            // An option the subcommand takes still needs its value.
            expect(() => parseArgs(['comment', '12345', '--body'])).toThrow(
                'Option --body requires a value',
            );
        });

        it('point a stray - at --body-file -', () => {
            expect(() => parseArgs(['comment', '12345', '-'])).toThrow(
                `Unexpected argument "-" for 'af confluence comment'.\nTo read stdin, use --body-file -.`,
            );
        });

        it('leave the other subcommands lenient', () => {
            const parsed = parseArgs(['label', '12345', '--add', 'a,b', '--unknown', 'x', 'extra']);
            expect(parsed.options.add).toBe('a,b');
            expect(parsed.args).toEqual(['12345', 'extra']);
            expect(() => parseArgs(['list', 'MYSPACE', '--sort'])).toThrow(
                'Option --sort requires a value',
            );
        });
    });
});

describe('af confluence comment', () => {
    it('posts --body text exactly as typed, a literal backslash-n included', async () => {
        const typed = '## Summary\\n\\n- one';
        expect(await handleConfluence(['comment', '12345', '--body', typed])).toBe(0);
        expect(client.addComment).toHaveBeenCalledWith('12345', typed);
        expect(defaultTextInputIo.readStdin).not.toHaveBeenCalled();
    });

    it('treats --add as an alias of --body', async () => {
        expect(await handleConfluence(['comment', '12345', '--add', 'Comment text'])).toBe(0);
        expect(client.addComment).toHaveBeenCalledWith('12345', 'Comment text');
    });

    it('posts a literal - given to --body without reading stdin', async () => {
        expect(await handleConfluence(['comment', '12345', '--body', '-'])).toBe(0);
        expect(client.addComment).toHaveBeenCalledWith('12345', '-');
        expect(defaultTextInputIo.readStdin).not.toHaveBeenCalled();
    });

    it('reads --body-file - from stdin, and the text converts to a heading and a list', async () => {
        stdin('## Summary\n\n- First point\n');
        expect(await handleConfluence(['comment', '12345', '--body-file', '-'])).toBe(0);
        expect(client.addComment).toHaveBeenCalledWith('12345', '## Summary\n\n- First point\n');

        const adf = textToAdf(vi.mocked(client.addComment).mock.calls[0][1]);
        expect(adf.content.map(node => node.type)).toEqual(['heading', 'bulletList']);
        expect(adf.content[0]).toMatchObject({
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Summary' }],
        });
        expect(adf.content[1]).toMatchObject({
            content: [
                {
                    type: 'listItem',
                    content: [{ content: [{ type: 'text', text: 'First point' }] }],
                },
            ],
        });
    });

    it('reads --body-file from a path, dropping a leading BOM and keeping CRLF', async () => {
        const path = file('notes.md', `${BOM}## Title\r\n\r\n- one\r\n`);
        expect(await handleConfluence(['comment', '12345', '--body-file', path])).toBe(0);
        expect(client.addComment).toHaveBeenCalledWith('12345', '## Title\r\n\r\n- one\r\n');
    });

    it('prints the stdin hint to stderr only when stdin is a terminal', async () => {
        stdin('Typed text', true);
        expect(await handleConfluence(['comment', '12345', '--body-file', '-'])).toBe(0);
        expect(err).toContain(HINT);
        expect(out.join('\n')).not.toContain('Ctrl-D');
        expect(client.addComment).toHaveBeenCalledWith('12345', 'Typed text');
    });

    it('prints no hint for piped stdin, so --json output stays parseable', async () => {
        stdin('Piped text');
        expect(await handleConfluence(['comment', '12345', '--body-file', '-', '--json'])).toBe(0);
        expect(err).toEqual([]);
        expect(JSON.parse(out.join('\n'))).toEqual({ id: 'c1' });
    });

    it('accepts --json and prints the new comment as JSON', async () => {
        expect(await handleConfluence(['comment', '12345', '--body', 'Looks good', '--json'])).toBe(
            0,
        );
        expect(client.addComment).toHaveBeenCalledWith('12345', 'Looks good');
        expect(JSON.parse(out.join('\n'))).toEqual({ id: 'c1' });
    });

    it('rejects --add together with --body-file before reading the file', async () => {
        const path = file('note.md', 'Text');
        vi.spyOn(defaultTextInputIo, 'readFile');
        expect(
            await handleConfluence(['comment', '12345', '--add', 'a', '--body-file', path]),
        ).toBe(1);
        expect(stderr()).toContain('Error: Cannot use both --add and --body-file');
        expect(defaultTextInputIo.readFile).not.toHaveBeenCalled();
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('rejects --add together with --body', async () => {
        expect(await handleConfluence(['comment', '12345', '--add', 'a', '--body', 'b'])).toBe(1);
        expect(stderr()).toContain(
            'Error: Cannot use both --add and --body (--add is an alias of --body)',
        );
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('reports input errors as JSON on stderr with --json', async () => {
        expect(
            await handleConfluence([
                'comment',
                '12345',
                '--body',
                'x',
                '--body-file',
                '-',
                '--json',
            ]),
        ).toBe(1);
        expect(JSON.parse(err.join('\n'))).toEqual({
            error: 'Cannot use both --body and --body-file',
        });
        expect(defaultTextInputIo.readStdin).not.toHaveBeenCalled();
        expect(out).toEqual([]);
    });

    it('requires a body, and does not list the comments instead', async () => {
        expect(await handleConfluence(['comment', '12345'])).toBe(1);
        expect(stderr()).toContain(
            'Error: --body or --body-file required. Usage: af confluence comment <page-id> --body "text"',
        );
        expect(client.addComment).not.toHaveBeenCalled();
        expect(client.getComments).not.toHaveBeenCalled();
    });

    it('rejects an empty --body', async () => {
        expect(await handleConfluence(['comment', '12345', '--body', ''])).toBe(1);
        expect(stderr()).toContain(
            'Error: --body is empty. Give the text, or use --body-file (a path, or - for stdin)',
        );
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only --add, naming --add', async () => {
        expect(await handleConfluence(['comment', '12345', '--add', ' \n '])).toBe(1);
        expect(stderr()).toContain('Error: --add is empty.');
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('rejects empty stdin', async () => {
        stdin('');
        expect(await handleConfluence(['comment', '12345', '--body-file', '-'])).toBe(1);
        expect(stderr()).toContain('Error: --body-file -: no text on stdin.');
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('rejects a file holding only a byte-order mark', async () => {
        const path = file('bom.md', `${BOM}\n`);
        expect(await handleConfluence(['comment', '12345', '--body-file', path])).toBe(1);
        expect(stderr()).toContain(`Error: --body-file ${path}: the file contains no text`);
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('reports a missing file', async () => {
        const path = join(dir, 'missing.md');
        expect(await handleConfluence(['comment', '12345', '--body-file', path])).toBe(1);
        expect(stderr()).toContain(`Error: File not found: ${path}`);
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('rejects an empty --body-file path', async () => {
        expect(await handleConfluence(['comment', '12345', '--body-file', ''])).toBe(1);
        expect(stderr()).toContain('Error: --body-file needs a path, or - for stdin');
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('requires the page id before reading stdin', async () => {
        expect(await handleConfluence(['comment', '--body-file', '-'])).toBe(1);
        expect(stderr()).toContain('Error: Page ID required.');
        expect(defaultTextInputIo.readStdin).not.toHaveBeenCalled();
    });

    it('suggests --body for --comment, without posting or reading stdin', async () => {
        expect(
            await handleConfluence(['comment', '12345', '--body-file', '-', '--comment', 'x']),
        ).toBe(1);
        expect(stderr()).toContain(
            "Error: Unknown option --comment for 'af confluence comment'. Did you mean --body?",
        );
        expect(defaultTextInputIo.readStdin).not.toHaveBeenCalled();
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('prints strict errors as plain text, even with --json', async () => {
        expect(await handleConfluence(['comment', '12345', '--comment', 'x', '--json'])).toBe(1);
        expect(stderr()).toContain("Error: Unknown option --comment for 'af confluence comment'.");
        expect(err.join('\n')).not.toContain('"error"');
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('names the first stray word of an unquoted body', async () => {
        expect(await handleConfluence(['comment', '12345', '--body', 'Looks', 'good'])).toBe(1);
        expect(stderr()).toContain(
            `Error: Unexpected argument "good" for 'af confluence comment'.`,
        );
        expect(stderr()).toContain('must be quoted');
        expect(client.addComment).not.toHaveBeenCalled();
    });
});

describe('af confluence create', () => {
    const base = ['create', '--space', 'MYSPACE', '--title', 'Runbook'];

    it('reads the page body from stdin with --body-file -', async () => {
        stdin('# Runbook\n\nStep one\n');
        expect(await handleConfluence([...base, '--body-file', '-'])).toBe(0);
        expect(client.createPage).toHaveBeenCalledWith(
            'MYSPACE',
            'Runbook',
            '# Runbook\n\nStep one\n',
            undefined,
            'current',
        );
    });

    it('reads stdin with --body-file=- too', async () => {
        stdin('From stdin');
        expect(await handleConfluence([...base, '--body-file=-'])).toBe(0);
        expect(vi.mocked(client.createPage).mock.calls[0][2]).toBe('From stdin');
    });

    it('reads the page body from a file', async () => {
        const path = file('doc.md', '# Doc\n');
        expect(
            await handleConfluence([
                ...base,
                '--body-file',
                path,
                '--parent',
                '9',
                '--status',
                'draft',
            ]),
        ).toBe(0);
        expect(client.createPage).toHaveBeenCalledWith(
            'MYSPACE',
            'Runbook',
            '# Doc\n',
            '9',
            'draft',
        );
    });

    it('still creates an empty-bodied page for --body "" or no body', async () => {
        expect(await handleConfluence([...base, '--body', ''])).toBe(0);
        expect(await handleConfluence(base)).toBe(0);
        expect(vi.mocked(client.createPage).mock.calls.map(call => call[2])).toEqual(['', '']);
    });

    it('rejects --body together with --body-file without creating a page', async () => {
        const path = file('doc.md', '# Doc\n');
        expect(await handleConfluence([...base, '--body', 'x', '--body-file', path])).toBe(1);
        expect(stderr()).toContain('Error: Cannot use both --body and --body-file');
        expect(client.createPage).not.toHaveBeenCalled();
    });

    it('rejects an empty body file instead of creating an empty page', async () => {
        const path = file('empty.md', '');
        expect(await handleConfluence([...base, '--body-file', path])).toBe(1);
        expect(stderr()).toContain(`Error: --body-file ${path}: the file contains no text`);
        expect(client.createPage).not.toHaveBeenCalled();
    });

    it('checks --space and --title before reading stdin', async () => {
        expect(await handleConfluence(['create', '--title', 'T', '--body-file', '-'])).toBe(1);
        expect(stderr()).toContain('Error: --space and --title are required');
        expect(defaultTextInputIo.readStdin).not.toHaveBeenCalled();
        expect(client.createPage).not.toHaveBeenCalled();
    });

    it('suggests --body-file for --body-flie', async () => {
        expect(await handleConfluence([...base, '--body-flie', 'doc.md'])).toBe(1);
        expect(stderr()).toContain(
            "Error: Unknown option --body-flie for 'af confluence create'. Did you mean --body-file?",
        );
        expect(client.createPage).not.toHaveBeenCalled();
    });
});

describe('af confluence update', () => {
    it('replaces the body from stdin with --body-file -', async () => {
        stdin('## New body\n');
        expect(await handleConfluence(['update', '12345', '--body-file', '-'])).toBe(0);
        expect(client.updatePage).toHaveBeenCalledWith('12345', { bodyMarkdown: '## New body\n' });
    });

    it('updates the title given as --title=value', async () => {
        expect(await handleConfluence(['update', '12345', '--title=New Title'])).toBe(0);
        expect(client.updatePage).toHaveBeenCalledWith('12345', { title: 'New Title' });
    });

    it('leaves the body unchanged for --body ""', async () => {
        expect(await handleConfluence(['update', '12345', '--title', 'New', '--body', ''])).toBe(0);
        expect(client.updatePage).toHaveBeenCalledWith('12345', { title: 'New' });
        expect(vi.mocked(client.updatePage).mock.calls[0][1]).not.toHaveProperty('bodyMarkdown');
    });

    it('does not count --body "" as an update option', async () => {
        expect(await handleConfluence(['update', '12345', '--body', ''])).toBe(1);
        expect(stderr()).toContain('Error: No update options provided');
        expect(stderr()).toContain('Use --title, --body, --body-file, --status, or --message');
        expect(client.updatePage).not.toHaveBeenCalled();
    });

    it('counts --body-file as an update option, and reports empty stdin', async () => {
        stdin(' \n');
        expect(await handleConfluence(['update', '12345', '--body-file', '-'])).toBe(1);
        expect(stderr()).toContain('Error: --body-file -: no text on stdin.');
        expect(stderr()).not.toContain('No update options provided');
        expect(client.updatePage).not.toHaveBeenCalled();
    });

    it('counts an empty --body-file as an update option, and asks for a path', async () => {
        expect(await handleConfluence(['update', '12345', '--body-file', ''])).toBe(1);
        expect(stderr()).toContain('Error: --body-file needs a path, or - for stdin');
        expect(stderr()).not.toContain('No update options provided');
        expect(client.updatePage).not.toHaveBeenCalled();
    });

    it('requires the page id before reading stdin', async () => {
        expect(await handleConfluence(['update', '--body-file', '-'])).toBe(1);
        expect(stderr()).toContain('Error: Page ID required.');
        expect(defaultTextInputIo.readStdin).not.toHaveBeenCalled();
        expect(client.updatePage).not.toHaveBeenCalled();
    });

    it('rejects --body "" together with --body-file', async () => {
        const path = file('doc.md', '# Doc\n');
        expect(await handleConfluence(['update', '12345', '--body', '', '--body-file', path])).toBe(
            1,
        );
        expect(stderr()).toContain('Error: Cannot use both --body and --body-file');
        expect(client.updatePage).not.toHaveBeenCalled();
    });

    it('rejects --body together with --body-file - without reading stdin', async () => {
        expect(await handleConfluence(['update', '12345', '--body', 'x', '--body-file', '-'])).toBe(
            1,
        );
        expect(stderr()).toContain('Error: Cannot use both --body and --body-file');
        expect(defaultTextInputIo.readStdin).not.toHaveBeenCalled();
        expect(client.updatePage).not.toHaveBeenCalled();
    });

    it('changes nothing when the body file is missing', async () => {
        const path = join(dir, 'missing.md');
        expect(
            await handleConfluence(['update', '12345', '--title', 'New', '--body-file', path]),
        ).toBe(1);
        expect(stderr()).toContain(`Error: File not found: ${path}`);
        expect(client.updatePage).not.toHaveBeenCalled();
    });

    it('names the flag, the path and the reason when the path is a directory', async () => {
        const docs = join(dir, 'docs');
        mkdirSync(docs);
        expect(await handleConfluence(['update', '12345', '--body-file', docs])).toBe(1);
        const prefix = `Error: Cannot read --body-file ${docs}: `;
        expect(stderr()).toContain(prefix);
        expect(stderr().split(prefix)[1].trim()).not.toBe('');
        expect(client.updatePage).not.toHaveBeenCalled();
    });

    it('rejects an option that update does not take', async () => {
        expect(await handleConfluence(['update', '12345', '--parent', '9'])).toBe(1);
        expect(stderr()).toContain("Error: Unknown option --parent for 'af confluence update'.");
        expect(client.updatePage).not.toHaveBeenCalled();
    });
});

describe('other subcommands', () => {
    it('keep --add on label as label names', async () => {
        vi.mocked(client.addLabels).mockResolvedValue([] as never);
        expect(await handleConfluence(['label', '12345', '--add', 'a, b'])).toBe(0);
        expect(client.addLabels).toHaveBeenCalledWith('12345', ['a', 'b']);
        expect(client.addComment).not.toHaveBeenCalled();
    });

    it('stay lenient about unknown options, and take --limit=value', async () => {
        vi.mocked(client.listPages).mockResolvedValue({ results: [] } as never);
        expect(
            await handleConfluence(['list', 'MYSPACE', '--limit=5', '--sort', 'title', '--json']),
        ).toBe(0);
        expect(client.listPages).toHaveBeenCalledWith('MYSPACE', 5);
    });

    it('reject --json=1 with exit code 1', async () => {
        expect(await handleConfluence(['spaces', '--json=1'])).toBe(1);
        expect(stderr()).toContain('Error: Option --json does not take a value');
        expect(client.listSpaces).not.toHaveBeenCalled();
    });
});

describe('help', () => {
    async function help(args: string[]): Promise<string> {
        out = [];
        expect(await handleConfluence(args)).toBe(0);
        return out.join('\n');
    }

    it('prints the same full reference for --help, -h, help, no arguments and a subcommand', async () => {
        showConfluenceHelp();
        const reference = out.join('\n');
        for (const args of [['--help'], ['-h'], ['help'], [], ['comment', '--help']]) {
            expect(await help(args)).toBe(reference);
        }
    });

    it('prints the multi-line example flush-left, ready to copy', async () => {
        const lines = (await help(['--help'])).split('\n');
        const start = lines.indexOf("af confluence comment 12345 --body-file - <<'AF_BODY'");
        expect(start).toBeGreaterThan(-1);
        expect(lines.slice(start, start + 5)).toEqual([
            "af confluence comment 12345 --body-file - <<'AF_BODY'",
            '## Summary',
            '',
            '- First point',
            'AF_BODY',
        ]);
    });

    it('explains that \\n inside quotes is not a newline', async () => {
        const text = await help(['--help']);
        expect(text).toContain('quotes, \\n stays a backslash and an n; it is never');
        expect(text).toContain('Double quotes also run `commands` and expand $VARS.');
    });

    it('documents the body flags, stdin and the ADF conversion', async () => {
        const text = await help(['--help']);
        expect(text).toContain(
            '--body "<text>"            Comment text (markdown, converted to ADF)',
        );
        expect(text).toContain(
            '--body-file <path|->       Comment text from a file, or - for stdin',
        );
        expect(text).toContain('--add "<text>"             Alias of --body');
        expect(text).toContain('--body-file <path|->       Page body from a file, or - for stdin');
        expect(text).toContain(
            '--body-file <path|->       New page body from a file, or - for stdin',
        );
        expect(text).toContain('af confluence comment 12345 --body "Great page!"');
        expect(text).not.toContain('omit to list comments');
        expect(text).not.toContain('comment 12345 --add');
    });

    it('documents --limit for the listing subcommands only, not as a global option', async () => {
        const lines = (await help(['--help'])).split('\n');
        const section = (title: string): string[] => {
            const start = lines.indexOf(title);
            expect(start).toBeGreaterThan(-1);
            return lines.slice(start + 1, lines.indexOf('', start));
        };
        expect(section('OPTIONS:')).toEqual([
            '  --json                     Output as JSON instead of markdown',
        ]);
        expect(
            section('LIST OPTIONS (list, search, tree, comments, labels, attachments, spaces):'),
        ).toEqual(['  --limit <n>                Limit results (default: 50)']);
    });
});
