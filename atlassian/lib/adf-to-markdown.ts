// cspell:words prosemirror autolinks

// ADF to markdown: the renderer behind adfToText (design D11 and D12).
//
// The output is the canonical markdown that markdownToAdf reads back unchanged:
// GitHub-flavored markdown as marked lexes it with `breaks: true`. Escaping is
// minimal, so `af jira get` stays readable: block markers at the start of
// paragraph lines (among them the `<` of an HTML block, the `[` of a link
// reference definition and a table delimiter row), `|` in table cells, code
// fences sized to their content, `<...>` link destinations, a heading's
// closing-sequence look-alike, link text taken from its URL, and a `*` that
// would pair with an emphasis delimiter. Running text is otherwise left alone,
// a link whose text is its URL is written as an autolink, and a plain
// paragraph that marked reads back as an HTML block is written verbatim.
//
// ADF read from Jira or Confluence is untrusted JSON. A missing or non-array
// `content` counts as empty, nodes the renderer does not know keep their text,
// and it never throws.

import type { AdfDocument } from './adf-types.ts';

type Json = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Reading untrusted ADF

function isRecord(value: unknown): value is Json {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A node's children. A missing or non-array `content` counts as empty, and
 * entries that are not objects are skipped.
 */
function childrenOf(node: Json): Json[] {
    return Array.isArray(node.content) ? node.content.filter(isRecord) : [];
}

function attrsOf(node: Json): Json {
    return isRecord(node.attrs) ? node.attrs : {};
}

/** The value when it is a string that is not empty. */
function nonEmpty(value: unknown): string | undefined {
    return typeof value === 'string' && value !== '' ? value : undefined;
}

// Inline node types, and the block types rendered by a rule of their own.
const INLINE_TYPES = new Set([
    'text',
    'hardBreak',
    'mention',
    'emoji',
    'date',
    'inlineCard',
    'status',
    'placeholder',
    'inlineExtension',
    'mediaInline',
]);
const BLOCK_TYPES = new Set([
    'paragraph',
    'heading',
    'bulletList',
    'orderedList',
    'taskList',
    'codeBlock',
    'blockquote',
    'rule',
    'table',
    'blockCard',
    'embedCard',
]);

/**
 * Whether a node is inline content. A node of a type not listed above counts as
 * inline when it carries text but no children, as `status` does.
 */
function isInline(node: Json): boolean {
    if (typeof node.type === 'string') {
        if (INLINE_TYPES.has(node.type)) return true;
        if (BLOCK_TYPES.has(node.type)) return false;
    }
    if (typeof node.text === 'string') return true;
    return !Array.isArray(node.content) && nonEmpty(attrsOf(node).text) !== undefined;
}

// ---------------------------------------------------------------------------
// Inline content

type MarkType = 'strong' | 'em' | 'strike' | 'link';

interface Mark {
    type: MarkType;
    /** Identity: the type, and for a link its destination and title. */
    key: string;
    href: string;
    title?: string;
}

/** Text with one set of marks. */
interface TextChunk {
    text: string;
    code: boolean;
    marks: Mark[];
    keys: Set<string>;
    /** For each mark, the index of the last chunk of the uninterrupted stretch that carries it. */
    ends: Map<string, number>;
    /** The URL of an inline card written bare, which reads back as a link only inline. */
    card?: boolean;
}

/** A text chunk, or `null` for a hard break. */
type Chunk = TextChunk | null;

const EMPHASIS_DELIMITERS = { strong: '**', em: '*', strike: '~~' } as const;

function isEmphasis(mark: Mark): boolean {
    return mark.type !== 'link';
}

/**
 * The marks markdown can write, each type once (design D9), and whether the
 * text is code. Marks without a markdown form (underline, textColor,
 * annotation, ...) are dropped, and so is a link without a destination.
 */
function readMarks(value: unknown): { marks: Mark[]; code: boolean } {
    const marks: Mark[] = [];
    let code = false;
    const seen = new Set<string>();
    for (const mark of Array.isArray(value) ? value : []) {
        if (!isRecord(mark) || typeof mark.type !== 'string' || seen.has(mark.type)) continue;
        const type = mark.type;
        seen.add(type);
        if (type === 'code') {
            code = true;
        } else if (type === 'strong' || type === 'em' || type === 'strike') {
            marks.push({ type, key: type, href: '' });
        } else if (type === 'link') {
            const { href, title } = attrsOf(mark);
            if (typeof href !== 'string') continue;
            const linkTitle = nonEmpty(title);
            const key = JSON.stringify([href, linkTitle ?? '']);
            marks.push({ type, key, href, title: linkTitle });
        }
    }
    return { marks, code };
}

function pushText(chunks: Chunk[], text: string, marks: unknown): void {
    if (text === '') return;
    const read = readMarks(marks);
    // A carriage return ends a line for the parser, so it ends one here too.
    let value = text.replace(/\r\n?/g, '\n');
    // A code span cannot hold a line ending: the parser reads one as a space, and
    // line-start escaping must never put a backslash inside a code span.
    if (read.code) value = value.replace(/\n/g, ' ');
    chunks.push({
        text: value,
        code: read.code,
        marks: read.marks,
        keys: new Set(read.marks.map(mark => mark.key)),
        ends: new Map(),
    });
}

/** Flattens inline nodes into chunks. With `breakAsSpace` a hard break is a space. */
function collectInline(nodes: Json[], breakAsSpace: boolean, chunks: Chunk[] = []): Chunk[] {
    nodes.forEach((node, index) => {
        if (node.type === 'text') {
            if (typeof node.text === 'string') pushText(chunks, node.text, node.marks);
        } else if (node.type === 'hardBreak') {
            if (breakAsSpace) pushText(chunks, ' ', undefined);
            else chunks.push(null);
        } else {
            const text = atomText(node);
            if (text === undefined) {
                collectInline(childrenOf(node), breakAsSpace, chunks);
            } else if (node.type === 'inlineCard' && bareUrlMisreads(text, nodes, index + 1)) {
                // A link to itself, which renderInline writes as `<url>`: written bare,
                // GFM autolinking would read the URL longer or shorter than it is.
                const marks = Array.isArray(node.marks) ? node.marks : [];
                pushText(chunks, text, [...marks, { type: 'link', attrs: { href: text } }]);
            } else {
                pushText(chunks, text, node.marks);
                if (node.type === 'inlineCard' && text !== '') {
                    (chunks.at(-1) as TextChunk).card = true;
                }
            }
        }
    });
    return chunks;
}

/** The characters GFM autolinking gives back from the end of a URL. */
const URL_TRAILING = /^[?!.,:;*_'"~)]*$/;

/**
 * What GFM autolinking keeps of a URL: it gives back trailing punctuation, an
 * unbalanced `)` and an entity-like `&name;`, and stops at an unbalanced `(`
 * (marked's `_backpedal`, applied until nothing changes).
 */
const URL_BACKPEDAL = /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/;

/**
 * Whether a bare URL, written right before `nodes[from]`, would read back as an
 * autolink that is not the URL: one that GFM cuts short (see URL_BACKPEDAL), or
 * one that takes in some of the content after it, since GFM extends it over
 * everything up to whitespace or `<` before giving back trailing punctuation.
 * Only a URL that `<url>` can hold counts.
 */
function bareUrlMisreads(url: string, nodes: Json[], from: number): boolean {
    if (!/^(?:https?|ftp):\/\/[a-z0-9-]/i.test(url) || !isAutolinkUrl(url)) return false;
    let kept = url;
    for (let previous = ''; previous !== kept;) {
        previous = kept;
        kept = URL_BACKPEDAL.exec(kept)?.[0] ?? '';
    }
    if (kept !== url) return true;
    // A `)` closes a `(` in the URL instead of trailing it.
    const trailing = url.includes('(') ? /^[?!.,:;*_'"~]*$/ : URL_TRAILING;
    return runsOver(nodes, from, trailing) ?? false;
}

/**
 * For bareUrlMisreads: whether the URL takes in some of `nodes` from `from` on, or
 * undefined when they write nothing.
 */
function runsOver(nodes: Json[], from: number, trailing: RegExp): boolean | undefined {
    for (let k = from; k < nodes.length; k++) {
        const node = nodes[k];
        if (node.type === 'hardBreak') return false;
        let text: string | undefined;
        if (node.type === 'text') text = typeof node.text === 'string' ? node.text : '';
        else text = atomText(node);
        if (text === undefined) {
            const inner = runsOver(childrenOf(node), 0, trailing);
            if (inner !== undefined) return inner;
            continue;
        }
        if (text === '') continue;
        const { marks, code } = readMarks(node.marks);
        // A code span or a delimiter comes first, unless emphasis moves whitespace out before it.
        if (code || marks.length > 0) {
            return code || !marks.every(isEmphasis) || !isFlankingSpace(text, 0);
        }
        let end = 0;
        while (end < text.length && text[end] !== '<' && !isFlankingSpace(text, end)) end++;
        if (!trailing.test(text.slice(0, end))) return true;
        if (end < text.length) return false;
    }
    return undefined;
}

/**
 * The text an inline node other than `text` stands for (design D11), or
 * undefined when its children are rendered instead.
 */
function atomText(node: Json): string | undefined {
    const attrs = attrsOf(node);
    switch (node.type) {
        case 'mention': {
            const text = nonEmpty(attrs.text);
            if (text !== undefined) return text.startsWith('@') ? text : `@${text}`;
            const id = nonEmpty(attrs.id);
            return id === undefined ? '' : `@${id}`;
        }
        case 'emoji':
            return nonEmpty(attrs.text) ?? nonEmpty(attrs.shortName) ?? '';
        case 'date':
            return formatDate(attrs.timestamp);
        case 'inlineCard':
        case 'blockCard':
        case 'embedCard':
            return cardUrl(node);
        default:
            return nonEmpty(attrs.text);
    }
}

/** A `date` node's timestamp (milliseconds) as a UTC `YYYY-MM-DD` date. */
function formatDate(timestamp: unknown): string {
    const milliseconds =
        typeof timestamp === 'number'
            ? timestamp
            : typeof timestamp === 'string' && timestamp.trim() !== ''
              ? Number(timestamp)
              : Number.NaN;
    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) return typeof timestamp === 'string' ? timestamp : '';
    const pad = (value: number, width: number): string => String(value).padStart(width, '0');
    const year = date.getUTCFullYear();
    const yearText = year >= 0 && year <= 9999 ? pad(year, 4) : String(year);
    return `${yearText}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

function cardUrl(node: Json): string {
    const attrs = attrsOf(node);
    const data = attrs.data;
    return nonEmpty(attrs.url) ?? (isRecord(data) ? nonEmpty(data.url) : undefined) ?? '';
}

/** The visible title of an `expand` / `nestedExpand`, when it has one. */
function expandTitle(node: Json): string | undefined {
    if (node.type !== 'expand' && node.type !== 'nestedExpand') return undefined;
    const title = nonEmpty(attrsOf(node).title);
    return title !== undefined && title.trim() !== '' ? title : undefined;
}

/**
 * Readies chunks for rendering:
 * - strong, em and strike stay open around a code span inside them, because
 *   ADF strips those marks from the code text itself (design D11). This also
 *   holds for emphasis that ends or starts at a code span with whitespace at
 *   that edge, as in `**Install with `npm ci`**`: closed at the code span, the
 *   whitespace would move outside the delimiters and lose the mark;
 * - chunks with equal marks merge, so two code spans never touch;
 * - each mark records where its stretch of chunks ends.
 */
function prepareChunks(chunks: Chunk[]): Chunk[] {
    for (let i = 0; i < chunks.length; i++) {
        if (!chunks[i]?.code) continue;
        let last = i;
        while (chunks[last + 1]?.code) last++;
        const before = chunks[i - 1];
        const after = chunks[last + 1];
        const kept: Mark[] = [];
        if (before) {
            // Emphasis on both sides stays open across the code span; emphasis that
            // ends at it, with whitespace at its edge, closes after it.
            const spaceAtEdge = isFlankingSpace(before.text, before.text.length - 1);
            for (const mark of before.marks) {
                if (!isEmphasis(mark)) continue;
                if (after?.keys.has(mark.key) || (spaceAtEdge && delimiterFits(after, 0))) {
                    kept.push(mark);
                }
            }
        }
        if (after) {
            // Emphasis that starts at the code span, with whitespace at its edge, opens before it.
            const spaceAtEdge = isFlankingSpace(after.text, 0);
            for (const mark of after.marks) {
                if (!isEmphasis(mark) || before?.keys.has(mark.key)) continue;
                if (spaceAtEdge && delimiterFits(before, -1)) kept.push(mark);
            }
        }
        for (let k = i; k <= last; k++) {
            const chunk = chunks[k] as TextChunk;
            for (const mark of kept) {
                if (chunk.keys.has(mark.key)) continue;
                chunk.marks.push(mark);
                chunk.keys.add(mark.key);
            }
        }
        i = last;
    }

    const merged: Chunk[] = [];
    for (const chunk of chunks) {
        const previous = merged.at(-1);
        if (
            chunk &&
            previous &&
            previous.code === chunk.code &&
            sameKeys(previous.keys, chunk.keys)
        ) {
            previous.text += chunk.text;
        } else {
            merged.push(chunk);
        }
    }

    for (let i = merged.length - 1; i >= 0; i--) {
        const chunk = merged[i];
        if (!chunk) continue;
        const next = merged[i + 1];
        for (const mark of chunk.marks) {
            const end = next?.keys.has(mark.key) ? next.ends.get(mark.key) : undefined;
            chunk.ends.set(mark.key, end ?? i);
        }
    }
    return merged;
}

function sameKeys(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const key of a) if (!b.has(key)) return false;
    return true;
}

/**
 * Whitespace next to which an emphasis delimiter cannot open or close. U+2028
 * and U+2029 do not count: the mapper hides them from marked (design D4).
 */
function isFlankingSpace(text: string, index: number): boolean {
    const code = text.charCodeAt(index);
    return code !== 0x2028 && code !== 0x2029 && /\s/.test(text[index]);
}

/**
 * Text without the whitespace around it, as marked trims a code block's info
 * string and a table cell. U+2028 and U+2029 stay: the mapper hides them from
 * marked (design D4), so they are text there.
 */
function trimFlankingSpace(text: string): string {
    let start = 0;
    let end = text.length;
    while (start < end && isFlankingSpace(text, start)) start++;
    while (end > start && isFlankingSpace(text, end - 1)) end--;
    return text.slice(start, end);
}

/**
 * Whether an emphasis delimiter written between a code span and this chunk
 * still opens or closes. With a backtick on one side, the other side must be a
 * hard break, the edge of the paragraph, whitespace or punctuation; marked's
 * GFM emphasis does not count `~` as punctuation. `edge` is 0 for the chunk's
 * first character and -1 for its last.
 */
function delimiterFits(chunk: Chunk | undefined, edge: 0 | -1): boolean {
    if (!chunk) return true;
    const { text } = chunk;
    if (isFlankingSpace(text, edge === 0 ? 0 : text.length - 1)) return true;
    const char = edge === 0 ? firstCharacter(text) : lastCharacter(text);
    return char !== '~' && PUNCTUATION.test(char);
}

/** The first character of text, a whole surrogate pair included; '' for no text. */
function firstCharacter(text: string): string {
    return text === '' ? '' : String.fromCodePoint(text.codePointAt(0) as number);
}

/** The last character of text, a whole surrogate pair included. */
function lastCharacter(text: string): string {
    const low = text.charCodeAt(text.length - 1);
    return text.slice(low >= 0xdc00 && low <= 0xdfff && text.length > 1 ? -2 : -1);
}

// Whether an emphasis delimiter run opens or closes, as marked's GFM emphasis
// decides from the characters around it ('' is the edge of a line). Its
// punctuation is Unicode punctuation and symbols; whitespace never includes
// U+2028 and U+2029, which the mapper hides from marked.
const PUNCTUATION = /^[\p{P}\p{S}]$/u;
const ALPHANUMERIC = /^[\p{L}\p{N}]$/u;

/**
 * A delimiter run followed by punctuation opens only at the edge, or after
 * whitespace or punctuation other than `*` and `_`.
 */
function opensBeforePunctuation(before: string): boolean {
    return (
        before === '' ||
        isFlankingSpace(before, 0) ||
        (PUNCTUATION.test(before) && before !== '*' && before !== '_')
    );
}

/**
 * A `*` or `~~` run after punctuation closes only at the edge, or before
 * whitespace or punctuation other than `~`; `*` and `_` are left out too, as
 * delimiters a run would merge or tangle with.
 */
function closesAfterPunctuation(after: string): boolean {
    return (
        after === '' ||
        isFlankingSpace(after, 0) ||
        (PUNCTUATION.test(after) && after !== '~' && after !== '*' && after !== '_')
    );
}

/**
 * Whether `_` or `__` opens between `before` and `first`, the first character
 * inside it: never between two letters or digits, and before punctuation only
 * where any run opens there.
 */
function underscoreOpens(before: string, first: string): boolean {
    if (before === '_') return false;
    return PUNCTUATION.test(first) ? opensBeforePunctuation(before) : !ALPHANUMERIC.test(before);
}

/** Whether `_` or `__` closes before `after`: at the edge, or before whitespace or punctuation. */
function underscoreCloses(after: string): boolean {
    return after === '' || isFlankingSpace(after, 0) || (PUNCTUATION.test(after) && after !== '_');
}

/** A mark that renderInline has opened and not closed yet. */
interface OpenMark {
    key: string;
    /** What closes it: its emphasis delimiter, `](url)` or `>`. */
    close: string;
    /** The index of the last chunk of its stretch. */
    end: number;
    /** A link written as `<url>`, whose text is literal. */
    autolink?: boolean;
    /** Emphasis written with `*` whose text holds a `*`: those get a backslash. */
    escapeStars?: boolean;
}

/**
 * Writes chunks as markdown inline content (design D11). A mark spans
 * consecutive chunks, and marks that are already open stay open, as in
 * prosemirror-markdown. Of the marks a chunk opens, the one whose stretch runs
 * longest opens first, so that it encloses the others; among stretches that
 * end together a link opens last, as prosemirror-markdown ranks it, unless the
 * emphasis outside it could then not open or close. Whitespace at the edge of
 * an emphasis stretch moves outside its delimiters. A hard break closes every
 * mark, since it never carries one. Without `autolinks`, every link is written
 * as `[text](url)`. In a table `cell`, text doubles the backslashes before a
 * `|` (see cellText).
 */
function renderInline(input: Chunk[], { autolinks = true, cell = false } = {}): string {
    const chunks = prepareChunks(input);
    // Hard breaks after the last text end no line: the paragraph drops them.
    let lastText = chunks.length - 1;
    while (lastText >= 0 && chunks[lastText] === null) lastText--;
    const out: string[] = [];
    const open: OpenMark[] = [];
    // The em stretches, by their last chunk, that the strong stretch around them
    // writes with `_` (see emphasisDelimiter).
    const underscoreEm = new Set<number>();
    // Whether the output ends with text rather than a delimiter.
    let textEnd = false;
    // Whitespace moved off the end of an emphasis stretch: it goes out after the
    // delimiters that close there.
    let pending = '';

    const write = (piece: string, isText: boolean): void => {
        if (piece === '') return;
        out.push(piece);
        textEnd = isText;
    };
    /** The last character written, or '' at the start of a line. */
    const before = (): string => {
        const last = out.at(-1);
        return last === undefined || last.endsWith('\n') ? '' : lastCharacter(last);
    };
    /**
     * Gives backslashes to the run of `char` that ends the text written last, or
     * only to its last character; one that a backslash escapes already has one.
     */
    const escapeEnd = (char: string, wholeRun: boolean): void => {
        const last = out.length - 1;
        if (!textEnd || last < 0 || !out[last].endsWith(char)) return;
        const piece = out[last];
        let start = piece.length - 1;
        while (wholeRun && start > 0 && piece[start - 1] === char) start--;
        let run = 0;
        while (piece[start - 1 - run] === '\\') run++;
        const from = run % 2 === 0 ? start : start + 1;
        out[last] = piece.slice(0, from) + piece.slice(from).replace(/./g, '\\$&');
    };
    /** Gives a backslash that ends the text written last, unpaired, a partner. */
    const pairTrailingBackslash = (): void => {
        const last = out.length - 1;
        if (!textEnd || last < 0) return;
        let run = 0;
        while (out[last][out[last].length - 1 - run] === '\\') run++;
        if (run % 2 === 1) out[last] += '\\';
    };
    const writeDelimiter = (delimiter: string): void => {
        if (/^[*_~]/.test(delimiter)) {
            // A literal `*`, `_` or `~` would join the run of a delimiter of the
            // same character. Before another one, a literal `*` or `_` keeps it from
            // opening before punctuation; escaped, it counts as the edge of the text.
            // Not after an e-mail address or a URL, where a backslash would change
            // what GFM autolinking reads (autolinkTail); in link text none forms.
            escapeEnd(delimiter[0], true);
            const inLinkText = open.some(mark => !mark.autolink && mark.close.startsWith(']'));
            const tail = textEnd && !inLinkText ? autolinkTail(out.at(-1) ?? '') : undefined;
            if (tail !== 'url') escapeEnd('*', true);
            if (tail === undefined) escapeEnd('_', true);
        }
        // A backslash that ends the text unpaired would escape the delimiter: it
        // gets a partner.
        pairTrailingBackslash();
        write(delimiter, false);
    };
    const closeTo = (depth: number): void => {
        while (open.length > depth) {
            const mark = open.pop()!;
            // The text of `<url>` is literal, so a backslash before its `>` is the
            // URL's own and gets no partner.
            if (mark.autolink) write(mark.close, false);
            else writeDelimiter(mark.close);
        }
    };

    /** Whether chunks `from` to `to` hold `char` in text that marked reads as markup. */
    const stretchHas = (from: number, to: number, char: string): boolean => {
        for (let k = from; k <= to; k++) {
            const chunk = chunks[k];
            if (!chunk || chunk.code || hasUrlText(chunk)) continue;
            if (chunk.text.includes(char)) return true;
        }
        return false;
    };
    // The first chunk with a `_` in such text, or -1: one before the end of an
    // emphasis stretch could pair with `_` delimiters.
    const firstUnderscore = chunks.findIndex((_, k) => stretchHas(k, k, '_'));
    /**
     * What comes right after a delimiter that closes after chunk `end`, inside
     * the marks `outer` (outermost first): the character, as far as the chunks
     * tell ('' at the edge of a line), and whether it is text.
     */
    const after = (end: number, outer: readonly OpenMark[]): { char: string; text: boolean } => {
        const last = chunks[end] as TextChunk;
        // Whitespace at the end of an emphasis stretch moves outside the delimiters.
        if (!last.code && isFlankingSpace(last.text, last.text.length - 1)) {
            return { char: ' ', text: true };
        }
        // A mark outside that ends there too closes next.
        if (outer.some(mark => mark.end <= end)) {
            return { char: outer[outer.length - 1].close[0], text: false };
        }
        const next = chunks[end + 1];
        if (!next) return { char: '', text: false };
        if (next.code) return { char: '`', text: false };
        // A mark that the next chunk opens writes its delimiter first: `[` for a
        // link, and for emphasis a run that this one could join.
        const opens = next.marks.filter(mark => !outer.some(o => o.key === mark.key));
        if (opens.length > 0) {
            return { char: opens.every(mark => mark.type === 'link') ? '[' : '*', text: false };
        }
        return { char: firstCharacter(next.text), text: true };
    };
    /**
     * What comes right before the delimiters that open on chunk `k`, as far as
     * the chunks tell.
     */
    const charBefore = (k: number): string => {
        const chunk = chunks[k] as TextChunk;
        if (!chunk.code && isFlankingSpace(chunk.text, 0)) return ' ';
        const previous = chunks[k - 1];
        if (!previous) return '';
        if (previous.code) return '`';
        // A mark that ends there writes its delimiter last.
        if (previous.marks.some(mark => !chunk.keys.has(mark.key))) return '*';
        return lastCharacter(previous.text);
    };

    /**
     * The delimiter of an em or strong stretch that opens on chunk `i`, whose
     * text there is `text`, and ends with chunk `end`, where `inner` open right
     * inside it; and whether each `*` in its text gets a backslash. `*` and `**`,
     * or `_` and `__` where two runs would merge into one (design D15).
     */
    const emphasisDelimiter = (
        i: number,
        text: string,
        mark: Mark,
        end: number,
        inner: readonly Mark[],
    ): { delimiter: string; escapeStars: boolean } => {
        const chunk = chunks[i] as TextChunk;
        const strong = mark.type === 'strong';
        if (!strong && underscoreEm.has(end)) return { delimiter: '_', escapeStars: false };
        const star = strong ? '**' : '*';
        const previous = before();
        const next = after(end, open);
        const stars = stretchHas(i, end, '*');
        // A `_` in the text before the stretch ends, which `_` delimiters could pair with.
        const underscores = firstUnderscore >= 0 && firstUnderscore <= end;

        // `***a* b *c***`, strong that starts and ends with separate em stretches,
        // reads back as one em+strong span whose text holds the inner `*`: the em
        // delimiters become `_` (`**_a_ b _c_**`), or else the strong ones `__`
        // (`__*a* b *c*__`). Both need room to open and close outside, where a
        // letter or digit leaves none: then neither form reads back, and `*` stays.
        const em = inner[0];
        const firstEnd = em?.type === 'em' ? (chunk.ends.get(em.key) ?? i) : end;
        // The first character inside the first em stretch, after its delimiter.
        const firstInEm = inner.length > 1 ? '*' : chunk.code ? '`' : firstCharacter(text);
        if (
            strong &&
            em?.type === 'em' &&
            firstEnd < end &&
            chunks[end]?.ends.get(em.key) === end &&
            !underscores &&
            opensBeforePunctuation(previous) &&
            !PUNCTUATION.test(firstInEm)
        ) {
            let start = end;
            while (chunks[start - 1]?.keys.has(em.key)) start--;
            const startChunk = chunks[start] as TextChunk;
            let space = 0;
            while (!startChunk.code && isFlankingSpace(startChunk.text, space)) space++;
            const second = startChunk.code ? '`' : firstCharacter(startChunk.text.slice(space));
            const outer = [...open, { key: mark.key, close: star, end }];
            if (
                closesAfterPunctuation(next.char) &&
                underscoreCloses(after(firstEnd, outer).char) &&
                underscoreOpens(charBefore(start), second)
            ) {
                underscoreEm.add(firstEnd).add(end);
                return { delimiter: '**', escapeStars: stars };
            }
            if (
                underscoreCloses(next.char) &&
                (!PUNCTUATION.test(second) || opensBeforePunctuation(charBefore(start)))
            ) {
                return { delimiter: '__', escapeStars: stars };
            }
        }

        // After punctuation a `*` run cannot close before `~`, which marked's GFM
        // emphasis does not count as punctuation, nor before the run of another
        // delimiter, which it would merge with; a `_` run can. Not beside the `*`
        // run of a stretch around this one, which the `_` run would keep from
        // opening or closing (see below).
        const lastChunk = chunks[end] as TextChunk;
        const innerCloses = lastChunk.marks.some(
            other =>
                other.key !== mark.key &&
                !open.some(o => o.key === other.key) &&
                !chunks[end + 1]?.keys.has(other.key),
        );
        const last = lastChunk.code || innerCloses ? '`' : lastCharacter(lastChunk.text);
        const first = inner.length > 0 ? '*' : chunk.code ? '`' : firstCharacter(text);
        // Whether em or strong other than this stretch's own opens inside it.
        function nestedEmphasis(from: number, to: number): boolean {
            for (let k = from; k <= to; k++) {
                for (const other of chunks[k]?.marks ?? []) {
                    if (
                        isEmphasis(other) &&
                        other.type !== 'strike' &&
                        other.key !== mark.key &&
                        !open.some(o => o.key === other.key)
                    ) {
                        return true;
                    }
                }
            }
            return false;
        }
        if (
            PUNCTUATION.test(last) &&
            // A `~`, or the delimiter of a stretch that opens there; a literal `*`
            // there gets a backslash beside a `*` run instead (chunkText).
            (next.char === '~' || (next.char === '*' && !next.text)) &&
            !underscores &&
            !nestedEmphasis(i, end) &&
            !(!strong && stretchHas(i, end, '**')) &&
            underscoreOpens(previous, first) &&
            // No stretch around it written with `*`, whose run a `_` run beside it
            // would keep from opening or closing, and no e-mail address that GFM
            // autolinking would extend over the `_` run.
            !open.some(o => o.close.startsWith('*')) &&
            !stretchHas(i, end, '@')
        ) {
            return { delimiter: strong ? '__' : '_', escapeStars: stars };
        }

        // A `*` in the text would pair with `*` delimiters (`*a *b*`), so it gets a
        // backslash (`*a \*b*`). Writing such a stretch with `_` instead read
        // better, but beside the `*` run of a stretch around it, a `_` run kept
        // that one from opening or closing next to a letter. A `*` right outside
        // the stretch (`*a**3`) gets a backslash from writeDelimiter or chunkText.
        return { delimiter: star, escapeStars: stars };
    };

    /** A chunk's text as written, with the backslashes it needs (design D12). */
    const chunkText = (chunk: TextChunk, text: string): string => {
        const link = chunk.marks.find(mark => mark.type === 'link');
        // The text of `<url>` is literal.
        if (link !== undefined && open.find(mark => mark.key === link.key)?.autolink) return text;
        let written: string;
        if (link !== undefined && isUrlText(chunk.text, link.href)) {
            // Link text made from its URL holds what marked would read as markup,
            // such as the `_` of `www.x.com/__init__.py` or a `]`: escaped, it reads back.
            written = text.replace(/[\\`*_~[\]<!&(]/g, '\\$&');
        } else {
            written = open.some(mark => mark.escapeStars) ? escapeLiteralStars(text) : text;
            if (cell) written = written.replace(/\\+(?=\|)/g, '$&$&');
        }
        // A literal `*`, `_` or `~` right after a delimiter of the same character
        // would join its run: the run of them that starts the text gets backslashes.
        const previous = before();
        if (!textEnd && (previous === '*' || previous === '_' || previous === '~')) {
            let end = 0;
            while (written[end] === previous) end++;
            written = written.slice(0, end).replace(/./g, '\\$&') + written.slice(end);
        }
        return written;
    };

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk === null) {
            closeTo(0);
            write(pending, true);
            // A backslash that ends the line unpaired would make the line ending a hard
            // break of its own and be lost: it gets a partner. Not at the end of a bare
            // URL, which GFM autolinking reads with its backslashes, nor where no text
            // follows, since the paragraph then ends there.
            if (i < lastText && (!textEnd || !endsInBareUrl(out.at(-1) ?? ''))) {
                pairTrailingBackslash();
            }
            write('\n', true);
            pending = '';
            continue;
        }

        let keep = 0;
        while (keep < open.length && chunk.keys.has(open[keep].key)) keep++;
        const kept = new Set(open.slice(0, keep).map(mark => mark.key));
        const opening = chunk.marks.filter(mark => !kept.has(mark.key));

        let text = chunk.text;
        let leading = pending;
        pending = '';
        if (!chunk.code) {
            if (opening.some(isEmphasis)) {
                let end = 0;
                while (end < text.length && isFlankingSpace(text, end)) end++;
                leading += text.slice(0, end);
                text = text.slice(end);
            }
            const next = chunks[i + 1];
            if (chunk.marks.some(mark => isEmphasis(mark) && !next?.keys.has(mark.key))) {
                let start = text.length;
                while (start > 0 && isFlankingSpace(text, start - 1)) start--;
                pending = text.slice(start);
                text = text.slice(0, start);
            }
        }
        if (text === '') {
            // Only whitespace: it goes out with the next chunk, outside whatever closes there.
            pending = leading + pending;
            continue;
        }

        closeTo(keep);
        write(leading, true);
        // Emphasis that opens and closes together with a link goes outside it,
        // unless text that is no whitespace or punctuation, such as a letter in CJK
        // prose, touches the delimiters there: after `a**[` or before `)**c` they can
        // neither open nor close, so the emphasis goes inside the link text,
        // `a[**b**](url)c`. Only where no other mark opens or closes with them,
        // whose delimiters would then touch the `[` or `)` instead.
        const link = opening.find(mark => mark.type === 'link');
        const linkEnd = link === undefined ? i : (chunk.ends.get(link.key) ?? i);
        let linkOutside = false;
        if (
            link !== undefined &&
            opening.some(isEmphasis) &&
            opening.every(mark => chunk.ends.get(mark.key) === linkEnd) &&
            open.every(mark => mark.end > linkEnd)
        ) {
            // A literal `*` or `_` before the delimiters gets a backslash (see writeDelimiter).
            const previous = before();
            const next = after(linkEnd, open);
            linkOutside =
                (textEnd &&
                    !opensBeforePunctuation(previous) &&
                    previous !== '*' &&
                    previous !== '_') ||
                (next.text && !closesAfterPunctuation(next.char));
        }
        // Among em and strong that end together, em opens first, as the mapper
        // orders them, so the output does not depend on the order of the ADF marks.
        opening.sort(
            (a, b) =>
                (chunk.ends.get(b.key) ?? i) - (chunk.ends.get(a.key) ?? i) ||
                (Number(a.type === 'link') - Number(b.type === 'link')) * (linkOutside ? -1 : 1) ||
                Number(a.type === 'strong' && b.type === 'em') -
                    Number(a.type === 'em' && b.type === 'strong'),
        );
        opening.forEach((mark, index) => {
            const end = chunk.ends.get(mark.key) ?? i;
            if (mark.type === 'link') {
                // A link whose text is its own URL, opened innermost on this chunk alone,
                // is written as an autolink: `<url>` is literal, where link text would be
                // read as markdown, and it reads better than `[url](url)`. In a table cell
                // an odd run of backslashes before a `|` rules it out (see cellText).
                const autolink =
                    autolinks &&
                    index === opening.length - 1 &&
                    mark.title === undefined &&
                    !chunk.code &&
                    text === mark.href &&
                    end === i &&
                    !chunks[i - 1]?.keys.has(mark.key) &&
                    isAutolinkUrl(mark.href) &&
                    !(cell && ODD_BACKSLASHES_BEFORE_PIPE.test(mark.href));
                if (autolink) {
                    writeDelimiter('<');
                    open.push({ key: mark.key, close: '>', end, autolink: true });
                } else {
                    // `![` would start an image.
                    escapeEnd('!', false);
                    writeDelimiter('[');
                    open.push({ key: mark.key, close: closingDelimiter(mark), end });
                }
                return;
            }
            const { delimiter, escapeStars } =
                mark.type === 'strike'
                    ? { delimiter: EMPHASIS_DELIMITERS.strike, escapeStars: false }
                    : emphasisDelimiter(i, text, mark, end, opening.slice(index + 1));
            writeDelimiter(delimiter);
            open.push({ key: mark.key, close: delimiter, end, escapeStars });
        });
        if (chunk.code) write(codeSpan(text), false);
        else write(chunkText(chunk, text), true);
    }
    closeTo(0);
    write(pending, true);
    return out.join('');
}

/** A `|` after an odd run of backslashes. */
const ODD_BACKSLASHES_BEFORE_PIPE = /(?:^|[^\\])(?:\\\\)*\\\|/;

/** The text after the last whitespace or `<`: the word a GFM autolink is read from. */
function lastWord(text: string): string {
    let start = text.length;
    while (start > 0 && !/[\s<]/.test(text[start - 1])) start--;
    return text.slice(start);
}

/**
 * What GFM autolinks at the end of text that ends in `*` or `_` characters: a
 * URL, which would take a backslash before them in, or an e-mail address, which
 * it autolinks only while the `_` after it stays unescaped.
 */
function autolinkTail(text: string): 'url' | 'email' | undefined {
    const word = lastWord(text);
    if (!/[*_]$/.test(word)) return undefined;
    if (/(?:www\.|(?:https?|ftp):\/\/)[a-z0-9-]/i.test(word)) return 'url';
    const at = word.lastIndexOf('@');
    const address =
        at > 0 &&
        /[A-Za-z0-9._+-]/.test(word[at - 1]) &&
        /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]*[A-Za-z0-9])+_+$/.test(word.slice(at + 1));
    return address ? 'email' : undefined;
}

/** Whether text ends in a URL that GFM autolinks, so that its backslashes are the URL's. */
function endsInBareUrl(text: string): boolean {
    const word = lastWord(text);
    const url = /(?:(?:https?|ftp):\/\/|www\.)[a-z0-9-]/i.exec(word);
    // An e-mail address right before the scheme is autolinked instead.
    return url !== null && !word.slice(0, url.index).includes('@');
}

/**
 * Link text made from its URL: the URL itself, or the `www.` host or e-mail
 * address that GFM autolinking read as one (design D9).
 */
function isUrlText(text: string, href: string): boolean {
    return href === text || href === `http://${text}` || href === `mailto:${text}`;
}

/** Whether a chunk is the text of a link made from its URL (see isUrlText). */
function hasUrlText(chunk: TextChunk): boolean {
    return chunk.marks.some(mark => mark.type === 'link' && isUrlText(chunk.text, mark.href));
}

/** Gives a backslash to each `*` that has none, so that it pairs with no delimiter. */
function escapeLiteralStars(text: string): string {
    return text.replace(/(\\*)\*/g, (star, run: string) =>
        run.length % 2 === 0 ? `${run}\\*` : star,
    );
}

/**
 * A URL markdown accepts as an autolink: a scheme, then no whitespace, control
 * character, `<` or `>`.
 */
function isAutolinkUrl(url: string): boolean {
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]{1,31}:/.test(url)) return false;
    for (let i = 0; i < url.length; i++) {
        const code = url.charCodeAt(i);
        if (
            code <= 0x20 ||
            code === 0x7f ||
            url[i] === '<' ||
            url[i] === '>' ||
            /\s/.test(url[i])
        ) {
            return false;
        }
    }
    return true;
}

/** What closes a link: `](url "title")`. */
function closingDelimiter(mark: Mark): string {
    // A title cannot hold a line ending here, where each line of a paragraph is
    // escaped and prefixed on its own: it becomes a space.
    const title =
        mark.title === undefined
            ? ''
            : ` "${escapeBackslashes(mark.title.replace(/\r\n?|\n/g, ' ')).replace(/"/g, '\\"')}"`;
    // Before a title, an empty destination is `<>`, or the title would be read
    // as the destination.
    const destination = mark.href === '' && title !== '' ? '<>' : linkDestination(mark.href);
    return `](${destination}${title})`;
}

/**
 * A link destination, bare where markdown allows it and otherwise in `<...>`:
 * for whitespace, a control character, unbalanced parentheses or a leading `<`.
 * A destination cannot hold a line ending, so carriage returns and line feeds
 * are percent-encoded.
 */
function linkDestination(href: string): string {
    const url = href.replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    const escaped = escapeBackslashes(url);
    return needsAngleBrackets(url) ? `<${escaped.replace(/[<>]/g, '\\$&')}>` : escaped;
}

function needsAngleBrackets(href: string): boolean {
    if (href.startsWith('<')) return true;
    let depth = 0;
    for (let i = 0; i < href.length; i++) {
        const code = href.charCodeAt(i);
        if (code <= 0x20 || code === 0x7f || /\s/.test(href[i])) return true;
        if (href[i] === '(') {
            depth++;
        } else if (href[i] === ')') {
            depth--;
            if (depth < 0) return true;
        }
    }
    return depth !== 0;
}

/**
 * Doubles each backslash the parser would read as an escape, one before
 * punctuation or a symbol, or at the end. Used where marked removes such
 * escapes: link destinations and titles, and code block info strings.
 */
function escapeBackslashes(text: string): string {
    return text.replace(/\\(?=[\p{P}\p{S}]|$)/gu, '\\\\');
}

/**
 * A code span whose backtick fence is longer than any backtick run inside it,
 * padded with spaces where the parser would otherwise merge a backtick into the
 * fence or strip a space from each end.
 */
function codeSpan(text: string): string {
    const fence = '`'.repeat(longestRun(text, '`') + 1);
    const padded =
        text.startsWith('`') ||
        text.endsWith('`') ||
        (text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text));
    return padded ? `${fence} ${text} ${fence}` : `${fence}${text}${fence}`;
}

function longestRun(text: string, char: string): number {
    let longest = 0;
    let run = 0;
    for (let i = 0; i < text.length; i++) {
        run = text[i] === char ? run + 1 : 0;
        if (run > longest) longest = run;
    }
    return longest;
}

// ---------------------------------------------------------------------------
// HTML blocks (design D8)
//
// Where a block can start, marked reads a line that opens an HTML block, and
// the lines after it, as literal HTML: up to a blank line (types 6 and 7), or
// up to the line that holds the end marker (types 1 to 5). The mapper keeps
// such a block as a paragraph of its lines, as plain text. So a plain paragraph
// whose first line opens one is written verbatim (see verbatimHtmlParagraph),
// and any other line that would open one gets a backslash before its `<`.

/** The tag names that open an HTML block of type 6. */
const HTML_BLOCK_TAGS =
    'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|' +
    'details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|' +
    'h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|' +
    'ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|' +
    'tr|track|ul';
const HTML_ATTRIBUTE =
    ' +[a-zA-Z:_][\\w.:-]*(?: *= *"[^"\\n]*"| *= *\'[^\'\\n]*\'| *= *[^\\s"\'=<>`]+)?';

// The start conditions of marked's `html` block rule, for a line that a line
// ending follows. As in marked, `<preview>` opens no block of type 7.
const HTML_BLOCK_TYPE_1 = /^ {0,3}<(script|pre|style|textarea)(?:[\s>]|$)/i;
const HTML_BLOCK_TYPE_6 = new RegExp(`^ {0,3}<\\/?(?:${HTML_BLOCK_TAGS})(?: +|\\/?>|$)`, 'i');
const HTML_BLOCK_TYPE_7 = new RegExp(
    `^ {0,3}(?:<(?!script|pre|style|textarea)[a-z][a-z0-9-]*(?:${HTML_ATTRIBUTE})*? *\\/?>` +
        '|<\\/(?!script|pre|style|textarea)[a-z][a-z0-9-]*\\s*>)[ \\t]*$',
    'i',
);

/**
 * The lines that end a paragraph by opening an HTML block: types 1 to 6. marked
 * checks only the start of `<script`, `<pre`, `<style`, `<textarea` and `<!--`
 * here, so `<preview>` ends a paragraph too. This is a superset of its check.
 */
const HTML_INTERRUPTION = new RegExp(
    `^ {0,3}<(?:script|pre|style|textarea|!--|\\?|![a-z]|!\\[CDATA\\[|\\/?(?:${HTML_BLOCK_TAGS})(?:[ \\t]|\\/?>|$))`,
    'i',
);

/** The type (1 to 7) of the HTML block that a line opens where a block can start, or 0. */
function htmlBlockType(line: string): number {
    if (HTML_BLOCK_TYPE_1.test(line)) return 1;
    if (/^ {0,3}<!--/.test(line)) return 2;
    if (/^ {0,3}<\?/.test(line)) return 3;
    if (/^ {0,3}<![a-z]/i.test(line)) return 4;
    if (/^ {0,3}<!\[CDATA\[/i.test(line)) return 5;
    if (HTML_BLOCK_TYPE_6.test(line)) return 6;
    return HTML_BLOCK_TYPE_7.test(line) ? 7 : 0;
}

/** A line with a backslash before the `<` that opens it. */
function escapeHtmlStart(line: string): string {
    return line.replace(/^( {0,3})</, '$1\\<');
}

/**
 * Where the HTML block that the first line opens ends: `closed` with the last
 * line, `open` past it, or undefined when there is no such block or it ends
 * earlier. Types 6 and 7 end at a blank line, which follows the paragraph (see
 * joinsTightly). Types 1 to 5 end with the line that holds their end marker; one
 * without it runs on to the end of its container.
 */
function htmlBlockEnding(lines: readonly string[]): 'closed' | 'open' | undefined {
    const type = htmlBlockType(lines[0]);
    if (type === 0) return undefined;
    if (type >= 6) return lines.some(line => BLANK.test(line)) ? undefined : 'closed';
    const text = lines.join('\n');
    const open = text.indexOf('<');
    let close: number;
    switch (type) {
        case 1: {
            const tag = (HTML_BLOCK_TYPE_1.exec(lines[0]) as RegExpExecArray)[1];
            const from = open + 1 + tag.length;
            const match = new RegExp(`</${tag}>`, 'i').exec(text.slice(from));
            close = match ? from + match.index : -1;
            break;
        }
        case 2:
            // `<!-->` and `<!--->` are whole comments.
            close = /^-?>/.test(text.slice(open + 4)) ? open + 4 : text.indexOf('-->', open + 4);
            break;
        case 3:
            close = text.indexOf('?>', open + 2);
            break;
        case 4:
            close = text.indexOf('>', open + 3);
            break;
        default:
            close = text.indexOf(']]>', open + 9);
    }
    if (close < 0) return 'open';
    return text.includes('\n', close) ? undefined : 'closed';
}

/**
 * A plain-text paragraph whose first line opens an HTML block that takes in all
 * of its lines, written verbatim; otherwise undefined. marked reads it back as
 * that block, whose lines are literal, so a backslash added to escape a line
 * would stay in the text. `open` tells that the block runs on past the lines.
 */
function verbatimHtmlParagraph(chunks: Chunk[]): { text: string; open: boolean } | undefined {
    let text = '';
    for (const chunk of chunks) {
        if (chunk === null) text += '\n';
        else if (chunk.code || chunk.marks.length > 0) return undefined;
        else text += chunk.text;
    }
    const lines = text.split('\n');
    let start = 0;
    let end = lines.length;
    while (start < end && BLANK.test(lines[start])) start++;
    while (end > start && BLANK.test(lines[end - 1])) end--;
    const body = lines.slice(start, end);
    const ending = body.length > 0 ? htmlBlockEnding(body) : undefined;
    return ending === undefined ? undefined : { text: body.join('\n'), open: ending === 'open' };
}

/** A GFM table's delimiter row as marked reads one, spaces only around the cells. */
const TABLE_DELIMITER_ROW = /^ {0,3}((?:\| *)?:?-+:? *(?:\| *:?-+:? *)*(?:\| *)?)$/;

/** A line that ends a GFM table instead of being one of its rows, as marked reads it. */
const TABLE_ROW_STOP = new RegExp(
    [
        ' *$', // a blank line
        ' {0,3}(?:(?:-[\\t ]*){3,}|(?:_[ \\t]*){3,}|(?:\\*[ \\t]*){3,})$', // a thematic break
        ' {0,3}#{1,6}(?:\\s|$)', // an ATX heading
        ' {0,3}>', // a quote
        '(?: {4}| {0,3}\\t)[^\\n]', // indented code
        ' {0,3}(?:`{3,}(?=[^`\\n]*$)|~~~)', // a fence
        ' {0,3}(?:[*+-]|1[.)])[ \\t]', // a list item
        `<\\/?(?:${HTML_BLOCK_TAGS})(?: +|$|\\/?>)|<(?:script|pre|style|textarea|!--)`, // HTML
    ]
        .map(alternative => `^(?:${alternative})`)
        .join('|'),
);

/** The cells of a table row, counted as marked's splitCells counts them. */
function tableCellCount(row: string): number {
    const cells = row
        .replace(/\|/g, (_pipe: string, offset: number, text: string) => {
            let escaped = false;
            for (let k = offset - 1; k >= 0 && text[k] === '\\'; k--) escaped = !escaped;
            return escaped ? '|' : ' |';
        })
        .split(/ \|/);
    if (cells[0].trim() === '') cells.shift();
    if (cells.length > 0 && (cells.at(-1) as string).trim() === '') cells.pop();
    return cells.length;
}

/**
 * A plain-text paragraph that marked reads back as a table, written verbatim;
 * otherwise undefined. In a list item or blockquote, textToAdf keeps a table as
 * a paragraph of its source (design D5), so its cells hold markdown as text.
 * Written as it is, it reads back as that table and so as the same paragraph,
 * where escaping the delimiter row (escapeContinuationLine) would make the
 * cells' markdown live.
 */
function verbatimTableParagraph(chunks: Chunk[]): string | undefined {
    let text = '';
    for (const chunk of chunks) {
        if (chunk === null) text += '\n';
        else if (chunk.code || chunk.marks.length > 0 || chunk.card) return undefined;
        else text += chunk.text;
    }
    const lines = text.split('\n');
    // marked's table rule allows up to three spaces before the header row.
    const header = lines[0].replace(/^ {1,3}/, '');
    if (lines.length < 2 || /^[ \t]/.test(header) || escapeItemLine(header) !== header) {
        return undefined;
    }
    const delimiter = TABLE_DELIMITER_ROW.exec(lines[1]);
    if (!delimiter || !/[:|]/.test(delimiter[1])) return undefined;
    const columns = delimiter[1].replace(/^\||\| *$/g, '').split('|').length;
    if (tableCellCount(header) !== columns) return undefined;
    return lines.slice(2).some(line => TABLE_ROW_STOP.test(line)) ? undefined : text;
}

// ---------------------------------------------------------------------------
// Line-start escaping (design D12)

/**
 * A link reference definition, which marked drops from the text. The mapper
 * declines footnote-style `[^label]:` definitions, so those stay text.
 */
const LINK_DEFINITION = /^ {0,3}\[(?!\^)(?:\\[\s\S]|[^[\]\\])+\]:/;

/**
 * A `[` that nothing closes on its line. marked's definition label runs on over
 * line endings, blank lines included, so a later line that ends with `]:` and a
 * destination would turn everything up to it into a definition.
 */
const OPEN_LABEL = /^ {0,3}\[(?!\^)(?:\\[\s\S]|[^[\]\\])*\\?$/;

/** A task box at the start of a list item, which makes it a task item. */
const TASK_BOX = /^\[[ xX]\][ \t]+\S/;

/** A thematic break: three or more of one of `-`, `*` and `_`, spaces and tabs allowed. */
const THEMATIC_BREAK = /^(?:(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})$/;

/**
 * The delimiter row of a GFM table, such as `|---|:-:|` or `-:`, tabs allowed:
 * under a line of text it makes that line a table's header row.
 */
const DELIMITER_ROW = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

/** A paragraph's first line, where a block can start. */
function escapeOpeningLine(line: string): string {
    if (
        /^#{1,6}(?:[ \t]|$)/.test(line) || // an ATX heading (design D3)
        /^[-+*](?:[ \t]|$)/.test(line) || // a bullet item, an empty one included
        line.startsWith('>') || // a blockquote
        /^`{3,}[^`]*$/.test(line) || // a backtick fence: no backtick may follow on its line
        line.startsWith('~~~') || // a tilde fence
        // A thematic break or a setext underline. A mixed line such as `*-*` is
        // neither, and is often emphasis that a backslash would break.
        THEMATIC_BREAK.test(line) ||
        /^(?:=+|-+)[ \t]*$/.test(line)
    ) {
        return `\\${line}`;
    }
    // An HTML block or a link reference definition: the backslash goes before its `<` or `[`.
    if (htmlBlockType(line) !== 0) return escapeHtmlStart(line);
    if (LINK_DEFINITION.test(line) || OPEN_LABEL.test(line)) {
        return line.replace(/^( {0,3})\[/, '$1\\[');
    }
    // An ordered item marker, `N.` or `N)`, is escaped as `N\.` or `N\)`.
    const digits = /^\d{1,9}(?=[.)](?:[ \t]|$))/.exec(line);
    return digits ? `${digits[0]}\\${line.slice(digits[0].length)}` : line;
}

/**
 * A later line of a paragraph at the top level or in a blockquote: only what
 * can interrupt a paragraph is escaped, plus the `-` and `=` lines that would
 * make it a setext heading and a table delimiter row, which would make the line
 * above it a table. An ordered item interrupts only when it starts at 1.
 */
function escapeContinuationLine(line: string): string {
    if (
        /^#{1,6}(?:\s|$)/.test(line) || // marked ends a paragraph at any whitespace after the run
        /^[-+*][ \t]+[^ \t]/.test(line) || // a bullet item with content
        line.startsWith('>') ||
        /^`{3,}[^`]*$/.test(line) ||
        line.startsWith('~~~') ||
        THEMATIC_BREAK.test(line) ||
        /^(?:=+|-+)[ \t]*$/.test(line) // a setext underline
    ) {
        return `\\${line}`;
    }
    // A delimiter row with a `|` or `:`; one of dashes alone is a setext underline, above.
    if (DELIMITER_ROW.test(line) && /[|:]/.test(line)) return line.replace(/^( {0,3})/, '$1\\');
    if (HTML_INTERRUPTION.test(line)) return escapeHtmlStart(line);
    return /^1[.)][ \t]+[^ \t]/.test(line) ? `1\\${line.slice(1)}` : line;
}

/**
 * Inside a list item marked lexes a paragraph line by line, trying every block
 * rule on each, so there any line can open a block: `2024. x` after a hard
 * break starts an ordered list. Such lines get both kinds of escaping, and a
 * task box gets one too.
 */
function escapeItemLine(line: string): string {
    if (TASK_BOX.test(line)) return `\\${line}`;
    const escaped = escapeOpeningLine(line);
    return escaped === line ? escapeContinuationLine(line) : escaped;
}

const BLANK = /^[ \t]*$/;

/**
 * Inline content as paragraph lines, escaped by where the parser meets each one
 * (design D12). Blank lines at either end are dropped, since markdown cannot
 * write them. A blank line inside, between two hard breaks, would end the
 * paragraph: it is written as a line of only a backslash, a hard break of its
 * own, which a later line always follows. With `everyLineOpens`, every line is
 * escaped as one that can open a block, as in a list item. With
 * `plainFirstLine`, the first line follows a task box, where only another task
 * box needs escaping.
 */
function paragraphText(
    chunks: Chunk[],
    context: Context,
    { everyLineOpens = context.inItem, plainFirstLine = false, autolinks = true } = {},
): string {
    const lines = renderInline(chunks, { autolinks }).split('\n');
    let start = 0;
    let end = lines.length;
    while (start < end && BLANK.test(lines[start])) start++;
    while (end > start && BLANK.test(lines[end - 1])) end--;
    const out: string[] = [];
    for (let i = start; i < end; i++) {
        const line = lines[i];
        if (BLANK.test(line)) {
            out.push('\\');
        } else if (i === start && plainFirstLine) {
            out.push(TASK_BOX.test(line) ? `\\${line}` : line);
        } else if (everyLineOpens) {
            out.push(escapeItemLine(line));
        } else if (i === start) {
            out.push(escapeOpeningLine(line));
        } else {
            out.push(escapeContinuationLine(line));
        }
    }
    return out.join('\n');
}

// ---------------------------------------------------------------------------
// Blocks

interface Context {
    /** Inside a list item, where any paragraph line can open a block (see escapeItemLine). */
    inItem: boolean;
    /**
     * Inside a list item or blockquote, where textToAdf keeps a table as a
     * paragraph of its source (see verbatimTableParagraph).
     */
    keepsTablesAsText: boolean;
    /** In a block task item, whose first block follows its task box. */
    afterTaskBox?: boolean;
}

const TOP: Context = { inItem: false, keepsTablesAsText: false };
const ITEM: Context = { inItem: true, keepsTablesAsText: true };
const QUOTE: Context = { inItem: false, keepsTablesAsText: true };

interface Block {
    text: string;
    /** `html`: a paragraph written verbatim as the HTML block it reads back as. */
    kind: 'paragraph' | 'html' | 'list' | 'code' | 'other';
    /**
     * A list that can interrupt a paragraph: its first item has content and, if
     * ordered, starts at 1.
     */
    interrupts?: boolean;
    /** A list's marker, for the adjacent-list rule (design D11). */
    marker?: { ordered: boolean; alternate: boolean };
    /**
     * For an `html` block that only the end of its container ends: the block to
     * write instead when another block follows, which it would take in.
     */
    ifFollowed?: Block;
}

/**
 * Renders block nodes in order, skipping blocks that render empty. Consecutive
 * inline nodes form a paragraph. A node of an unknown type adds no syntax: its
 * children render in its place, inline ones inline and block ones as blocks.
 */
function collectBlocks(nodes: Json[], context: Context, out: Block[]): Block[] {
    let inline: Json[] = [];
    const add = (block: Block | undefined): void => {
        if (block !== undefined && block.text !== '') out.push(block);
    };
    const paragraph = (chunks: Chunk[]): Block => {
        // After a task box no table starts on the line.
        const verbatim = context.keepsTablesAsText && !(context.afterTaskBox && out.length === 0);
        const table = verbatim ? verbatimTableParagraph(chunks) : undefined;
        if (table !== undefined) return { text: table, kind: 'paragraph' };
        const html = verbatimHtmlParagraph(chunks);
        if (html === undefined) return { text: paragraphText(chunks, context), kind: 'paragraph' };
        const block: Block = { text: html.text, kind: 'html' };
        if (html.open)
            block.ifFollowed = { text: paragraphText(chunks, context), kind: 'paragraph' };
        return block;
    };
    const flush = (): void => {
        if (inline.length === 0) return;
        add(paragraph(collectInline(inline, false)));
        inline = [];
    };

    for (const node of nodes) {
        if (isInline(node)) {
            inline.push(node);
            continue;
        }
        flush();
        switch (node.type) {
            case 'paragraph':
                add(paragraph(collectInline(childrenOf(node), false)));
                break;
            case 'heading':
                add(headingBlock(node, context));
                break;
            case 'bulletList':
            case 'orderedList':
                add(listBlock(node, out.at(-1)));
                break;
            case 'taskList':
                add(taskListBlock(node, out.at(-1)));
                break;
            case 'codeBlock':
                add({ text: codeBlockText(node), kind: 'code' });
                break;
            case 'blockquote':
                add({ text: blockquoteText(node), kind: 'other' });
                break;
            case 'rule':
                add({ text: '---', kind: 'other' });
                break;
            case 'table':
                add({ text: tableText(node), kind: 'other' });
                break;
            case 'blockCard':
            case 'embedCard': {
                const chunks: Chunk[] = [];
                pushText(chunks, cardUrl(node), undefined);
                add(paragraph(chunks));
                break;
            }
            case 'expand':
            case 'nestedExpand': {
                // The title is visible content in Jira and Confluence: keep it as
                // a paragraph before the body.
                const title = expandTitle(node);
                if (title !== undefined) {
                    const chunks: Chunk[] = [];
                    pushText(chunks, title, undefined);
                    add(paragraph(chunks));
                }
                collectBlocks(childrenOf(node), context, out);
                break;
            }
            default:
                collectBlocks(childrenOf(node), context, out);
        }
    }
    flush();
    return out;
}

/**
 * Joins rendered blocks: always by a blank line at the top level and in a
 * blockquote. Inside a list item (`tight`), a block follows on the next line
 * where that cannot change what is read, which keeps nested lists and fenced
 * steps compact.
 */
function joinBlocks(blocks: Block[], tight: boolean): string {
    const written = blocks.map((block, i) =>
        i < blocks.length - 1 && block.ifFollowed ? block.ifFollowed : block,
    );
    let text = '';
    written.forEach((block, i) => {
        if (i > 0) text += tight && joinsTightly(written[i - 1], block) ? '\n' : '\n\n';
        text += block.text;
    });
    return text;
}

function joinsTightly(previous: Block, next: Block): boolean {
    // A closed fence ends its block.
    if (previous.kind === 'code') return true;
    // Other blocks end at a blank line; an `html` block may need one, since only
    // a blank line ends an HTML block of type 6 or 7.
    if (previous.kind !== 'paragraph' && previous.kind !== 'list') return false;
    // A fence interrupts a paragraph and ends a list item.
    if (next.kind === 'code') return true;
    // A list after a paragraph must be able to interrupt it; a list after a list
    // starts anew, since adjacent lists never share a marker.
    return next.kind === 'list' && (previous.kind === 'list' || next.interrupts === true);
}

/** Puts a list marker before an item's first line and indents the rest by the marker's width. */
function withMarker(marker: string, body: string): string {
    if (body === '') return marker;
    const indent = ' '.repeat(marker.length + 1);
    const lines = body.split('\n').map(line => (line === '' ? '' : indent + line));
    if (bodyBelowMarker(marker, body)) return `${marker}\n${lines.join('\n')}`;
    lines[0] = `${marker} ${body.split('\n', 1)[0]}`;
    return lines.join('\n');
}

/**
 * Whether an item's body goes below its marker. Whitespace after a marker
 * counts as part of it, so a first line that starts with some goes below the
 * marker, where the item's indentation is fixed. So does one that would make
 * the marker's line a thematic break, as the markers of empty nested items do
 * (`- - -`). An item that starts this way cannot interrupt a paragraph.
 */
function bodyBelowMarker(marker: string, body: string): boolean {
    return startsWithSpace(body) || THEMATIC_BREAK.test(`${marker} ${body.split('\n', 1)[0]}`);
}

function startsWithSpace(text: string): boolean {
    return text.startsWith(' ') || text.startsWith('\t');
}

function indentLines(text: string, indent: string): string {
    return text
        .split('\n')
        .map(line => (line === '' ? '' : indent + line))
        .join('\n');
}

/**
 * Markdown merges two adjacent lists that share a marker, so a list right after
 * a sibling list of the same kind switches to `*` or `N)`, alternating (design
 * D11). A task list counts as a bullet list here, which is how it reads back.
 */
function alternates(previous: Block | undefined, ordered: boolean): boolean {
    return previous?.marker?.ordered === ordered ? !previous.marker.alternate : false;
}

function listBlock(node: Json, previous: Block | undefined): Block | undefined {
    const ordered = node.type === 'orderedList';
    const alternate = alternates(previous, ordered);
    const order = attrsOf(node).order;
    const start =
        ordered && typeof order === 'number' && Number.isSafeInteger(order) && order >= 0
            ? order
            : 1;
    const items = childrenOf(node);
    if (items.length === 0) return undefined;
    let interrupts = false;
    const lines = items.map((item, index) => {
        const marker = ordered ? `${start + index}${alternate ? ')' : '.'}` : alternate ? '*' : '-';
        const content = item.type === 'listItem' ? childrenOf(item) : [item];
        const body = joinBlocks(collectBlocks(content, ITEM, []), true);
        if (index === 0) {
            interrupts = body !== '' && !bodyBelowMarker(marker, body) && (!ordered || start === 1);
        }
        return withMarker(marker, body);
    });
    return { text: lines.join('\n'), kind: 'list', interrupts, marker: { ordered, alternate } };
}

function taskListBlock(node: Json, previous: Block | undefined): Block | undefined {
    const alternate = alternates(previous, false);
    const marker = alternate ? '*' : '-';
    const lines: string[] = [];
    for (const child of childrenOf(node)) {
        if (child.type === 'taskList') {
            // A nested task list is indented two spaces, under the item before it.
            const nested = taskListBlock(child, undefined);
            if (nested) lines.push(indentLines(nested.text, '  '));
            continue;
        }
        const box = attrsOf(child).state === 'DONE' ? '[x]' : '[ ]';
        // Any other node in the list, such as a card, stands for the content of an
        // item, so that its text is not lost.
        const isTask = child.type === 'taskItem' || child.type === 'blockTaskItem';
        const children = isTask ? childrenOf(child) : [child];
        let body: string;
        if (children.every(isInline)) {
            // taskItem: inline content, whose first line follows the box.
            const text = paragraphText(collectInline(children, false), ITEM, {
                plainFirstLine: true,
            });
            body = text === '' ? box : `${box} ${text}`;
        } else {
            // blockTaskItem: paragraphs.
            const blocks = collectBlocks(children, { ...ITEM, afterTaskBox: true }, []);
            const first = blocks.at(0);
            if (first?.kind === 'paragraph') blocks[0] = { ...first, text: `${box} ${first.text}` };
            else blocks.unshift({ text: box, kind: 'paragraph' });
            body = joinBlocks(blocks, true);
        }
        lines.push(withMarker(marker, body));
    }
    if (lines.length === 0) return undefined;
    return {
        text: lines.join('\n'),
        kind: 'list',
        interrupts: true,
        marker: { ordered: false, alternate },
    };
}

function headingBlock(node: Json, context: Context): Block {
    const value = attrsOf(node).level;
    const level =
        typeof value === 'number' && Number.isFinite(value)
            ? Math.min(6, Math.max(1, Math.trunc(value)))
            : 1;
    const children = childrenOf(node);
    if (level <= 2) {
        // ATX syntax has no line breaks, so a level-1 or level-2 heading with one is
        // written in setext form: its lines, then an underline. marked continues a
        // setext heading over no line that starts with a list marker and a space, or
        // with any other block start, so every line is escaped as an opening one.
        // Nor over a line of only `|`, `:`, `-` and spaces that holds a `|`, which
        // gets a backslash before its first character.
        const setext = (autolinks: boolean): string =>
            paragraphText(collectInline(children, false), context, {
                everyLineOpens: true,
                autolinks,
            }).replace(/^([ \t]*)([|:-][|:\- \t]*)$/gm, (line, indent: string, rest: string) =>
                rest.includes('|') ? `${indent}\\${rest}` : line,
            );
        let lines = setext(true);
        // Nor over a line that is only `<...>`: such an autolink is written
        // `[url](url)`, and such text gets a backslash before its `<`.
        if (/^ {0,3}<[^\n>]+>$/m.test(lines)) {
            lines = setext(false).replace(/^( {0,3})<(?=[^\n>]+>$)/gm, '$1\\<');
        }
        // Nor over a line that starts with three backticks or tildes, even when they
        // open a code span, which no backslash can escape: such a heading is
        // written in ATX form below, its hard breaks as spaces.
        if (lines.includes('\n') && !/^ {0,3}(?:`{3,}|~{3,})/m.test(lines)) {
            return { text: `${lines}\n${level === 1 ? '===' : '---'}`, kind: 'other' };
        }
    }
    // At levels 3 to 6 each hard break is a space.
    const content = headingContent(renderInline(collectInline(children, true)).replace(/\n/g, ' '));
    const hashes = '#'.repeat(level);
    return { text: content === '' ? hashes : `${hashes} ${content}`, kind: 'other' };
}

/**
 * ATX heading content without surrounding spaces and tabs. A trailing `#` run
 * after a space or tab, or content of only `#`s, would read as a closing
 * sequence and be stripped, so the run gets a backslash.
 */
function headingContent(raw: string): string {
    let start = 0;
    let end = raw.length;
    while (start < end && (raw[start] === ' ' || raw[start] === '\t')) start++;
    while (end > start && (raw[end - 1] === ' ' || raw[end - 1] === '\t')) end--;
    const content = raw.slice(start, end);
    let run = content.length;
    while (run > 0 && content[run - 1] === '#') run--;
    if (
        run < content.length &&
        (run === 0 || content[run - 1] === ' ' || content[run - 1] === '\t')
    ) {
        return `${content.slice(0, run)}\\${content.slice(run)}`;
    }
    return content;
}

/**
 * A code block's text. A carriage return ends a line for the parser, so it is
 * written as a line feed, where the line gets its list indent or quote prefix.
 */
function codeBody(node: Json): string {
    return childrenOf(node)
        .map(child =>
            typeof child.text === 'string' ? child.text : child.type === 'hardBreak' ? '\n' : '',
        )
        .join('')
        .replace(/\r\n?/g, '\n');
}

/** A fenced code block whose fence is longer than any run of fence characters in its body. */
function codeBlockText(node: Json): string {
    const body = codeBody(node);
    const attr = attrsOf(node).language;
    const language =
        typeof attr === 'string'
            ? escapeBackslashes(trimFlankingSpace(attr.replace(/[\r\n]+/g, ' ')))
            : '';
    // A backtick fence's info string cannot hold a backtick, a tilde fence's can.
    const char = language.includes('`') ? '~' : '`';
    const fence = char.repeat(Math.max(3, longestRun(body, char) + 1));
    return body === '' ? `${fence}${language}\n${fence}` : `${fence}${language}\n${body}\n${fence}`;
}

function blockquoteText(node: Json): string {
    const inner = joinBlocks(collectBlocks(childrenOf(node), QUOTE, []), false);
    if (inner === '') return '>';
    return inner
        .split('\n')
        .map(line => (line === '' ? '>' : `> ${line}`))
        .join('\n');
}

/**
 * A GFM pipe table: the first row is the header row, followed by a delimiter
 * row, and every row is padded to the widest one.
 */
function tableText(node: Json): string {
    const rows = childrenOf(node).map(row =>
        (isInline(row) ? [row] : childrenOf(row)).map(cell => cellText(cell)),
    );
    let width = 0;
    for (const row of rows) width = Math.max(width, row.length);
    if (width === 0) return '';
    const line = (cells: string[]): string =>
        `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
    const lines = rows.map(line);
    lines.splice(1, 0, line(Array.from({ length: width }, () => '---')));
    return lines.join('\n');
}

/**
 * A cell's blocks rendered inline and joined by spaces, with `|` escaped as `\|`.
 * marked, like GFM, ends a cell at a `|` after an even run of backslashes and
 * then turns each `\|` into `|`, before reading the cell's inline content. So a
 * `|` gets a backslash unless an odd run already escapes it: text doubles its
 * backslashes before a `|` (see renderInline), and link destinations and titles
 * double theirs, so those read back as they are. A code span cannot hold an odd
 * run of backslashes before a `|` exactly: the `|` stays in its cell, but one
 * backslash of the run is lost.
 */
function cellText(cell: Json): string {
    const chunks: Chunk[] = [];
    cellChunks(isInline(cell) ? [cell] : childrenOf(cell), chunks);
    return trimFlankingSpace(renderInline(chunks, { cell: true }).replace(/\n/g, ' ')).replace(
        /(\\*)\|/g,
        (pipe, run: string) => (run.length % 2 === 0 ? `${run}\\|` : pipe),
    );
}

function cellChunks(nodes: Json[], chunks: Chunk[]): void {
    let inline: Json[] = [];
    const separate = (): void => {
        if (chunks.length > 0) pushText(chunks, ' ', undefined);
    };
    const flush = (): void => {
        if (inline.length === 0) return;
        separate();
        collectInline(inline, true, chunks);
        inline = [];
    };
    for (const node of nodes) {
        if (isInline(node)) {
            inline.push(node);
            continue;
        }
        flush();
        if (node.type === 'codeBlock') {
            separate();
            pushText(chunks, codeBody(node), [{ type: 'code' }]);
        } else if (node.type === 'blockCard' || node.type === 'embedCard') {
            separate();
            pushText(chunks, cardUrl(node), undefined);
        } else {
            const title = expandTitle(node);
            if (title !== undefined) {
                separate();
                pushText(chunks, title, undefined);
            }
            cellChunks(childrenOf(node), chunks);
        }
    }
    flush();
}

// ---------------------------------------------------------------------------
// Entry point

/**
 * Renders an ADF document as markdown. A string is returned unchanged, and
 * `null` or `undefined` gives an empty string.
 */
export function adfToMarkdown(adf: AdfDocument | string | null | undefined): string {
    if (adf === null || adf === undefined) return '';
    if (typeof adf === 'string') return adf;
    try {
        const text = isRecord(adf)
            ? joinBlocks(collectBlocks(childrenOf(adf), TOP, []), false)
            : '';
        // markdownToAdf drops one byte-order mark at the very start, so text that
        // starts with one gets a second.
        return text.charCodeAt(0) === 0xfeff ? String.fromCharCode(0xfeff) + text : text;
    } catch {
        // Only nesting deeper than the call stack allows, or an object that
        // contains itself, gets here.
        return plainText(adf);
    }
}

/** The document's text, gathered without recursion: the fallback when rendering fails. */
function plainText(root: unknown): string {
    const parts: string[] = [];
    const stack: unknown[] = [root];
    const seen = new Set<object>();
    while (stack.length > 0) {
        const item = stack.pop();
        if (typeof item === 'string') {
            parts.push(item);
            continue;
        }
        if (!isRecord(item) || seen.has(item)) continue;
        seen.add(item);
        const text =
            typeof item.text === 'string'
                ? item.text
                : item.type === 'hardBreak'
                  ? '\n'
                  : atomText(item);
        if (text !== undefined) parts.push(text);
        if (Array.isArray(item.content)) {
            // A block's text ends with a blank line, which the stack emits after its children.
            if (!isInline(item)) stack.push('\n\n');
            for (let i = item.content.length - 1; i >= 0; i--) stack.push(item.content[i]);
        }
    }
    return parts
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
