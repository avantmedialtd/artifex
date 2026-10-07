// Prose input shared by the Jira, Confluence and Bitbucket commands. A prose
// value comes from exactly one source: its inline flag (used exactly as the
// shell delivered it), the file named by its `-file` twin, or standard input
// when that twin is given `-`. Nothing is interpreted: `\n` stays two
// characters, and the only change is one leading byte-order mark removed from
// file and stdin text.

import { readFileSync } from 'node:fs';
import { isatty } from 'node:tty';

/** The I/O the resolver needs, injectable so tests never touch real stdin. */
export interface TextInputIo {
    readFile(path: string): string;
    readStdin(): string;
    stdinIsTTY(): boolean;
    hint(line: string): void;
}

// A plain object so tests can vi.spyOn its methods. It never touches
// process.stdin: under Node that switches a pipe to non-blocking mode, and
// readFileSync(0) then throws EAGAIN.
export const defaultTextInputIo: TextInputIo = {
    readFile: path => readFileSync(path, 'utf-8'),
    readStdin: () => readFileSync(0, 'utf-8'),
    stdinIsTTY: () => isatty(0),
    hint: line => console.error(line),
};

/** A prose input problem, reported to the user as is. */
export class TextInputError extends Error {}

/** One prose input: an inline flag and its `-file` twin, each absent when undefined. */
export interface ProseSource {
    /** The inline flag as typed: `--body`, or `--add` when the alias was used. */
    flag: string;
    value?: string;
    /** The file twin, e.g. `--body-file`. Its value is a path, or `-` for stdin. */
    fileFlag: string;
    file?: string;
}

const BYTE_ORDER_MARK = '\uFEFF';

/** Throws when both the inline flag and its file twin were given. Never reads anything. */
export function assertSingleSource(src: ProseSource): void {
    if (src.value !== undefined && src.file !== undefined) {
        throw new TextInputError(`Cannot use both ${src.flag} and ${src.fileFlag}`);
    }
}

/**
 * Merges a prose flag and its alias (`--body` and `--add`) into one source.
 * Presence decides: giving the alias together with the flag or with the file
 * twin is an error, even when a value is empty. Never reads anything.
 */
export function aliasedSource(
    primary: { flag: string; value?: string },
    alias: { flag: string; value?: string },
    file: { flag: string; value?: string },
): ProseSource {
    if (alias.value !== undefined && primary.value !== undefined) {
        throw new TextInputError(
            `Cannot use both ${alias.flag} and ${primary.flag} (${alias.flag} is an alias of ${primary.flag})`,
        );
    }
    if (alias.value !== undefined && file.value !== undefined) {
        throw new TextInputError(`Cannot use both ${alias.flag} and ${file.flag}`);
    }
    const inline = alias.value !== undefined ? alias : primary;
    const source: ProseSource = {
        flag: inline.flag,
        value: inline.value,
        fileFlag: file.flag,
        file: file.value,
    };
    assertSingleSource(source);
    return source;
}

/**
 * Resolves a prose value. Returns undefined when neither flag was given,
 * whatever `required` says: the caller decides what absence means. With
 * `required`, an inline value that is empty or only whitespace is an error.
 * File and stdin text must never be empty.
 */
export function readProse(
    src: ProseSource,
    opts: { required?: boolean } = {},
    io: TextInputIo = defaultTextInputIo,
): string | undefined {
    assertSingleSource(src);

    if (src.value !== undefined) {
        if (opts.required && src.value.trim() === '') {
            throw new TextInputError(
                `${src.flag} is empty. Give the text, or use ${src.fileFlag} (a path, or - for stdin)`,
            );
        }
        return src.value;
    }

    if (src.file === undefined) return undefined;
    if (src.file === '') {
        throw new TextInputError(`${src.fileFlag} needs a path, or - for stdin`);
    }

    const raw = src.file === '-' ? readStdinText(src.fileFlag, io) : readFileText(src, io);
    const text = raw.startsWith(BYTE_ORDER_MARK) ? raw.slice(1) : raw;

    // trim() also removes U+FEFF, so a file of only byte-order marks is empty too.
    if (text.trim() === '') {
        throw new TextInputError(
            src.file === '-'
                ? `${src.fileFlag} -: no text on stdin. Pipe the text in, or use a quoted heredoc: ${src.fileFlag} - <<'AF_BODY'`
                : `${src.fileFlag} ${src.file}: the file contains no text`,
        );
    }
    return text;
}

function readStdinText(fileFlag: string, io: TextInputIo): string {
    if (io.stdinIsTTY()) {
        io.hint(
            `Reading ${fileFlag} from stdin. Type the text, then press Ctrl-D on an empty line.`,
        );
    }
    try {
        return io.readStdin();
    } catch (err) {
        throw new TextInputError(
            `Cannot read stdin for ${fileFlag}: ${errorMessage(err)}; pass a file path instead`,
        );
    }
}

function readFileText(src: ProseSource, io: TextInputIo): string {
    const path = src.file as string;
    try {
        return io.readFile(path);
    } catch (err) {
        // ENOTDIR: a path through a regular file (notes.md/x.md) does not exist either.
        const code = (err as { code?: string }).code;
        if (code === 'ENOENT' || code === 'ENOTDIR') {
            throw new TextInputError(`File not found: ${path}`);
        }
        throw new TextInputError(`Cannot read ${src.fileFlag} ${path}: ${errorMessage(err)}`);
    }
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}
