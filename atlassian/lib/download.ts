/**
 * Downloading Jira and Confluence attachments to local files, shared by
 * `af jira download` and `af confluence download`.
 *
 * The planning steps are pure: turning untrusted attachment names into safe
 * local filenames, resolving collisions between them, and matching `--name`.
 * `downloadAttachments` does the I/O. It uses Node APIs only, which Bun
 * implements too, so Vitest (running under Node) can exercise it against a
 * real temporary directory.
 */

import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable, Transform, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { mapWithConcurrency } from '../../utils/concurrency.ts';
import { formatBytes } from '../../utils/format-bytes.ts';
import { AtlassianHttpError, errorMessageFrom } from './request.ts';

/** At most this many downloads, and metadata requests, run at once (design D7). */
export const DOWNLOAD_CONCURRENCY = 4;

/** The most redirects one download follows (design D6). */
const MAX_REDIRECTS = 5;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** The longest filename, in UTF-8 bytes, that macOS and Linux file systems accept. */
const MAX_NAME_BYTES = 255;

/** The longest extension, in UTF-8 bytes after its dot, that shortening keeps. */
const MAX_EXTENSION_BYTES = 16;

/** One attachment to download: its metadata and where its content is. */
export interface DownloadItem {
    /** The attachment ID: digits for Jira, `att<digits>` for Confluence. */
    id: string;
    /** The name in the metadata (Jira `filename`, Confluence `title`). Untrusted. */
    name: string;
    /** The size in bytes in the metadata (Jira `size`, Confluence `fileSize`). */
    size: number;
    mimeType: string;
    /** The absolute URL of the content, on the configured site. */
    url: string;
    /**
     * Set when the content cannot be fetched, for example a Confluence
     * `downloadLink` that is not a site-relative path. The file then fails with
     * this error, and nothing is requested for it.
     */
    error?: string;
}

/** What happened to one file. */
export type DownloadStatus = 'downloaded' | 'skipped' | 'failed';

/** The outcome for one file, as `--json` prints it. */
export interface DownloadResult {
    id: string;
    /** The attachment's original metadata name. */
    filename: string;
    /**
     * The absolute local path; `-` for standard output; null when the run used
     * no folder, because every file failed before any request.
     */
    path: string | null;
    size: number;
    mimeType: string;
    status: DownloadStatus;
    /** Why the file failed. Only a failed file has it. */
    error?: string;
}

/** What `downloadAttachments` needs besides the attachments. */
export interface DownloadOptions {
    /** The name prefix of the fresh temporary folder, for example `af-jira-MR-4-`. */
    prefix: string;
    /** `--out`: the directory to write into, or `-` for standard output. */
    out?: string;
    /** `--force`: replace what is at a final path in the `out` directory, except a directory. */
    force?: boolean;
    /** The `Authorization` header value, sent only to `baseOrigin`. */
    authorization: string;
    /** The configured site's origin, for example `https://example.atlassian.net`. */
    baseOrigin: string;
    /** Where `out: '-'` writes the bytes. Standard output by default. */
    stdout?: Writable;
}

/** Where the files went, and what happened to each. */
export interface DownloadSummary {
    /**
     * The absolute destination folder, or null when the run used none: nothing
     * was selected, every file failed before any request, or `out` is `-`.
     */
    directory: string | null;
    /** One entry per attachment, in ascending ID order. */
    files: DownloadResult[];
}

/** The two argument forms of a `download` command (design D1). */
export interface DownloadForms {
    /** The command as errors show it, for example `af jira download`. */
    command: string;
    /** The usage line, for a call without arguments. */
    usage: string;
    /** One argument selecting every attachment of an issue or page. */
    container: { name: string; examples: string; pattern: RegExp };
    /** Arguments selecting attachments by ID. */
    attachment: { name: string; examples: string; pattern: RegExp };
}

/** What a `download` call selects: one issue or page, or attachments by ID (without repeats). */
export type DownloadSelection =
    { kind: 'container'; value: string } | { kind: 'ids'; ids: string[] };

// Planning

/**
 * Sorts a `download` call's positional arguments into one of its two forms
 * (design D1): one issue key or page ID, or one or more attachment IDs, an ID
 * given twice counting once. Mixing the forms, a second key or page ID, or an
 * argument of neither form throws an error naming the argument and both forms.
 */
export function classifyPositionals(
    args: readonly string[],
    forms: DownloadForms,
): DownloadSelection {
    const { container, attachment } = forms;
    if (args.length === 0) {
        const required = `${container.name} or ${attachment.name}s required`;
        throw new Error(`${required[0].toUpperCase()}${required.slice(1)}. Usage: ${forms.usage}`);
    }
    const accepted =
        `Accepted forms: one ${container.name} (${container.examples}), ` +
        `or one or more ${attachment.name}s (${attachment.examples}).`;
    const unexpected = (arg: string, reason: string): Error =>
        new Error(`Unexpected argument "${arg}" for '${forms.command}': ${reason}.\n${accepted}`);
    const notBoth = `a call takes one ${container.name} or ${attachment.name}s, not both`;

    let key: string | undefined;
    const ids: string[] = [];
    for (const arg of args) {
        if (container.pattern.test(arg)) {
            if (ids.length > 0) throw unexpected(arg, notBoth);
            if (key !== undefined) throw unexpected(arg, `a call takes one ${container.name}`);
            key = arg;
        } else if (attachment.pattern.test(arg)) {
            if (key !== undefined) throw unexpected(arg, notBoth);
            if (!ids.includes(arg)) ids.push(arg);
        } else {
            throw new Error(
                [
                    `Unrecognized argument "${arg}" for '${forms.command}'.`,
                    accepted,
                    "To select attachments by filename, use --name '<pattern>'.",
                ].join('\n'),
            );
        }
    }
    return key === undefined ? { kind: 'ids', ids } : { kind: 'container', value: key };
}

/**
 * Throws on a combination of `download` options that cannot work (designs D3
 * and D9), before any request: `--force` needs `--out <dir>`, `--json` cannot
 * share standard output with the bytes of `--out -`, and `--out` needs a value.
 */
export function checkDownloadOptions(options: {
    out?: string;
    force?: boolean;
    json?: boolean;
}): void {
    if (options.out === '') {
        throw new Error('--out needs a directory, or - for standard output');
    }
    if (options.force && (options.out === undefined || options.out === '-')) {
        throw new Error(
            '--force needs --out <dir>. Without --out each run writes to a new, empty folder, ' +
                'and --out - writes to standard output, so there is nothing to replace.',
        );
    }
    if (options.json && options.out === '-') {
        throw new Error(
            "--json cannot be used with --out -: standard output carries the attachment's bytes",
        );
    }
}

/**
 * The attachments whose metadata name matches `--name` (design D8), or all of
 * them without a pattern. When there are attachments but none matches, which is
 * most likely a typo, throws an error naming the pattern and listing the names,
 * so the pattern can be corrected without another call.
 */
export function filterByName<T>(
    attachments: readonly T[],
    pattern: string | undefined,
    nameOf: (attachment: T) => string,
): T[] {
    if (pattern === undefined) return [...attachments];
    const matches = compileNamePattern(pattern);
    const selected = attachments.filter(attachment => matches(nameOf(attachment)));
    if (selected.length === 0 && attachments.length > 0) {
        throw new Error(
            [
                `No attachment matches --name '${pattern}'. The attachments are:`,
                ...attachments.map(attachment => `  ${printable(nameOf(attachment))}`),
            ].join('\n'),
        );
    }
    return selected;
}

/**
 * The human report of a download (design D9). `stdout` is one header line,
 * `Downloaded <n> attachment(s) from <source> to <folder>` (without `to …` when
 * no folder was used), then a line per file: ID, size, and the absolute path
 * last, so a path with spaces stays intact; a skipped file is marked
 * `(already present)`. `stderr` holds a line per failed file, with its reason.
 */
export function formatDownloadReport(
    summary: DownloadSummary,
    source: string | undefined,
): { stdout: string; stderr: string[] } {
    const downloaded = summary.files.filter(file => file.status === 'downloaded').length;
    const from = source === undefined ? '' : ` from ${source}`;
    const to = summary.directory === null ? '' : ` to ${summary.directory}`;
    const lines = [`Downloaded ${downloaded} attachment(s)${from}${to}`];
    const failures: string[] = [];
    for (const file of summary.files) {
        if (file.status === 'failed') {
            failures.push(
                `Failed to download ${file.id} (${printable(file.filename)}): ${file.error}`,
            );
        } else {
            const marker = file.status === 'skipped' ? '(already present)  ' : '';
            lines.push(`${file.id}  ${formatBytes(file.size)}  ${marker}${file.path}`);
        }
    }
    return { stdout: lines.join('\n'), stderr: failures };
}

/** An untrusted name for display on one line: control characters show as `_`. */
function printable(name: string): string {
    let out = '';
    for (const char of name) out += isControlCharacter(char) ? '_' : char;
    return out;
}

/**
 * Turns an attachment's metadata name into one safe path component (design D4):
 *
 * 1. normalized to Unicode NFC;
 * 2. `/`, `\`, NUL and the other control characters (U+0001–U+001F, U+007F)
 *    replaced with `_`;
 * 3. `attachment-<id>` when the result is empty, `.` or `..`;
 * 4. over 255 UTF-8 bytes, shortened in its stem, keeping an extension of at
 *    most 16 bytes, and never splitting a character.
 *
 * Leading dots are kept: one component inside af's own folder cannot escape
 * it, and `.env` stays `.env`.
 */
export function sanitizeFilename(name: string, id: string): string {
    let safe = '';
    for (const char of name.normalize('NFC')) {
        safe += isUnsafeCharacter(char) ? '_' : char;
    }
    if (safe === '' || safe === '.' || safe === '..') return `attachment-${id}`;
    return fitName(safe, '');
}

/**
 * The local filename of each attachment, keyed by ID (design D4).
 *
 * Attachments are named in ascending numeric ID order: the Jira ID, or the
 * digits of a Confluence `att…` ID. Two names collide when they are equal after
 * NFC normalization and lowercasing, because the default macOS file system
 * ignores case. The first attachment keeps its name; each later one gets
 * `-<id>` before its extension, and a counter (`-<id>-2`, …) when that is taken
 * too. The same selection always gets the same names.
 */
export function assignLocalNames(
    items: readonly Pick<DownloadItem, 'id' | 'name'>[],
): Map<string, string> {
    const names = new Map<string, string>();
    const taken = new Set<string>();
    for (const item of [...items].sort((a, b) => compareIds(a.id, b.id))) {
        const base = sanitizeFilename(item.name, item.id);
        let name = base;
        for (let attempt = 1; taken.has(collisionKey(name)); attempt++) {
            name = fitName(base, attempt === 1 ? `-${item.id}` : `-${item.id}-${attempt}`);
        }
        taken.add(collisionKey(name));
        names.set(item.id, name);
    }
    return names;
}

/**
 * The matcher for `--name <pattern>` (design D8): `*` matches any run of
 * characters, `?` exactly one, and every other character matches itself. The
 * pattern covers the whole name and ignores case. Pattern and name are both
 * compared in Unicode NFC, so a name stored decomposed matches what was typed.
 */
export function compileNamePattern(pattern: string): (name: string) => boolean {
    let source = '';
    for (const char of pattern.normalize('NFC')) {
        if (char === '*') source += '.*';
        else if (char === '?') source += '.';
        else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    // `s`: a wildcard also matches a line break; `u`: `?` is one code point.
    const regex = new RegExp(`^(?:${source})$`, 'isu');
    return name => regex.test(name.normalize('NFC'));
}

/** A path separator or a control character. */
function isUnsafeCharacter(char: string): boolean {
    return char === '/' || char === '\\' || isControlCharacter(char);
}

/** NUL and the other control characters: code points 0–31 and 127. */
function isControlCharacter(char: string): boolean {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
}

/**
 * `name` with `suffix` inserted before its extension, its stem shortened so
 * the result fits in MAX_NAME_BYTES. The extension is the text from the last
 * dot, when 1 to MAX_EXTENSION_BYTES bytes follow it; a leading dot starts no
 * extension (`.env` has none). Without one, the whole name is the stem.
 */
function fitName(name: string, suffix: string): string {
    const dot = name.lastIndexOf('.');
    const extensionBytes = dot > 0 ? utf8Length(name.slice(dot + 1)) : 0;
    const hasExtension = extensionBytes > 0 && extensionBytes <= MAX_EXTENSION_BYTES;
    const stem = hasExtension ? name.slice(0, dot) : name;
    const tail = suffix + (hasExtension ? name.slice(dot) : '');
    const room = MAX_NAME_BYTES - utf8Length(tail);
    return (utf8Length(stem) <= room ? stem : truncateUtf8(stem, room)) + tail;
}

function utf8Length(text: string): number {
    return Buffer.byteLength(text, 'utf8');
}

/** The longest prefix of `text` that fits in `maxBytes` of UTF-8, cut between characters. */
function truncateUtf8(text: string, maxBytes: number): string {
    let out = '';
    let bytes = 0;
    for (const char of text) {
        bytes += utf8Length(char);
        if (bytes > maxBytes) break;
        out += char;
    }
    return out;
}

function collisionKey(name: string): string {
    return name.normalize('NFC').toLowerCase();
}

/** Orders attachment IDs by their number: the Jira ID, or the digits of a Confluence `att…` ID. */
function compareIds(a: string, b: string): number {
    const x = idNumber(a);
    const y = idNumber(b);
    // Compared as digit strings, so no ID is too long for a number.
    return x.length - y.length || (x < y ? -1 : x > y ? 1 : 0);
}

function idNumber(id: string): string {
    return id.replace(/^att/, '').replace(/^0+(?=\d)/, '');
}

// Downloading

/**
 * Downloads `items` (design D2–D7).
 *
 * - Without `out`, into a fresh folder in the OS temporary directory, named
 *   after `prefix`. With `out`, into that directory, after checking every final
 *   path (see checkExistingFiles); a conflict throws before any download. The
 *   folder is created only once at least one file will be written: nothing is
 *   created when nothing is selected, or when every item carries an `error`.
 * - At most 4 downloads run at once. Each file catches its own error and
 *   resolves to a `failed` result, so one failure never stops the others, and
 *   the files already written stay.
 * - `out: '-'` takes exactly one item and streams its bytes to `stdout` (see
 *   streamToStdout).
 */
export async function downloadAttachments(
    items: readonly DownloadItem[],
    options: DownloadOptions,
): Promise<DownloadSummary> {
    if (options.out === '-') return streamToStdout(items, options);
    if (items.length === 0) return { directory: null, files: [] };

    const sorted = [...items].sort((a, b) => compareIds(a.id, b.id));
    if (sorted.every(item => item.error !== undefined)) {
        // No file will be written, so no folder is created, fresh or `--out`,
        // and no file has a local path.
        return {
            directory: null,
            files: sorted.map(item => failed(item, null, new Error(item.error))),
        };
    }
    const names = assignLocalNames(items);
    const directory =
        options.out === undefined ? await createFreshFolder(options.prefix) : resolve(options.out);
    const planned = sorted.map(item => ({
        item,
        path: join(directory, names.get(item.id) as string),
        // A fresh folder is empty, so every file in it is written.
        isPresent: false,
    }));
    if (options.out !== undefined) {
        await checkOutDirectory(directory);
        const present = await checkExistingFiles(
            directory,
            planned.map(({ item, path }) => ({ path, size: item.size })),
            options.force === true,
        );
        planned.forEach((entry, i) => (entry.isPresent = present[i]));
        const writesFile = planned.some(
            ({ item, isPresent }) => !isPresent && item.error === undefined,
        );
        if (writesFile) await createOutDirectory(directory);
    }

    const files = await mapWithConcurrency(
        planned,
        DOWNLOAD_CONCURRENCY,
        async ({ item, path, isPresent }): Promise<DownloadResult> => {
            if (isPresent) return result(item, path, 'skipped');
            try {
                if (item.error !== undefined) throw new Error(item.error);
                const response = await fetchFollowingRedirects(item.url, options);
                await writeExclusive(response, directory, path, item.size);
                return result(item, path, 'downloaded');
            } catch (err) {
                return failed(item, path, err);
            }
        },
    );
    return { directory, files };
}

/**
 * `--out -` (design D9): the bytes of exactly one attachment go to `stdout`,
 * with no folder, temporary file or rename. Any other number of items throws
 * before a request is sent, giving the count. What has been written cannot be
 * withdrawn, so the byte count is checked at the end, and a mismatch fails the
 * file for the caller to report on standard error.
 */
async function streamToStdout(
    items: readonly DownloadItem[],
    options: DownloadOptions,
): Promise<DownloadSummary> {
    if (items.length !== 1) {
        throw new Error(
            `${items.length} attachments were selected, but --out - takes exactly one. ` +
                'Narrow the selection with --name, or give one attachment ID.',
        );
    }
    const item = items[0];
    try {
        if (item.error !== undefined) throw new Error(item.error);
        const response = await fetchFollowingRedirects(item.url, options);
        const received = await pipeBody(response, options.stdout ?? process.stdout, false);
        if (received !== item.size) {
            throw new Error(`expected ${item.size} bytes, received ${received}`);
        }
        return { directory: null, files: [result(item, '-', 'downloaded')] };
    } catch (err) {
        return { directory: null, files: [failed(item, '-', err)] };
    }
}

function result(item: DownloadItem, path: string | null, status: DownloadStatus): DownloadResult {
    return {
        id: item.id,
        filename: item.name,
        path,
        size: item.size,
        mimeType: item.mimeType,
        status,
    };
}

function failed(item: DownloadItem, path: string | null, err: unknown): DownloadResult {
    return {
        ...result(item, path, 'failed'),
        error: err instanceof Error ? err.message : String(err),
    };
}

/**
 * Fetches `url`, following redirects itself (design D6): `redirect: 'manual'`,
 * at most 5 hops, each `Location` resolved against the current URL. The
 * `Authorization` header goes only to URLs whose origin is `baseOrigin`, the
 * configured site's; a hop to any other origin, such as Atlassian's pre-signed
 * media URLs, is sent without it. Whether `fetch` itself drops credentials on a
 * cross-origin redirect depends on the runtime and its version, so af does not
 * rely on it. A non-2xx response throws `AtlassianHttpError`, with the message
 * parsed as for every other Atlassian error.
 */
export async function fetchFollowingRedirects(
    url: string,
    options: { authorization: string; baseOrigin: string },
): Promise<Response> {
    let current = new URL(url);
    for (let redirects = 0; ; redirects++) {
        const headers: Record<string, string> =
            current.origin === options.baseOrigin ? { Authorization: options.authorization } : {};
        const response = await fetch(current.href, { headers, redirect: 'manual' });
        const location = REDIRECT_STATUSES.has(response.status)
            ? response.headers.get('location')
            : null;
        if (location === null) {
            if (!response.ok) {
                throw new AtlassianHttpError(await errorMessageFrom(response), response.status);
            }
            return response;
        }
        await response.body?.cancel();
        if (redirects === MAX_REDIRECTS) {
            throw new Error(`Too many redirects: gave up after ${MAX_REDIRECTS}`);
        }
        current = new URL(location, current);
    }
}

/**
 * Writes `response`'s body to `path` in `directory` (design D5).
 *
 * 1. The bytes go to `.af-<random>.part` in the same directory, created with
 *    flags `wx` (`O_CREAT | O_EXCL`): that fails on any existing path, a
 *    symbolic link included, so nothing planted in the folder is reused or
 *    followed. They are streamed, never held in memory whole.
 * 2. When the byte count differs from `size`, the file fails with both numbers.
 * 3. Otherwise the temporary file is renamed onto `path`. Within a directory
 *    that is atomic, and it replaces a file or symbolic link at `path` instead
 *    of writing through it.
 *
 * On any error the temporary file is deleted, so `path` holds either the
 * complete, size-checked file or whatever was there before.
 */
async function writeExclusive(
    response: Response,
    directory: string,
    path: string,
    size: number,
): Promise<void> {
    const temporary = join(directory, `.af-${randomBytes(8).toString('hex')}.part`);
    const file = createWriteStream(temporary, { flags: 'wx' });
    try {
        await once(file, 'open');
    } catch (err) {
        // Not created by us, so it is left alone.
        await response.body?.cancel();
        throw err;
    }
    try {
        const received = await pipeBody(response, file, true);
        if (received !== size) throw new Error(`expected ${size} bytes, received ${received}`);
        await rename(temporary, path);
    } catch (err) {
        await rm(temporary, { force: true });
        throw err;
    }
}

/** Streams `response`'s body into `destination` and returns the number of bytes. */
async function pipeBody(response: Response, destination: Writable, end: boolean): Promise<number> {
    let received = 0;
    const counter = new Transform({
        transform(chunk: Uint8Array, _encoding, callback) {
            received += chunk.length;
            callback(null, chunk);
        },
    });
    const body = response.body ? Readable.fromWeb(response.body) : Readable.from([]);
    await pipeline(body, counter, destination, { end });
    return received;
}

/**
 * A new, empty folder in the OS temporary directory, named `<prefix>` and six
 * random characters (design D2). Each run gets its own, so nothing is ever
 * overwritten there.
 */
function createFreshFolder(prefix: string): Promise<string> {
    return mkdtemp(join(tmpdir(), prefix));
}

/**
 * Checks that `--out <dir>` is a directory, or does not exist yet. A symbolic
 * link to a directory is accepted: the user chose the folder, and macOS's own
 * `/tmp` is one.
 */
async function checkOutDirectory(directory: string): Promise<void> {
    let info: Awaited<ReturnType<typeof stat>>;
    try {
        info = await stat(directory);
    } catch (err) {
        if (errorCode(err) === 'ENOENT') return;
        throw err;
    }
    if (!info.isDirectory()) throw new Error(`--out ${directory} is not a directory`);
}

/** Creates `--out <dir>` and any missing parents, as `mkdir -p` does. */
async function createOutDirectory(directory: string): Promise<void> {
    await mkdir(directory, { recursive: true });
}

/**
 * Inspects each final path in `--out <dir>` before anything is downloaded,
 * without following symbolic links (design D3), and returns, per path, whether
 * the file is already there: a regular file of the attachment's size, which is
 * skipped, because an attachment's content never changes. Anything else at a
 * path (a file of another size, a symbolic link, a directory, any other entry)
 * is a conflict. `force` lets every entry be replaced except a directory, which
 * a rename cannot replace. All conflicts are reported in one error, one path
 * per line.
 */
async function checkExistingFiles(
    directory: string,
    files: readonly { path: string; size: number }[],
    force: boolean,
): Promise<boolean[]> {
    const present: boolean[] = [];
    const conflicts: string[] = [];
    for (const { path, size } of files) {
        let info: Awaited<ReturnType<typeof lstat>> | undefined;
        try {
            info = await lstat(path);
        } catch (err) {
            if (errorCode(err) !== 'ENOENT') throw err;
        }
        const isPresent = !force && info?.isFile() === true && info.size === size;
        if (info !== undefined && !isPresent && (info.isDirectory() || !force)) {
            conflicts.push(path);
        }
        present.push(isPresent);
    }
    if (conflicts.length > 0) throw new Error(conflictMessage(directory, conflicts, force));
    return present;
}

function conflictMessage(directory: string, conflicts: readonly string[], force: boolean): string {
    const one = conflicts.length === 1;
    const lines = conflicts.map(path => `  ${path}`);
    if (force) {
        const what = one ? '1 path in' : `${conflicts.length} paths in`;
        const are = one ? 'is a directory' : 'are directories';
        return [
            `${what} ${directory} ${are}, which --force cannot replace, so nothing was downloaded:`,
            ...lines,
        ].join('\n');
    }
    const what = one ? '1 existing path in' : `${conflicts.length} existing paths in`;
    return [
        `${what} ${directory} would be replaced, so nothing was downloaded:`,
        ...lines,
        'Pass --force to replace what is there (a directory is never replaced).',
    ].join('\n');
}

function errorCode(err: unknown): string | undefined {
    return err instanceof Error ? (err as NodeJS.ErrnoException).code : undefined;
}
