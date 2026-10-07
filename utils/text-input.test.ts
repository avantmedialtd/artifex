import { describe, it, expect } from 'vitest';
import {
    aliasedSource,
    readProse,
    TextInputError,
    type ProseSource,
    type TextInputIo,
} from './text-input.ts';

const BOM = '\uFEFF';

// A fake whose readers fail the test when they are called unexpectedly.
function fakeIo(overrides: Partial<TextInputIo> = {}): TextInputIo & { hints: string[] } {
    const hints: string[] = [];
    return {
        readFile: () => {
            throw new Error('readFile must not be called');
        },
        readStdin: () => {
            throw new Error('readStdin must not be called');
        },
        stdinIsTTY: () => false,
        hint: line => {
            hints.push(line);
        },
        ...overrides,
        hints,
    };
}

function nodeError(code: string, message: string): Error {
    return Object.assign(new Error(`${code}: ${message}`), { code });
}

// Runs fn and returns the TextInputError it throws. Any other error (such as an
// unexpected read) propagates and fails the test.
function inputError(fn: () => unknown): TextInputError {
    try {
        fn();
    } catch (err) {
        if (err instanceof TextInputError) return err;
        throw err;
    }
    throw new Error('expected a TextInputError');
}

const body = (extra: Partial<ProseSource> = {}): ProseSource => ({
    flag: '--body',
    fileFlag: '--body-file',
    ...extra,
});

const STDIN_EMPTY =
    "--body-file -: no text on stdin. Pipe the text in, or use a quoted heredoc: --body-file - <<'AF_BODY'";

describe('readProse', () => {
    describe('inline values', () => {
        it('returns inline text unchanged, including a literal backslash-n', () => {
            const typed = '## Summary\\n\\n- one';
            expect(readProse(body({ value: typed }), {}, fakeIo())).toBe(typed);
        });

        it('treats - on the inline flag as text and does not read stdin', () => {
            expect(readProse(body({ value: '-' }), {}, fakeIo())).toBe('-');
        });

        it('keeps a leading byte-order mark in inline text', () => {
            expect(readProse(body({ value: `${BOM}## Title` }), {}, fakeIo())).toBe(
                `${BOM}## Title`,
            );
        });

        it('returns an empty inline value when it is not required', () => {
            expect(readProse(body({ value: '' }), {}, fakeIo())).toBe('');
        });

        it.each(['', '  \n\t'])('rejects the required inline value %j', value => {
            expect(
                inputError(() => readProse(body({ value }), { required: true }, fakeIo())).message,
            ).toBe('--body is empty. Give the text, or use --body-file (a path, or - for stdin)');
        });

        it('names the alias when the empty required value came from it', () => {
            const src = aliasedSource(
                { flag: '--body' },
                { flag: '--add', value: '' },
                { flag: '--body-file' },
            );
            expect(inputError(() => readProse(src, { required: true }, fakeIo())).message).toBe(
                '--add is empty. Give the text, or use --body-file (a path, or - for stdin)',
            );
        });
    });

    describe('no source', () => {
        it('returns undefined without reading, with and without required', () => {
            expect(readProse(body(), {}, fakeIo())).toBeUndefined();
            expect(readProse(body(), { required: true }, fakeIo())).toBeUndefined();
        });
    });

    describe('file input', () => {
        it('reads the file at the given path', () => {
            const io = fakeIo({
                readFile: path => {
                    expect(path).toBe('notes.md');
                    return 'file text\n';
                },
            });
            expect(readProse(body({ file: 'notes.md' }), {}, io)).toBe('file text\n');
        });

        it('keeps CRLF line endings, escape-like text and the trailing newline', () => {
            const content = 'Logs are in C:\\new\\notes\\app.log\r\nsecond line\r\n';
            const io = fakeIo({ readFile: () => content });
            expect(readProse(body({ file: 'notes.md' }), {}, io)).toBe(content);
        });

        it('removes exactly one leading byte-order mark', () => {
            const once = fakeIo({ readFile: () => `${BOM}## Title\n` });
            expect(readProse(body({ file: 'doc.md' }), {}, once)).toBe('## Title\n');
            const twice = fakeIo({ readFile: () => `${BOM}${BOM}## Title\n` });
            expect(readProse(body({ file: 'doc.md' }), {}, twice)).toBe(`${BOM}## Title\n`);
        });

        it('reports a missing file', () => {
            const io = fakeIo({
                readFile: () => {
                    throw nodeError('ENOENT', "no such file or directory, open 'missing.md'");
                },
            });
            expect(inputError(() => readProse(body({ file: 'missing.md' }), {}, io)).message).toBe(
                'File not found: missing.md',
            );
        });

        it('reports a path through a regular file (ENOTDIR) as not found', () => {
            const io = fakeIo({
                readFile: () => {
                    throw nodeError('ENOTDIR', "not a directory, open 'notes.md/missing.md'");
                },
            });
            expect(
                inputError(() => readProse(body({ file: 'notes.md/missing.md' }), {}, io)).message,
            ).toBe('File not found: notes.md/missing.md');
        });

        it('reports other read errors with the flag, the path and the reason', () => {
            const io = fakeIo({
                readFile: () => {
                    throw nodeError('EISDIR', 'illegal operation on a directory, read');
                },
            });
            expect(inputError(() => readProse(body({ file: './docs' }), {}, io)).message).toBe(
                'Cannot read --body-file ./docs: EISDIR: illegal operation on a directory, read',
            );
        });

        it('rejects an empty path without reading', () => {
            expect(inputError(() => readProse(body({ file: '' }), {}, fakeIo())).message).toBe(
                '--body-file needs a path, or - for stdin',
            );
        });

        it.each(['', ' \n\t\n', BOM, `${BOM}\n`, `${BOM}${BOM}`])(
            'rejects the file content %j as empty',
            content => {
                const io = fakeIo({ readFile: () => content });
                expect(
                    inputError(() => readProse(body({ file: 'notes.md' }), {}, io)).message,
                ).toBe('--body-file notes.md: the file contains no text');
            },
        );

        it('does not print the stdin hint for a file path', () => {
            const io = fakeIo({ readFile: () => 'text', stdinIsTTY: () => true });
            readProse(body({ file: 'notes.md' }), {}, io);
            expect(io.hints).toEqual([]);
        });
    });

    describe('stdin input', () => {
        it('reads stdin for -', () => {
            const io = fakeIo({ readStdin: () => '## Summary\n\n- First point\n' });
            expect(readProse(body({ file: '-' }), {}, io)).toBe('## Summary\n\n- First point\n');
        });

        it('removes one leading byte-order mark from stdin text', () => {
            const io = fakeIo({ readStdin: () => `${BOM}## Title\r\n` });
            expect(readProse(body({ file: '-' }), {}, io)).toBe('## Title\r\n');
        });

        it.each(['', '\n', ' \t\n', BOM, `${BOM}\n`])(
            'rejects the stdin content %j as empty',
            content => {
                const io = fakeIo({ readStdin: () => content });
                expect(inputError(() => readProse(body({ file: '-' }), {}, io)).message).toBe(
                    STDIN_EMPTY,
                );
            },
        );

        it('reports a stdin read error such as EAGAIN', () => {
            const io = fakeIo({
                readStdin: () => {
                    throw nodeError('EAGAIN', 'resource temporarily unavailable, read');
                },
            });
            expect(inputError(() => readProse(body({ file: '-' }), {}, io)).message).toBe(
                'Cannot read stdin for --body-file: EAGAIN: resource temporarily unavailable, read; pass a file path instead',
            );
        });

        it('prints the hint through io.hint only when stdin is a terminal', () => {
            const tty = fakeIo({ readStdin: () => 'typed', stdinIsTTY: () => true });
            expect(readProse(body({ file: '-' }), {}, tty)).toBe('typed');
            expect(tty.hints).toEqual([
                'Reading --body-file from stdin. Type the text, then press Ctrl-D on an empty line.',
            ]);

            const pipe = fakeIo({ readStdin: () => 'piped' });
            expect(readProse(body({ file: '-' }), {}, pipe)).toBe('piped');
            expect(pipe.hints).toEqual([]);
        });
    });

    describe('mutual exclusion', () => {
        it('rejects inline text together with a file before reading it', () => {
            expect(
                inputError(() => readProse(body({ value: 'x', file: 'notes.md' }), {}, fakeIo()))
                    .message,
            ).toBe('Cannot use both --body and --body-file');
        });

        it('rejects inline text together with - before reading stdin', () => {
            expect(
                inputError(() => readProse(body({ value: 'x', file: '-' }), {}, fakeIo())).message,
            ).toBe('Cannot use both --body and --body-file');
        });

        it('rejects an empty inline value together with a file', () => {
            const src: ProseSource = {
                flag: '--comment',
                value: '',
                fileFlag: '--comment-file',
                file: 'notes.md',
            };
            expect(inputError(() => readProse(src, {}, fakeIo())).message).toBe(
                'Cannot use both --comment and --comment-file',
            );
        });
    });
});

describe('aliasedSource', () => {
    const primary = (value?: string) => ({ flag: '--body', value });
    const alias = (value?: string) => ({ flag: '--add', value });
    const file = (value?: string) => ({ flag: '--body-file', value });

    it('uses the alias name when only the alias is given', () => {
        expect(aliasedSource(primary(), alias('x'), file())).toEqual({
            flag: '--add',
            value: 'x',
            fileFlag: '--body-file',
            file: undefined,
        });
    });

    it('uses the primary flag when only it is given', () => {
        expect(aliasedSource(primary('x'), alias(), file())).toEqual({
            flag: '--body',
            value: 'x',
            fileFlag: '--body-file',
            file: undefined,
        });
    });

    it('passes the file twin through', () => {
        expect(aliasedSource(primary(), alias(), file('-'))).toEqual({
            flag: '--body',
            value: undefined,
            fileFlag: '--body-file',
            file: '-',
        });
    });

    it('rejects the alias together with the primary flag, even when one is empty', () => {
        expect(inputError(() => aliasedSource(primary(''), alias('x'), file())).message).toBe(
            'Cannot use both --add and --body (--add is an alias of --body)',
        );
    });

    it('rejects the alias together with the file twin', () => {
        expect(
            inputError(() => aliasedSource(primary(), alias('x'), file('notes.md'))).message,
        ).toBe('Cannot use both --add and --body-file');
    });

    it('rejects the primary flag together with the file twin', () => {
        expect(inputError(() => aliasedSource(primary('x'), alias(), file('-'))).message).toBe(
            'Cannot use both --body and --body-file',
        );
    });
});
