import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Writable } from 'node:stream';
import {
    assignLocalNames,
    checkDownloadOptions,
    classifyPositionals,
    compileNamePattern,
    downloadAttachments,
    filterByName,
    formatDownloadReport,
    sanitizeFilename,
    type DownloadForms,
    type DownloadItem,
    type DownloadOptions,
} from './download.ts';

const NUL = String.fromCharCode(0);
const UNIT_SEPARATOR = String.fromCharCode(0x1f);
const DELETE = String.fromCharCode(0x7f);
const COMBINING_ACUTE = String.fromCharCode(0x301);
const E_ACUTE = String.fromCharCode(0xe9);
const GRINNING_FACE = String.fromCodePoint(0x1f600);

function bytes(text: string): number {
    return Buffer.byteLength(text, 'utf8');
}

/** True when `text` holds only whole characters: no lone surrogate. */
function isWellFormed(text: string): boolean {
    return Buffer.from(text, 'utf8').toString('utf8') === text;
}

describe('sanitizeFilename', () => {
    it('keeps a name with path separators as one component', () => {
        expect(sanitizeFilename('../../.zshrc', '10046')).toBe('.._.._.zshrc');
        expect(sanitizeFilename('a\\b', '10046')).toBe('a_b');
        expect(sanitizeFilename('2024/report.pdf', '10046')).toBe('2024_report.pdf');
    });

    it('replaces a newline, NUL and the other control characters with _', () => {
        expect(sanitizeFilename('line\nbreak.txt', '1')).toBe('line_break.txt');
        expect(sanitizeFilename(`nul${NUL}.txt`, '1')).toBe('nul_.txt');
        expect(sanitizeFilename(`a${UNIT_SEPARATOR}b${DELETE}c\t.txt`, '1')).toBe('a_b_c_.txt');
    });

    it.each(['..', '.', ''])('falls back to the attachment ID for %j', name => {
        expect(sanitizeFilename(name, '10050')).toBe('attachment-10050');
        expect(sanitizeFilename(name, 'att123')).toBe('attachment-att123');
    });

    it('keeps a name that becomes _ once its separator is replaced', () => {
        // The fallback looks at the result, and `_` is a usable name.
        expect(sanitizeFilename('/', '1')).toBe('_');
    });

    it('normalizes to NFC', () => {
        expect(sanitizeFilename(`caf${'e' + COMBINING_ACUTE}.txt`, '1')).toBe(`caf${E_ACUTE}.txt`);
    });

    it('keeps leading dots', () => {
        expect(sanitizeFilename('.env', '1')).toBe('.env');
        expect(sanitizeFilename('..hidden', '1')).toBe('..hidden');
    });

    it('leaves a name of exactly 255 bytes alone', () => {
        const name = `${'a'.repeat(251)}.png`;
        expect(sanitizeFilename(name, '1')).toBe(name);
    });

    it('shortens a 300-character name to 255 bytes, keeping .png', () => {
        const local = sanitizeFilename(`${'a'.repeat(296)}.png`, '1');
        expect(bytes(local)).toBeLessThanOrEqual(255);
        expect(local).toBe(`${'a'.repeat(251)}.png`);
    });

    it('cuts between multi-byte characters, never inside one', () => {
        // Two bytes each: 251 bytes of room hold 125 of them.
        const twoByte = sanitizeFilename(`${E_ACUTE.repeat(200)}.png`, '1');
        expect(twoByte).toBe(`${E_ACUTE.repeat(125)}.png`);
        expect(bytes(twoByte)).toBe(254);

        // Four bytes (a surrogate pair) each: 62 of them fit.
        const fourByte = sanitizeFilename(`${GRINNING_FACE.repeat(70)}.txt`, '1');
        expect(fourByte).toBe(`${GRINNING_FACE.repeat(62)}.txt`);
        expect(isWellFormed(fourByte)).toBe(true);
    });

    it('keeps an extension of 16 bytes and drops a longer one', () => {
        const ext16 = 'x'.repeat(16);
        const kept = sanitizeFilename(`${'a'.repeat(300)}.${ext16}`, '1');
        expect(kept).toBe(`${'a'.repeat(255 - 17)}.${ext16}`);
        expect(bytes(kept)).toBe(255);

        const dropped = sanitizeFilename(`${'a'.repeat(300)}.${'x'.repeat(17)}`, '1');
        expect(dropped).toBe('a'.repeat(255));
    });
});

describe('assignLocalNames', () => {
    function names(items: { id: string; name: string }[]): Record<string, string> {
        return Object.fromEntries(assignLocalNames(items));
    }

    it('gives names that differ only in case the ID of the later attachment', () => {
        const expected = { '10046': 'Shot.png', '10047': 'shot-10047.png' };
        expect(
            names([
                { id: '10046', name: 'Shot.png' },
                { id: '10047', name: 'shot.png' },
            ]),
        ).toEqual(expected);
        // Named in ID order, whatever order they arrive in.
        expect(
            names([
                { id: '10047', name: 'shot.png' },
                { id: '10046', name: 'Shot.png' },
            ]),
        ).toEqual(expected);
    });

    it('names three duplicates by ID', () => {
        expect(
            names([
                { id: '3', name: 'a.PNG' },
                { id: '1', name: 'a.png' },
                { id: '2', name: 'A.png' },
            ]),
        ).toEqual({ '1': 'a.png', '2': 'A-2.png', '3': 'a-3.PNG' });
    });

    it('adds a counter when the name with the ID is taken too', () => {
        expect(
            names([
                { id: '10045', name: 'shot-10047.png' },
                { id: '10046', name: 'shot.png' },
                { id: '10047', name: 'shot.png' },
            ]),
        ).toEqual({
            '10045': 'shot-10047.png',
            '10046': 'shot.png',
            '10047': 'shot-10047-2.png',
        });
    });

    it('orders Confluence IDs by their digits', () => {
        expect(
            names([
                { id: 'att10', name: 'x.png' },
                { id: 'att9', name: 'X.png' },
            ]),
        ).toEqual({ att9: 'X.png', att10: 'x-att10.png' });
    });

    it('compares sanitized names, after NFC', () => {
        expect(
            names([
                { id: '1', name: `caf${E_ACUTE}.txt` },
                { id: '2', name: `CAF${'E' + COMBINING_ACUTE}.TXT` },
                { id: '3', name: 'a/b' },
                { id: '4', name: 'a\\b' },
            ]),
        ).toEqual({
            '1': `caf${E_ACUTE}.txt`,
            '2': `CAF${String.fromCharCode(0xc9)}-2.TXT`,
            '3': 'a_b',
            '4': 'a_b-4',
        });
    });

    it('puts the ID after a dot file name, which has no extension', () => {
        expect(
            names([
                { id: '1', name: '.env' },
                { id: '2', name: '.ENV' },
            ]),
        ).toEqual({ '1': '.env', '2': '.ENV-2' });
    });

    it('keeps a renamed long name within 255 bytes', () => {
        const long = `${'a'.repeat(251)}.png`;
        const result = names([
            { id: '1', name: long },
            { id: '2', name: long },
        ]);
        expect(result['1']).toBe(long);
        expect(result['2']).toBe(`${'a'.repeat(249)}-2.png`);
        expect(bytes(result['2'])).toBe(255);
    });
});

describe('compileNamePattern', () => {
    it('matches * against any run, ignoring case', () => {
        const png = compileNamePattern('*.png');
        expect(png('b.PNG')).toBe(true);
        expect(png('a.png')).toBe(true);
        expect(png('.png')).toBe(true);
        expect(png('notes.txt')).toBe(false);
    });

    it('matches the whole name', () => {
        expect(compileNamePattern('*.png')('x.png.txt')).toBe(false);
        expect(compileNamePattern('shot')('screenshot.png')).toBe(false);
    });

    it('matches ? against exactly one character', () => {
        const one = compileNamePattern('?.png');
        expect(one('a.png')).toBe(true);
        expect(one(`${GRINNING_FACE}.png`)).toBe(true);
        expect(one('ab.png')).toBe(false);
        expect(one('.png')).toBe(false);
    });

    it('treats regular-expression characters as literals', () => {
        const literal = compileNamePattern('a+b(1).png');
        expect(literal('a+b(1).png')).toBe(true);
        expect(literal('A+B(1).PNG')).toBe(true);
        expect(literal('aab(1).png')).toBe(false);
        expect(literal('a+b1.png')).toBe(false);
        expect(literal('a+b(1)_png')).toBe(false);
        expect(compileNamePattern('report[1]{2}|$^.pdf')('report[1]{2}|$^.pdf')).toBe(true);
        expect(compileNamePattern('back\\slash')('back\\slash')).toBe(true);
    });

    it('lets * match across a line break', () => {
        expect(compileNamePattern('a*b')('a\nb')).toBe(true);
    });

    it('compares pattern and name in NFC', () => {
        expect(compileNamePattern(`caf${E_ACUTE}*`)(`CAF${'E' + COMBINING_ACUTE}.txt`)).toBe(true);
    });
});

describe('classifyPositionals', () => {
    const forms: DownloadForms = {
        command: 'af confluence download',
        usage: 'af confluence download <page-id> | <attachment-id>...',
        container: { name: 'page ID', examples: '12345', pattern: /^\d+$/ },
        attachment: { name: 'attachment ID', examples: 'att12345', pattern: /^att\d+$/ },
    };
    const accepted =
        'Accepted forms: one page ID (12345), or one or more attachment IDs (att12345).';

    it('takes one page ID', () => {
        expect(classifyPositionals(['12345'], forms)).toEqual({
            kind: 'container',
            value: '12345',
        });
    });

    it('takes attachment IDs, each once, in the order given', () => {
        expect(classifyPositionals(['att2', 'att1', 'att2'], forms)).toEqual({
            kind: 'ids',
            ids: ['att2', 'att1'],
        });
    });

    it('rejects mixing the forms, in either order, naming the argument', () => {
        expect(() => classifyPositionals(['12345', 'att111'], forms)).toThrow(
            `Unexpected argument "att111" for 'af confluence download': a call takes one page ID or attachment IDs, not both.\n${accepted}`,
        );
        expect(() => classifyPositionals(['att111', '12345'], forms)).toThrow(
            `Unexpected argument "12345" for 'af confluence download': a call takes one page ID or attachment IDs, not both.`,
        );
    });

    it('rejects a second page ID', () => {
        expect(() => classifyPositionals(['1', '2'], forms)).toThrow(
            `Unexpected argument "2" for 'af confluence download': a call takes one page ID.\n${accepted}`,
        );
    });

    it('rejects an argument of neither form, pointing filenames at --name', () => {
        expect(() => classifyPositionals(['att1', 'shot.png'], forms)).toThrow(
            [
                `Unrecognized argument "shot.png" for 'af confluence download'.`,
                accepted,
                "To select attachments by filename, use --name '<pattern>'.",
            ].join('\n'),
        );
    });

    it('asks for an argument when there is none', () => {
        expect(() => classifyPositionals([], forms)).toThrow(
            'Page ID or attachment IDs required. Usage: af confluence download <page-id> | <attachment-id>...',
        );
    });
});

describe('checkDownloadOptions', () => {
    it.each([{}, { out: 'dir' }, { out: 'dir', force: true }, { out: '-' }, { json: true }])(
        'accepts %j',
        options => {
            expect(() => checkDownloadOptions(options)).not.toThrow();
        },
    );

    it.each([
        [{ force: true }, '--force needs --out <dir>'],
        [{ out: '-', force: true }, '--force needs --out <dir>'],
        [{ out: '-', json: true }, '--json cannot be used with --out -'],
        [{ out: '' }, '--out needs a directory, or - for standard output'],
    ])('rejects %j', (options, message) => {
        expect(() => checkDownloadOptions(options)).toThrow(message);
    });
});

describe('filterByName', () => {
    const names = ['mobile-modules.png', 'notes.txt', `bad${String.fromCharCode(10)}name.txt`];
    const self = (name: string): string => name;

    it('keeps everything without a pattern', () => {
        expect(filterByName(names, undefined, self)).toEqual(names);
    });

    it('keeps the matching names', () => {
        expect(filterByName(names, '*.txt', self)).toEqual(names.slice(1));
    });

    it('names the pattern and lists every name, one per line, when nothing matches', () => {
        expect(() => filterByName(names, '*.pdf', self)).toThrow(
            [
                "No attachment matches --name '*.pdf'. The attachments are:",
                '  mobile-modules.png',
                '  notes.txt',
                '  bad_name.txt',
            ].join('\n'),
        );
    });

    it('returns nothing for nothing, without an error', () => {
        expect(filterByName([], '*.pdf', self)).toEqual([]);
    });
});

describe('formatDownloadReport', () => {
    const file = {
        id: '10113',
        filename: 'mobile-modules.png',
        path: '/tmp/af dir/mobile-modules.png',
        size: 38_612,
        mimeType: 'image/png',
    };

    it('leaves the source out for attachment IDs, and keeps a path with spaces last', () => {
        const report = formatDownloadReport(
            {
                directory: '/tmp/af dir',
                files: [
                    { ...file, status: 'downloaded' },
                    { ...file, id: '10115', status: 'skipped' },
                    {
                        ...file,
                        id: '10116',
                        filename: `a${String.fromCharCode(10)}b.png`,
                        status: 'failed',
                        error: 'HTTP 403: Forbidden',
                    },
                ],
            },
            undefined,
        );
        expect(report.stdout).toBe(
            [
                'Downloaded 1 attachment(s) to /tmp/af dir',
                '10113  37.7 KB  /tmp/af dir/mobile-modules.png',
                '10115  37.7 KB  (already present)  /tmp/af dir/mobile-modules.png',
            ].join('\n'),
        );
        expect(report.stderr).toEqual(['Failed to download 10116 (a_b.png): HTTP 403: Forbidden']);
    });

    it('names the source when there is one', () => {
        const report = formatDownloadReport({ directory: '/d', files: [] }, 'page 12345');
        expect(report.stdout).toBe('Downloaded 0 attachment(s) from page 12345 to /d');
    });

    it('leaves the folder out when the run used none', () => {
        const report = formatDownloadReport(
            {
                directory: null,
                files: [{ ...file, path: null, status: 'failed', error: 'no download link' }],
            },
            'page 12345',
        );
        expect(report.stdout).toBe('Downloaded 0 attachment(s) from page 12345');
        expect(report.stderr).toEqual([
            'Failed to download 10113 (mobile-modules.png): no download link',
        ]);
    });
});

describe('downloadAttachments', () => {
    const SITE = 'https://example.atlassian.net';
    const MEDIA = 'https://api.media.atlassian.com';
    const AUTH = 'Basic test-credentials';

    let fetchMock: ReturnType<typeof vi.fn>;
    // Fresh folders go to the real OS temporary directory, under a prefix of
    // this test's own, so they can be found and removed afterwards.
    let prefix: string;
    // A scratch directory for `out` targets.
    let scratch: string;

    beforeEach(() => {
        fetchMock = vi.fn(async (url: string) => {
            throw new Error(`unexpected request: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);
        prefix = `af-download-test-${randomUUID().slice(0, 8)}-`;
        scratch = mkdtempSync(join(tmpdir(), 'af-download-out-'));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        for (const folder of freshFolders()) rmSync(folder, { recursive: true, force: true });
        rmSync(scratch, { recursive: true, force: true });
    });

    function freshFolders(): string[] {
        return readdirSync(tmpdir())
            .filter(name => name.startsWith(prefix))
            .map(name => join(tmpdir(), name));
    }

    function contentUrl(id: string): string {
        return `${SITE}/rest/api/3/attachment/content/${id}?redirect=false`;
    }

    function item(id: string, name: string, content: string, size?: number): DownloadItem {
        return {
            id,
            name,
            size: size ?? Buffer.byteLength(content),
            mimeType: 'image/png',
            url: contentUrl(id),
        };
    }

    function options(extra: Partial<DownloadOptions> = {}): DownloadOptions {
        return { prefix, authorization: AUTH, baseOrigin: SITE, ...extra };
    }

    /** Answers each URL with a fresh response from its route; any other URL fails the test. */
    function serve(routes: Record<string, () => Response>): void {
        fetchMock.mockImplementation(async (url: string) => {
            const route = routes[url];
            if (!route) throw new Error(`unexpected request: ${url}`);
            return route();
        });
    }

    function redirect(location: string, status = 302): Response {
        return new Response(null, { status, headers: { Location: location } });
    }

    function requests(): { url: string; init: RequestInit }[] {
        return fetchMock.mock.calls.map((call: unknown[]) => ({
            url: call[0] as string,
            init: call[1] as RequestInit,
        }));
    }

    function sink(): { stream: Writable; bytes: () => string } {
        const chunks: Buffer[] = [];
        const stream = new Writable({
            write(chunk: Buffer, _encoding, callback) {
                chunks.push(Buffer.from(chunk));
                callback();
            },
        });
        return { stream, bytes: () => Buffer.concat(chunks).toString('utf8') };
    }

    describe('destination', () => {
        it('creates a new folder in the temporary directory on every run', async () => {
            serve({ [contentUrl('10113')]: () => new Response('png') });
            const first = await downloadAttachments([item('10113', 'a.png', 'png')], options());
            const second = await downloadAttachments([item('10113', 'a.png', 'png')], options());

            expect(first.directory).not.toBe(second.directory);
            for (const summary of [first, second]) {
                expect(dirname(summary.directory as string)).toBe(tmpdir());
                expect(summary.directory?.startsWith(join(tmpdir(), prefix))).toBe(true);
                expect(summary.files[0].path).toBe(join(summary.directory as string, 'a.png'));
            }
            expect(freshFolders()).toHaveLength(2);
        });

        it('creates no folder when nothing is selected', async () => {
            const none = { directory: null, files: [] };
            expect(await downloadAttachments([], options())).toEqual(none);
            const out = join(scratch, 'missing');
            expect(await downloadAttachments([], options({ out }))).toEqual(none);
            expect(freshFolders()).toEqual([]);
            expect(existsSync(out)).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('creates a missing --out directory and its parents', async () => {
            serve({ [contentUrl('10113')]: () => new Response('png') });
            const out = join(scratch, 'a', 'b');
            const summary = await downloadAttachments(
                [item('10113', 'mobile-modules.png', 'png')],
                options({ out }),
            );
            expect(summary.directory).toBe(out);
            expect(readFileSync(join(out, 'mobile-modules.png'), 'utf8')).toBe('png');
            expect(freshFolders()).toEqual([]);
        });

        it('rejects an --out path that is not a directory', async () => {
            const file = join(scratch, 'file.txt');
            writeFileSync(file, 'x');
            await expect(
                downloadAttachments([item('1', 'a.png', 'png')], options({ out: file })),
            ).rejects.toThrow(`--out ${file} is not a directory`);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('keeps a name with path separators inside the folder', async () => {
            serve({ [contentUrl('10046')]: () => new Response('secret') });
            const out = join(scratch, 'shots');
            await downloadAttachments([item('10046', '../../.zshrc', 'secret')], options({ out }));
            expect(readdirSync(out)).toEqual(['.._.._.zshrc']);
            expect(readdirSync(scratch)).toEqual(['shots']);
        });

        it('writes names that differ only in case as two files', async () => {
            serve({
                [contentUrl('10046')]: () => new Response('first'),
                [contentUrl('10047')]: () => new Response('second'),
            });
            const out = join(scratch, 'shots');
            await downloadAttachments(
                [item('10047', 'shot.png', 'second'), item('10046', 'Shot.png', 'first')],
                options({ out }),
            );
            expect(readFileSync(join(out, 'Shot.png'), 'utf8')).toBe('first');
            expect(readFileSync(join(out, 'shot-10047.png'), 'utf8')).toBe('second');
        });
    });

    describe('existing files in --out', () => {
        it('skips a regular file of the same size and downloads the rest', async () => {
            serve({ [contentUrl('10115')]: () => new Response('settings') });
            writeFileSync(join(scratch, 'mobile-modules.png'), 'OLD');
            const summary = await downloadAttachments(
                [
                    item('10113', 'mobile-modules.png', 'png'),
                    item('10115', 'mobile-property-settings.png', 'settings'),
                ],
                options({ out: scratch }),
            );

            expect(summary.files.map(f => [f.id, f.status])).toEqual([
                ['10113', 'skipped'],
                ['10115', 'downloaded'],
            ]);
            // Same name and size: trusted to be the same file, and left alone.
            expect(readFileSync(join(scratch, 'mobile-modules.png'), 'utf8')).toBe('OLD');
            expect(requests().map(r => r.url)).toEqual([contentUrl('10115')]);
        });

        it('lists every conflict and downloads nothing', async () => {
            serve({ [contentUrl('10113')]: () => new Response('png') });
            const other = join(scratch, 'elsewhere.txt');
            writeFileSync(other, 'target');
            writeFileSync(join(scratch, 'a.png'), 'a different size');
            symlinkSync(other, join(scratch, 'b.png'));
            mkdirSync(join(scratch, 'c.png'));

            const run = downloadAttachments(
                [
                    item('1', 'a.png', 'png'),
                    item('2', 'b.png', 'png'),
                    item('3', 'c.png', 'png'),
                    item('10113', 'd.png', 'png'),
                ],
                options({ out: scratch }),
            );

            await expect(run).rejects.toThrow(
                [
                    `3 existing paths in ${scratch} would be replaced, so nothing was downloaded:`,
                    `  ${join(scratch, 'a.png')}`,
                    `  ${join(scratch, 'b.png')}`,
                    `  ${join(scratch, 'c.png')}`,
                    'Pass --force to replace what is there (a directory is never replaced).',
                ].join('\n'),
            );
            expect(fetchMock).not.toHaveBeenCalled();
            expect(existsSync(join(scratch, 'd.png'))).toBe(false);
            expect(readFileSync(join(scratch, 'a.png'), 'utf8')).toBe('a different size');
        });

        it('replaces a file with --force, even one of the same size', async () => {
            serve({
                [contentUrl('1')]: () => new Response('new'),
                [contentUrl('2')]: () => new Response('fresh bytes'),
            });
            writeFileSync(join(scratch, 'a.png'), 'old');
            writeFileSync(join(scratch, 'b.png'), 'stale');
            const summary = await downloadAttachments(
                [item('1', 'a.png', 'new'), item('2', 'b.png', 'fresh bytes')],
                options({ out: scratch, force: true }),
            );
            expect(summary.files.map(f => f.status)).toEqual(['downloaded', 'downloaded']);
            expect(readFileSync(join(scratch, 'a.png'), 'utf8')).toBe('new');
            expect(readFileSync(join(scratch, 'b.png'), 'utf8')).toBe('fresh bytes');
        });

        it('replaces a symbolic link with --force, leaving its target unchanged', async () => {
            serve({ [contentUrl('10113')]: () => new Response('attachment bytes') });
            const target = join(scratch, 'target.txt');
            writeFileSync(target, 'do not touch');
            mkdirSync(join(scratch, 'shots'));
            const final = join(scratch, 'shots', 'mobile-modules.png');
            symlinkSync(target, final);

            await downloadAttachments(
                [item('10113', 'mobile-modules.png', 'attachment bytes')],
                options({ out: join(scratch, 'shots'), force: true }),
            );

            expect(lstatSync(final).isFile()).toBe(true);
            expect(readFileSync(final, 'utf8')).toBe('attachment bytes');
            expect(readFileSync(target, 'utf8')).toBe('do not touch');
        });

        it('refuses a directory at a final path even with --force', async () => {
            mkdirSync(join(scratch, 'a.png'));
            await expect(
                downloadAttachments(
                    [item('1', 'a.png', 'png')],
                    options({ out: scratch, force: true }),
                ),
            ).rejects.toThrow(
                [
                    `1 path in ${scratch} is a directory, which --force cannot replace, so nothing was downloaded:`,
                    `  ${join(scratch, 'a.png')}`,
                ].join('\n'),
            );
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('writing', () => {
        it('leaves neither the file nor a temporary file after a short body', async () => {
            serve({ [contentUrl('10046')]: () => new Response('x'.repeat(1000)) });
            const summary = await downloadAttachments(
                [item('10046', 'image.png', '', 26_904)],
                options({ out: scratch }),
            );
            expect(summary.files[0]).toMatchObject({
                status: 'failed',
                error: 'expected 26904 bytes, received 1000',
            });
            expect(readdirSync(scratch)).toEqual([]);
        });

        it('leaves no temporary file after a failed request', async () => {
            serve({
                [contentUrl('10046')]: () =>
                    new Response(
                        JSON.stringify({
                            errorMessages: ["The attachment with id '10046' does not exist"],
                            errors: {},
                        }),
                        { status: 404 },
                    ),
            });
            const summary = await downloadAttachments(
                [item('10046', 'image.png', 'png')],
                options({ out: scratch }),
            );
            expect(summary.files[0].error).toBe("The attachment with id '10046' does not exist");
            expect(readdirSync(scratch)).toEqual([]);
        });

        it('reports a result per file with the metadata name and the absolute path', async () => {
            serve({ [contentUrl('10046')]: () => new Response('png') });
            const summary = await downloadAttachments(
                [item('10046', 'a/b.png', 'png')],
                options({ out: scratch }),
            );
            expect(summary).toEqual({
                directory: scratch,
                files: [
                    {
                        id: '10046',
                        filename: 'a/b.png',
                        path: join(scratch, 'a_b.png'),
                        size: 3,
                        mimeType: 'image/png',
                        status: 'downloaded',
                    },
                ],
            });
        });
    });

    describe('requests', () => {
        it('sends credentials to the site and none to another origin it redirects to', async () => {
            const media = `${MEDIA}/file/abc/binary?token=t&client=c`;
            serve({
                [contentUrl('10046')]: () => redirect(media, 303),
                [media]: () => new Response('png'),
            });
            const summary = await downloadAttachments(
                [item('10046', 'image.png', 'png')],
                options({ out: scratch }),
            );
            expect(summary.files[0].status).toBe('downloaded');
            const [site, cdn] = requests();
            expect(site.init).toMatchObject({
                redirect: 'manual',
                headers: { Authorization: AUTH },
            });
            expect(cdn.url).toBe(media);
            expect(cdn.init).toMatchObject({ redirect: 'manual', headers: {} });
            expect(cdn.init.headers).not.toHaveProperty('Authorization');
        });

        it('keeps credentials on a redirect within the site, resolving a relative Location', async () => {
            const first = `${SITE}/wiki/download/attachments/1/a.png`;
            serve({
                [first]: () => redirect('/wiki/download/attachments/1/a.png?version=2'),
                [`${first}?version=2`]: () => new Response('png'),
            });
            await downloadAttachments(
                [{ ...item('att1', 'a.png', 'png'), url: first }],
                options({ out: scratch }),
            );
            const [, second] = requests();
            expect(second.url).toBe(`${first}?version=2`);
            expect(second.init.headers).toEqual({ Authorization: AUTH });
        });

        it('follows 5 redirects and fails a file on the 6th', async () => {
            const chain = (hops: number): Record<string, () => Response> => {
                const routes: Record<string, () => Response> = {};
                for (let i = 0; i < hops; i++) {
                    routes[`${SITE}/r${i}`] = () => redirect(`/r${i + 1}`);
                }
                routes[`${SITE}/r${hops}`] = () => new Response('png');
                return routes;
            };

            serve(chain(5));
            const ok = await downloadAttachments(
                [{ ...item('1', 'a.png', 'png'), url: `${SITE}/r0` }],
                options({ out: join(scratch, 'five') }),
            );
            expect(ok.files[0].status).toBe('downloaded');

            serve(chain(6));
            const tooMany = await downloadAttachments(
                [{ ...item('1', 'a.png', 'png'), url: `${SITE}/r0` }],
                options({ out: join(scratch, 'six') }),
            );
            expect(tooMany.files[0]).toMatchObject({
                status: 'failed',
                error: 'Too many redirects: gave up after 5',
            });
            expect(fetchMock).toHaveBeenCalledTimes(12);
        });

        it('falls back to the HTTP status for an error body that is not JSON', async () => {
            const media = `${MEDIA}/file/abc/binary?token=expired`;
            serve({
                [contentUrl('10046')]: () => redirect(media),
                [media]: () =>
                    new Response('<html>denied</html>', { status: 403, statusText: 'Forbidden' }),
            });
            const summary = await downloadAttachments(
                [item('10046', 'image.png', 'png')],
                options({ out: scratch }),
            );
            expect(summary.files[0].error).toBe('HTTP 403: Forbidden');
        });
    });

    describe('concurrency', () => {
        it('keeps at most 4 downloads in flight', async () => {
            const items = Array.from({ length: 12 }, (_, i) =>
                item(String(10001 + i), `shot-${i}.png`, 'png bytes'),
            );
            const pending: Array<() => void> = [];
            let inFlight = 0;
            let maxInFlight = 0;
            fetchMock.mockImplementation(async () => {
                inFlight++;
                maxInFlight = Math.max(maxInFlight, inFlight);
                await new Promise<void>(resolve => pending.push(resolve));
                let sent = false;
                // In flight until its body has been read to the end.
                return new Response(
                    new ReadableStream({
                        pull(controller) {
                            if (sent) {
                                controller.close();
                                inFlight--;
                            } else {
                                controller.enqueue(new TextEncoder().encode('png bytes'));
                                sent = true;
                            }
                        },
                    }),
                );
            });

            let done = false;
            const run = downloadAttachments(items, options()).finally(() => {
                done = true;
            });
            while (!done) {
                await new Promise(resolve => setTimeout(resolve, 1));
                expect(inFlight).toBeLessThanOrEqual(4);
                pending.shift()?.();
            }

            const summary = await run;
            expect(maxInFlight).toBe(4);
            expect(summary.files.map(f => f.status)).toEqual(Array(12).fill('downloaded'));
            expect(readdirSync(summary.directory as string)).toHaveLength(12);
        });

        it('downloads the other files when one fails', async () => {
            serve({
                [contentUrl('10113')]: () => new Response('png'),
                [contentUrl('10115')]: () =>
                    new Response(JSON.stringify({ errorMessages: ['Boom'], errors: {} }), {
                        status: 500,
                    }),
            });
            const summary = await downloadAttachments(
                [item('10115', 'b.png', 'png'), item('10113', 'a.png', 'png')],
                options({ out: scratch }),
            );
            expect(summary.files).toMatchObject([
                { id: '10113', status: 'downloaded' },
                { id: '10115', status: 'failed', error: 'Boom' },
            ]);
            expect(summary.files[0]).not.toHaveProperty('error');
            expect(readdirSync(scratch)).toEqual(['a.png']);
        });

        it('fails an item that carries an error without requesting it', async () => {
            serve({ [contentUrl('10113')]: () => new Response('png') });
            const summary = await downloadAttachments(
                [
                    item('10113', 'a.png', 'png'),
                    { ...item('10114', 'b.png', 'png'), url: '', error: 'no download link' },
                ],
                options({ out: scratch }),
            );
            expect(summary.files).toMatchObject([
                { id: '10113', status: 'downloaded' },
                {
                    id: '10114',
                    status: 'failed',
                    error: 'no download link',
                    path: join(scratch, 'b.png'),
                },
            ]);
            expect(requests().map(r => r.url)).toEqual([contentUrl('10113')]);
            expect(readdirSync(scratch)).toEqual(['a.png']);
        });

        // Two attachments that can only fail, for example Confluence attachments
        // whose download links are not site paths.
        const badLinks = (): DownloadItem[] => [
            { ...item('att2', 'b.png', 'b'), url: '', error: 'no download link' },
            { ...item('att1', 'a.png', 'a'), url: '', error: 'bad download link' },
        ];

        it('creates no fresh folder when every item carries an error', async () => {
            const summary = await downloadAttachments(badLinks(), options());

            expect(summary).toEqual({
                directory: null,
                files: [
                    expect.objectContaining({
                        id: 'att1',
                        path: null,
                        status: 'failed',
                        error: 'bad download link',
                    }),
                    expect.objectContaining({
                        id: 'att2',
                        path: null,
                        status: 'failed',
                        error: 'no download link',
                    }),
                ],
            });
            expect(freshFolders()).toEqual([]);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('creates no --out directory when every item carries an error', async () => {
            const out = join(scratch, 'not', 'there');
            const summary = await downloadAttachments(badLinks(), options({ out }));

            expect(summary.directory).toBeNull();
            expect(summary.files.map(f => [f.status, f.path])).toEqual([
                ['failed', null],
                ['failed', null],
            ]);
            expect(existsSync(join(scratch, 'not'))).toBe(false);
            expect(freshFolders()).toEqual([]);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('standard output', () => {
        it('writes exactly the bytes to the stream and creates no folder', async () => {
            const bytes = 'PNG' + String.fromCharCode(0, 1, 2) + 'end';
            serve({ [contentUrl('10046')]: () => new Response(bytes) });
            const out = sink();
            const summary = await downloadAttachments(
                [item('10046', 'image.png', bytes)],
                options({ out: '-', stdout: out.stream }),
            );
            expect(out.bytes()).toBe(bytes);
            expect(summary).toEqual({
                directory: null,
                files: [expect.objectContaining({ id: '10046', path: '-', status: 'downloaded' })],
            });
            expect(freshFolders()).toEqual([]);
            expect(out.stream.writableEnded).toBe(false);
        });

        it('needs exactly one attachment, and says how many were selected', async () => {
            for (const items of [[], [item('1', 'a.png', 'a'), item('2', 'b.png', 'b')]]) {
                await expect(
                    downloadAttachments(items, options({ out: '-', stdout: sink().stream })),
                ).rejects.toThrow(
                    `${items.length} attachments were selected, but --out - takes exactly one.`,
                );
            }
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('fails an item that carries an error without writing or requesting', async () => {
            const out = sink();
            const summary = await downloadAttachments(
                [{ ...item('att1', 'a.png', 'png'), url: '', error: 'no download link' }],
                options({ out: '-', stdout: out.stream }),
            );
            expect(summary.files[0]).toMatchObject({ status: 'failed', error: 'no download link' });
            expect(out.bytes()).toBe('');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('reports a short body after writing what arrived', async () => {
            serve({ [contentUrl('10046')]: () => new Response('partial') });
            const out = sink();
            const summary = await downloadAttachments(
                [item('10046', 'image.png', '', 26_904)],
                options({ out: '-', stdout: out.stream }),
            );
            expect(out.bytes()).toBe('partial');
            expect(summary.files[0]).toMatchObject({
                status: 'failed',
                error: 'expected 26904 bytes, received 7',
            });
        });
    });
});
