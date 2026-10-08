// cspell:words lheading noncharacter noncharacters xmpp
// Markdown to ADF (Atlassian Document Format) conversion.
//
// marked's lexer parses the markdown (GitHub-flavored, CommonMark block structure); this module
// maps its tokens to ADF. The mapping owns the compatibility policies: a single newline is a hard
// break, raw HTML stays literal text, `code` combines only with `link`, nested quotes are
// flattened, task items become ballot-box bullets, and no text node is empty or holds a CR.

import { Marked, Tokenizer, type Token, type Tokens } from 'marked';
import type { AdfDocument, AdfMark, AdfNode } from './adf-types.ts';

// --- Input normalization (design D4) -------------------------------------------------------------

const LINE_SEPARATOR = '\u2028';
const PARAGRAPH_SEPARATOR = '\u2029';

// marked's block rules use JavaScript's `.` and `\s`, which treat U+2028 / U+2029 as line
// endings or whitespace. CommonMark treats them as ordinary characters, so they are swapped for
// two noncharacters before lexing and swapped back in every emitted string. A sentinel must not
// occur in the input, literally or as a numeric character reference: a decoded reference could
// otherwise be rewritten.
const FIRST_NONCHARACTER = 0xfdd0;
const LAST_NONCHARACTER = 0xfdef;
// Decimal or hex, any case, any number of leading zeros: a superset of what marked decodes.
const ANY_NUMERIC_REFERENCE = /&#(?:[xX]([0-9a-fA-F]+)|([0-9]+));/g;

interface Sentinels {
    lineSeparator: string;
    paragraphSeparator: string;
}

function pickSentinels(text: string): Sentinels {
    const used = new Set<number>();
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code >= FIRST_NONCHARACTER && code <= LAST_NONCHARACTER) used.add(code);
    }
    for (const match of text.matchAll(ANY_NUMERIC_REFERENCE)) {
        used.add(match[1] !== undefined ? parseInt(match[1], 16) : parseInt(match[2], 10));
    }
    const free: string[] = [];
    for (let code = FIRST_NONCHARACTER; code <= LAST_NONCHARACTER && free.length < 2; code++) {
        if (!used.has(code)) free.push(String.fromCharCode(code));
    }
    if (free.length < 2) {
        throw new Error(
            'markdownToAdf: the input uses at least 31 of the noncharacters U+FDD0-U+FDEF, so two ' +
                'are not free to stand in for U+2028 and U+2029 while the markdown is parsed',
        );
    }
    return { lineSeparator: free[0], paragraphSeparator: free[1] };
}

// CRLF and lone CR become LF, then one leading byte-order mark is dropped. Nothing else changes;
// in particular `\n` escape sequences are never interpreted.
function normalizeInput(text: string): string {
    const normalized = text.replace(/\r\n?/g, '\n');
    return normalized.charCodeAt(0) === 0xfeff ? normalized.slice(1) : normalized;
}

// --- Character references (design D8) -----------------------------------------------------------

// The numeric references marked decodes in text, with marked's own limits.
const NUMERIC_REFERENCE = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/g;

// marked's decoding, except that a reference to U+000D keeps its source text: no text node may
// contain a carriage return.
function decodeNumericReferences(text: string): string {
    if (!text.includes('&#')) return text;
    return text.replace(NUMERIC_REFERENCE, (reference: string, dec?: string, hex?: string) => {
        const code = dec === undefined ? parseInt(hex as string, 16) : parseInt(dec, 10);
        if (code === 0x0d) return reference;
        if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\uFFFD';
        return String.fromCodePoint(code);
    });
}

// --- Inline text run (replaces marked's `text` rule) ---------------------------------------------

// marked's inline `text` rule (GFM with `breaks`) re-scans a run of spaces at every position
// inside it (its ` *\n` lookahead), so a line with a long run of spaces takes quadratic time:
// 200,000 spaces in one heading took 5 s under Bun and 17 s under Node. `inlineTextLength`
// computes the same match in linear time; the unit tests compare it with marked's rule.

const ASCII_ALPHANUMERIC = new Uint8Array(128);
const EMAIL_CHAR = new Uint8Array(128);
const TEXT_STOP = new Uint8Array(128);
for (let code = 0; code < 128; code++) {
    const char = String.fromCharCode(code);
    ASCII_ALPHANUMERIC[code] = /[a-zA-Z0-9]/.test(char) ? 1 : 0;
    EMAIL_CHAR[code] = /[a-zA-Z0-9.!#$%&'*+/=?_`{|}~-]/.test(char) ? 1 : 0;
    TEXT_STOP[code] = '\\<![`*~_'.includes(char) ? 1 : 0;
}

const isAsciiAlphanumeric = (code: number): boolean => code < 128 && ASCII_ALPHANUMERIC[code] === 1;
const isEmailChar = (code: number): boolean => code < 128 && EMAIL_CHAR[code] === 1;

// Whether `word` occurs at `index`, ignoring ASCII case. `word` is lower case.
function hasWordAt(src: string, index: number, word: string): boolean {
    if (index + word.length > src.length) return false;
    for (let k = 0; k < word.length; k++) {
        if ((src.charCodeAt(index + k) | 0x20) !== word.charCodeAt(k)) return false;
    }
    return true;
}

/**
 * Returns the length of the text token that marked's GFM `breaks` inline `text` rule matches at
 * the start of `src`, or 0 when it matches nothing. It mirrors this regular expression, in which
 * `E` is the e-mail character class `[a-zA-Z0-9.!#$%&'*+/=?_`{|}~-]`:
 *
 *     ^(?:[^a-zA-Z0-9](?=(?:mailto|xmpp):)
 *       |(`+|~+|[^`~])(?:(?=[`~])|(?= *\n)|(?=E+@)
 *         |[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_| *\n|[hH][tT][tT][pP][sS]?|[fF][tT][pP]:\/\/|www\.|$)
 *           |[^ ](?= *\n)|[^a-zA-Z0-9](?=(?:mailto|xmpp):)|[^E](?=E+@))))
 *
 * Exported for the unit test that checks it against marked's rule.
 */
export function inlineTextLength(src: string): number {
    const n = src.length;
    if (n === 0) return 0;

    // ` *\n` at p. The answer is the same anywhere inside one run of spaces, so it is cached.
    let spaceRunStart = -1;
    let spaceRunEnd = -1;
    const spacesThenNewline = (p: number): boolean => {
        if (p >= n) return false;
        const code = src.charCodeAt(p);
        if (code !== 0x20) return code === 0x0a;
        if (p < spaceRunStart || p >= spaceRunEnd) {
            let q = p;
            while (q < n && src.charCodeAt(q) === 0x20) q++;
            spaceRunStart = p;
            spaceRunEnd = q;
        }
        return spaceRunEnd < n && src.charCodeAt(spaceRunEnd) === 0x0a;
    };

    // `E+@` at p, cached per run of e-mail characters in the same way.
    let emailRunStart = -1;
    let emailRunEnd = -1;
    const emailThenAt = (p: number): boolean => {
        if (p >= n || !isEmailChar(src.charCodeAt(p))) return false;
        if (p < emailRunStart || p >= emailRunEnd) {
            let q = p;
            while (q < n && isEmailChar(src.charCodeAt(q))) q++;
            emailRunStart = p;
            emailRunEnd = q;
        }
        return emailRunEnd < n && src.charCodeAt(emailRunEnd) === 0x40;
    };

    const mailSchemeAt = (p: number): boolean =>
        src.startsWith('mailto:', p) || src.startsWith('xmpp:', p);

    // [^a-zA-Z0-9](?=(?:mailto|xmpp):)
    if (!isAsciiAlphanumeric(src.charCodeAt(0)) && mailSchemeAt(1)) return 1;

    // (`+|~+|[^`~]): a whole run of backticks or tildes, or any other single code unit.
    const first = src.charCodeAt(0);
    let i = 1;
    if (first === 0x60 || first === 0x7e) {
        while (i < n && src.charCodeAt(i) === first) i++;
    }
    if (i < n && (src.charCodeAt(i) === 0x60 || src.charCodeAt(i) === 0x7e)) return i;
    if (spacesThenNewline(i) || emailThenAt(i)) return i;

    // [\s\S]*? up to the first position where one of the stop alternatives holds.
    for (let p = i; p < n; p++) {
        const code = src.charCodeAt(p);
        if (
            (code < 128 && TEXT_STOP[code] === 1) ||
            spacesThenNewline(p) ||
            hasWordAt(src, p, 'http') ||
            (hasWordAt(src, p, 'ftp') && src.startsWith('://', p + 3)) ||
            src.startsWith('www.', p)
        ) {
            return p;
        }
        if (code !== 0x20 && spacesThenNewline(p + 1)) return p + 1;
        if (!isAsciiAlphanumeric(code) && mailSchemeAt(p + 1)) return p + 1;
        if (!isEmailChar(code) && emailThenAt(p + 1)) return p + 1;
    }
    return n;
}

// --- Headings (design D3, D6) --------------------------------------------------------------------

const isSpaceOrTab = (code: number): boolean => code === 0x20 || code === 0x09;

// Strips spaces and tabs only (not trim(), which also drops U+00A0). Index scans, because a
// trailing `[ \t]+$` regex backtracks quadratically over a long run of spaces inside the text.
function trimSpacesAndTabs(text: string): string {
    let start = 0;
    let end = text.length;
    while (start < end && isSpaceOrTab(text.charCodeAt(start))) start++;
    while (end > start && isSpaceOrTab(text.charCodeAt(end - 1))) end--;
    return text.slice(start, end);
}

// CommonMark ATX heading text: an optional closing run of `#` is removed only when a space or
// tab precedes it (`## C#` keeps its `#`), and text that is only `#`s is a closing run.
function atxHeadingText(rest: string): string {
    const text = trimSpacesAndTabs(rest);
    let end = text.length;
    while (end > 0 && text.charCodeAt(end - 1) === 0x23) end--;
    if (end === text.length) return text;
    if (end === 0) return '';
    if (!isSpaceOrTab(text.charCodeAt(end - 1))) return text;
    return trimSpacesAndTabs(text.slice(0, end));
}

const ATX_HEADING = /^ {0,3}(#{1,6})(?=[ \t\n]|$)([^\n]*)(?:\n+|$)/;

// Lines at which marked's setext rule stops looking for an underline, unless
// they are one: a quote, an ATX heading, a fence, a list item, a thematic
// break, an HTML tag alone on its line and a line shaped like a table's
// delimiter row. The rule also stops at blank lines, which
// mayHaveSetextUnderline checks itself. When the check let a rule or a table
// line through, marked's rule scanned to it from every line of a list item
// above it: 5,000 lines took seconds.
const SETEXT_STOP =
    / {0,3}(?:>|#{1,6}(?:\s|$)|`{3}|~{3}|(?:[*+-]|\d{1,9}[.)]) |(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n|$)|<[^\n>]+>\n|\|?(?:[:\- ]*\|)+[:\- ]*\n)/y;
// The characters a SETEXT_STOP line can start with after its leading spaces.
const SETEXT_STOP_START = new Uint8Array(128);
for (const char of '>#`~*+-_<|:0123456789') SETEXT_STOP_START[char.charCodeAt(0)] = 1;
// The rest of a line, when it holds only JavaScript whitespace: marked's `\s*?\n` reads such a
// line as blank, U+00A0 included.
const WHITESPACE_TO_LINE_END = /[^\S\n]*(?:\n|$)/y;

/**
 * Whether a line after the first one could underline a setext heading before
 * marked's `lheading` rule stops looking: a line of only `=` or only `-`
 * characters, with spaces or tabs around them, before the first blank line or
 * SETEXT_STOP line. That accepts more lines than the rule does
 * (` {0,3}(=+|-+) *`) and stops at the same ones, so where this is false the
 * rule cannot match. The underline is checked first because the rule reads
 * `---` as one before it reads it as a thematic break. Exported for the unit
 * test that checks it against marked's rule.
 */
export function mayHaveSetextUnderline(src: string): boolean {
    let start = src.indexOf('\n') + 1;
    while (start > 0 && start < src.length) {
        let end = src.indexOf('\n', start);
        if (end < 0) end = src.length;
        let k = start;
        while (k < end && isSpaceOrTab(src.charCodeAt(k))) k++;
        if (k === end) return false; // a blank line
        const char = src.charCodeAt(k);
        if (char === 0x0b || char === 0x0c || char > 0x7e) {
            WHITESPACE_TO_LINE_END.lastIndex = k;
            if (WHITESPACE_TO_LINE_END.test(src)) return false;
        }
        if (char === 0x3d || char === 0x2d) {
            let m = k;
            while (m < end && src.charCodeAt(m) === char) m++;
            while (m < end && isSpaceOrTab(src.charCodeAt(m))) m++;
            if (m === end) return true;
        }
        let s = start;
        while (src.charCodeAt(s) === 0x20) s++;
        if (SETEXT_STOP_START[src.charCodeAt(s)] === 1) {
            SETEXT_STOP.lastIndex = start;
            if (SETEXT_STOP.test(src)) return false;
        }
        start = end + 1;
    }
    return false;
}

// --- Quotes ---------------------------------------------------------------------------------------

const BARE_QUOTE_LINE = /^ {0,3}>[ \t]*$/;
const QUOTE_LINE = /^ {0,3}>/;
const BLANK_LINE = /^[ \t]*$/;

// marked's blockquote rule reads a bare quote line that holds more than one space, or a tab, after
// the `>` as paragraph text, so an unquoted line after it continues that paragraph. A bare quote
// line ends the paragraph (CommonMark, and the robust-input requirement), so no lazy line can
// follow it: the quote ends there. Returns the offset in `quote` of the first such lazy line that
// starts before `limit`, or -1.
function bareQuoteLineEnd(quote: string, limit: number): number {
    let bare = false;
    for (let start = 0; start < quote.length;) {
        let end = quote.indexOf('\n', start);
        if (end < 0) end = quote.length;
        const line = quote.slice(start, end);
        if (bare && start < limit && !QUOTE_LINE.test(line) && !BLANK_LINE.test(line)) return start;
        bare = BARE_QUOTE_LINE.test(line);
        start = end + 1;
    }
    return -1;
}

// The quote at the start of `src`: what marked's quote rule matches, ended at a bare quote line
// (bareQuoteLineEnd). The rule runs on a prefix of `src` that doubles until it decides the quote,
// so a quote cut short costs time in proportion to itself rather than to the quote lines after
// it: 3,800 bare quote lines holding a tab, each followed by an unquoted line, took 8 s.
function quoteAt(rule: RegExp, src: string): string | undefined {
    for (let size = 512; ; size *= 2) {
        const windowEnd = size < src.length ? src.indexOf('\n', size) : -1;
        const window = windowEnd < 0 ? src : src.slice(0, windowEnd);
        const match = rule.exec(window);
        if (!match) return undefined;
        // Only the window's last line can read differently once the text after it is there: the
        // rule looks past a line's end to tell paragraph text from a blank or an HTML line.
        const lastLine = windowEnd < 0 ? window.length + 1 : window.lastIndexOf('\n') + 1;
        const cut = bareQuoteLineEnd(match[0], lastLine);
        if (cut >= 0) return src.slice(0, cut);
        if (match[0].length <= lastLine) return match[0];
    }
}

// marked lexes a quote nested in another twice when lazy lines follow it, once alone and once with
// those lines, so a quote whose depth drops by one level per line took time exponential in its
// depth (22 levels in 296 characters took seconds), and every level is a recursive call (8,659
// levels overflowed the stack). ADF flattens nested quotes (design D5), so a line quoted more than
// MAX_QUOTE_DEPTH deep is lexed as quoted that deep (capQuoteDepth).
const MAX_QUOTE_DEPTH = 10;
// The quote markers at the start of a line, as marked strips one for each level of nesting. Only
// the first may be indented: a marker after spaces can belong to a list item at that level.
const QUOTE_MARKER = / {0,3}>[ \t]?/y;
const NEXT_QUOTE_MARKER = />[ \t]?/y;
const DEEP_QUOTE = new RegExp(`(?:>[ \\t]?){${MAX_QUOTE_DEPTH + 1}}`);
// A marker after the tight run, after up to three spaces: one more level for marked, or a quote
// in a list item. capQuoteDepth counts it for the depth of the open quote but never cuts it.
const SPACED_QUOTE_MARKER = / {0,3}>[ \t]?/y;
// A line that may open a fenced code block, an HTML block or a link reference definition, after
// its quote and list markers. That block's lines can start with `>` characters that are its text.
// A `<` counts only before a tag name, `/`, `!` or `?`, and a `[` only when its label ends in
// `]:` on the line or runs on past it, so a link, an `<https://...>` autolink or an e-mail
// client's `[cid:...]` placeholder leaves a quote to the cap.
const RAW_BLOCK_START =
    /(?:[ \t]*(?:>|[*+-](?=[ \t\n]|$)|\d{1,9}[.)](?=[ \t\n]|$)))*[ \t]*(?:```|~~~|<(?:[!?/]|[A-Za-z][A-Za-z0-9-]*(?=[\s/>]|$))|\[(?:\\.|[^\\[\]\n])*(?:\]:|\n|$))/y;
// The text of a line that RAW_BLOCK_START matches but that cannot interrupt a paragraph (in marked:
// a definition, or an HTML tag other than those of its paragraph rule's html alternative), after
// its quote markers. Directly under paragraph text it continues that paragraph.
const PARAGRAPH_TEXT_RAW_LINE =
    /(?:[ \t]*>)*[ \t]*(?:\[|<(?!(?:script|pre|style|textarea|!--)|\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: |\n|\/?>|$)))/y;
// Text that closes the quotes deeper than its line instead of continuing their paragraph lazily:
// a list marker or a thematic break.
const CLOSES_DEEPER_QUOTES =
    / {0,3}(?:[*+-](?=[ \t\n]|$)|\d{1,9}[.)](?=[ \t\n]|$)|(?:(?:-[\t ]*){3,}|(?:\*[\t ]*){3,}|(?:_[\t ]*){3,})(?=\n|$))/y;
// A line of `=` or of `-`, which marked does not read as a setext underline in a lazy line.
const UNDERLINE = / {0,3}(?:=+|-+) *(?=\n|$)/y;

interface CappedQuote {
    text: string;
    // The lines capQuoteDepth added, by their index in `text`.
    added: number[];
}

// `quote` with each line quoted more than MAX_QUOTE_DEPTH deep cut to that depth: the line keeps
// its first MAX_QUOTE_DEPTH - 1 markers and its last one, with the space or tab after it, so its
// text is unchanged. Where the cut would join a line to a block that marked keeps it apart from,
// a bare quote line is added above it: above a line that opens a quote deeper than the open one,
// and above a list marker, a thematic break or a `=` or `-` line that is quoted less deep than
// the open quote or follows a lazy line. Nothing is cut from the first line that may open a code,
// HTML or definition block on, since that block's lines can start with `>` characters that are
// text; directly under paragraph text, a definition or an inline HTML tag opens none and is cut
// like other text. Markers after spaces are never cut, so nothing is cut either from the first
// line on that they alone take past the bound. The lines above such a line are cut alike every
// time marked lexes the quote, its lazy lines included. Returns undefined when nothing is cut.
function capQuoteDepth(quote: string): CappedQuote | undefined {
    if (!DEEP_QUOTE.test(quote)) return undefined;
    let text = '';
    let copied = 0;
    const added: number[] = [];
    let line = 0;
    // The depth of the innermost open quote: a lazy line, one that continues a paragraph quoted
    // deeper than itself, keeps that quote open.
    let open = 0;
    let previous = { depth: 0, blank: true };
    for (let start = 0; start < quote.length; line++) {
        RAW_BLOCK_START.lastIndex = start;
        const raw = RAW_BLOCK_START.test(quote);
        PARAGRAPH_TEXT_RAW_LINE.lastIndex = start;
        const paragraphText = raw && !previous.blank && PARAGRAPH_TEXT_RAW_LINE.test(quote);
        if (raw && !paragraphText) break;
        let depth = 0;
        let keep = start; // after the first MAX_QUOTE_DEPTH - 1 markers
        let last = start; // where the last marker starts
        let position = start;
        const ends: number[] = [];
        for (;;) {
            const marker = depth === 0 ? QUOTE_MARKER : NEXT_QUOTE_MARKER;
            marker.lastIndex = position;
            if (!marker.test(quote)) break;
            if (++depth === MAX_QUOTE_DEPTH - 1) keep = marker.lastIndex;
            ends.push(marker.lastIndex);
            last = position;
            position = marker.lastIndex;
        }
        // Markers after spaces are not cut, but marked counts them: one more level each, or a
        // quote in a list item. The open quote is tracked at the depth they add up to.
        const cutDepth = depth;
        for (;;) {
            SPACED_QUOTE_MARKER.lastIndex = position;
            if (!SPACED_QUOTE_MARKER.test(quote)) break;
            depth++;
            position = SPACED_QUOTE_MARKER.lastIndex;
        }
        if (cutDepth <= MAX_QUOTE_DEPTH && depth > MAX_QUOTE_DEPTH) break;
        // Quoted deeper than the open quote, the line opens a quote, in which it starts a block.
        if (paragraphText && depth > open) break;
        const end = quote.indexOf('\n', position);
        const blank = BLANK_LINE.test(quote.slice(position, end < 0 ? quote.length : end));
        CLOSES_DEEPER_QUOTES.lastIndex = position;
        const closes = CLOSES_DEEPER_QUOTES.test(quote);
        UNDERLINE.lastIndex = position;
        const special = closes || UNDERLINE.test(quote);
        // Cut to the open quote's depth, the line would join the block above it, which marked
        // keeps apart from it when it opens a deeper quote. Special text stays apart from the
        // paragraph above it too when its line is not quoted as deep as the open quote, or
        // follows a lazy line, since marked lexes the lines after a lazy line on their own.
        let startsBlock = depth > open && open >= MAX_QUOTE_DEPTH;
        if (special && depth !== open) {
            startsBlock ||= depth >= MAX_QUOTE_DEPTH && open >= MAX_QUOTE_DEPTH;
        } else if (special) {
            startsBlock ||= previous.depth < depth && previous.depth >= MAX_QUOTE_DEPTH;
        }
        if (depth > open || (depth < open && (blank || closes || previous.blank))) open = depth;
        previous = { depth, blank };
        if (startsBlock) {
            text += quote.slice(copied, start) + '>'.repeat(MAX_QUOTE_DEPTH) + '\n';
            copied = start;
            added.push(line++);
        }
        if (cutDepth > MAX_QUOTE_DEPTH) {
            // With markers after spaces, fewer of the tight ones stay, so that all add up to
            // MAX_QUOTE_DEPTH.
            const spaced = depth - cutDepth;
            if (spaced > 0) {
                keep =
                    MAX_QUOTE_DEPTH - 1 - spaced > 0 ? ends[MAX_QUOTE_DEPTH - 2 - spaced] : start;
            }
            text += quote.slice(copied, keep);
            copied = last;
        }
        if (end < 0) break;
        start = end + 1;
    }
    return copied === 0 ? undefined : { text: text + quote.slice(copied), added };
}

// The lines of `quote` that the first lines of a capped quote stand for: as many as `raw`, the
// raw of a quote lexed from it, holds apart from added ones. marked's quote raw is whole lines,
// and never ends at an added line, since the line after one is quoted at least as deep.
function sourceLines(quote: string, capped: CappedQuote, raw: string): string {
    let lines = 1;
    for (let k = raw.indexOf('\n'); k >= 0; k = raw.indexOf('\n', k + 1)) lines++;
    lines -= capped.added.filter(index => index < lines).length;
    let end = -1;
    for (let k = 0; k < lines; k++) {
        end = quote.indexOf('\n', end + 1);
        if (end < 0) return quote;
    }
    return quote.slice(0, end);
}

// --- Nesting limits -------------------------------------------------------------------------------

// Each level of quote or list nesting is a recursive call, in marked and in the mapper, so
// deep nesting overflowed the stack: from about 6,000 levels under Bun, and from a few hundred in
// a Node worker. Past MAX_NESTING levels, far more than any real text holds, a conversion stops
// and keeps the text as written (markdownToAdf), the same on every platform.
const MAX_NESTING = 100;
let nesting = 0;

// Quotes holding a code, HTML or definition block keep their depth (capQuoteDepth), so the work
// of lexing quotes is bounded too: each quote rule call costs its quote's length plus
// QUOTE_WORK_PER_CALL, about what a call costs over the characters it lexes (13 µs against 30 ns
// each). A capped quote is lexed at most about 2^MAX_QUOTE_DEPTH times over, so real text stays
// far below the bound, and crafted nesting stops within about a second.
const QUOTE_WORK_PER_CALL = 400;
const QUOTE_WORK_PER_CHARACTER = 2 ** MAX_QUOTE_DEPTH;
const QUOTE_WORK_MINIMUM = 1_000_000;
let quoteWorkLeft = 0;

class NestingTooDeep extends Error {}

// Lexes one level of nesting deeper.
function nested<T>(lex: () => T): T {
    if (nesting >= MAX_NESTING) throw new NestingTooDeep('markdownToAdf: blocks nest too deeply');
    nesting++;
    try {
        return lex();
    } finally {
        nesting--;
    }
}

// --- Lists ----------------------------------------------------------------------------------------

type InlineQueue = { src: string; tokens: Token[] }[];

// marked removes a task item's box from the last queued inline text that starts with one, which
// is not always the item's own first paragraph: in `- [ ] a`, a blank line and `  [ ] b`, the
// second paragraph lost its box and the item kept it. So every inline text queued while the list
// was lexed is set again from its token, and a loose task item's first paragraph without the box
// that marked put back in front of its text.
function requeueTaskText(list: Tokens.List, queue: InlineQueue, from: number): void {
    const texts = new Map<Token[], string>();
    collectInlineText([list], texts);
    for (let k = from; k < queue.length; k++) {
        const text = texts.get(queue[k].tokens);
        if (text !== undefined) queue[k].src = text;
    }
}

// Removes the inline text queued from `from` on for tokens that `token` does not hold: those of
// tokens marked lexed and then dropped.
function dropUnreachableInline(token: Token, queue: InlineQueue, from: number): void {
    const kept = new Map<Token[], string>();
    collectInlineText([token], kept);
    let end = from;
    for (let k = from; k < queue.length; k++) {
        if (kept.has(queue[k].tokens)) queue[end++] = queue[k];
    }
    queue.length = end;
}

// The text each token among `tokens`, or in the blocks they hold, lexes inline, by its token list.
function collectInlineText(tokens: readonly Token[], texts: Map<Token[], string>): void {
    for (const token of tokens) {
        switch (token.type) {
            case 'paragraph':
            case 'text':
            case 'heading': {
                const block = token as Tokens.Paragraph;
                if (!block.tokens) break;
                const box = block.tokens[0];
                const text =
                    box?.type === 'checkbox' ? block.text.slice(box.raw.length) : block.text;
                texts.set(block.tokens, text);
                break;
            }
            case 'list':
                for (const item of (token as Tokens.List).items) {
                    collectInlineText(item.tokens, texts);
                }
                break;
            case 'blockquote':
                collectInlineText((token as Tokens.Blockquote).tokens, texts);
                break;
            case 'table': {
                const table = token as Tokens.Table;
                for (const cell of [...table.header, ...table.rows.flat()]) {
                    texts.set(cell.tokens, cell.text);
                }
                break;
            }
        }
    }
}

function countLineEndings(text: string): number {
    let count = 0;
    for (let k = text.indexOf('\n'); k >= 0; k = text.indexOf('\n', k + 1)) count++;
    return count;
}

// The columns marked gives an indentation character: a tab counts as four.
const columnWidth = (code: number): number => (code === 0x09 ? 4 : 1);

function indentLength(text: string): number {
    let end = 0;
    while (end < text.length && isSpaceOrTab(text.charCodeAt(end))) end++;
    return end;
}

function indentWidth(text: string): number {
    let width = 0;
    for (let k = 0, end = indentLength(text); k < end; k++) {
        width += columnWidth(text.charCodeAt(k));
    }
    return width;
}

// `line`, a code line that marked read from `source` with each tab in its indentation turned
// into four spaces, with those tabs back: the columns marked removed are removed from `source`
// again, and a tab it removed in part leaves the rest of its four columns as spaces. Returns
// `line` when the indentation of `source` holds no tab or the text after it differs.
function withSourceTabs(line: string, source: string): string {
    const sourceIndent = indentLength(source);
    if (!source.slice(0, sourceIndent).includes('\t')) return line;
    if (source.slice(sourceIndent) !== line.slice(indentLength(line))) return line;
    let removed = indentWidth(source) - indentWidth(line);
    if (removed < 0) return line;
    let k = 0;
    while (k < sourceIndent && columnWidth(source.charCodeAt(k)) <= removed) {
        removed -= columnWidth(source.charCodeAt(k));
        k++;
    }
    return removed > 0 ? ' '.repeat(4 - removed) + source.slice(k + 1) : source.slice(k);
}

// Puts back the tabs in code lines of blocks lexed from a list item's text, and from the items
// of lists among them; `source(k)` is the source line of the text's line k.
function restoreCodeTabs(
    tokens: readonly Token[],
    source: (line: number) => string | undefined,
): void {
    let line = 0;
    for (const token of tokens) {
        if (token.type === 'code') {
            const code = token as Tokens.Code;
            // A fence's text starts on the line after it, indented code on its first line.
            const first = code.codeBlockStyle === 'indented' ? line : line + 1;
            const lines = code.text.split('\n');
            lines.forEach((text, k) => {
                const original = source(first + k);
                if (original !== undefined) lines[k] = withSourceTabs(text, original);
            });
            code.text = lines.join('\n');
        } else if (token.type === 'list') {
            let itemLine = line;
            for (const item of (token as Tokens.List).items) {
                const first = itemLine;
                restoreCodeTabs(item.tokens, k => source(first + k));
                itemLine += countLineEndings(item.raw);
            }
        }
        line += countLineEndings(token.raw);
    }
}

// --- The marked instance (design D3) ------------------------------------------------------------

// One module-level instance, configured locally: never marked.setOptions or marked.use, which
// change state shared with every other marked user in the process. Only lexer() is called.
// In a tokenizer override, `undefined` declines the input and `false` defers to marked's own rule.
const markdown = new Marked({
    gfm: true, // tables, strikethrough, task items, autolink literals
    breaks: true, // a single newline inside a paragraph is a `br` token (design D7)
    tokenizer: {
        // GFM footnotes are not supported: decline `[^label]:` definitions so they stay literal.
        // A definition cannot hold a blank line either (CommonMark), but marked's rule lets the
        // label or a title in double quotes span one, and the text it took was lost.
        def(src) {
            if (/^ {0,3}\[\^/.test(src)) return undefined;
            const match = this.rules.block.def.exec(src);
            return match && /\n[ \t]*\n/.test(trimTrailingNewlines(match[0])) ? undefined : false;
        },
        // CommonMark ATX headings (setext headings are marked's `lheading`). marked's own rule
        // accepts any JavaScript whitespace after the `#` run and trim()s the text.
        heading(src) {
            const match = ATX_HEADING.exec(src);
            if (!match) return undefined;
            const text = atxHeadingText(match[2]);
            return {
                type: 'heading',
                raw: match[0],
                depth: match[1].length,
                text,
                tokens: this.lexer.inline(text),
            };
        },
        // marked's setext rule scans ahead for an underline. In a list item, marked's `text`
        // rule takes one line at a time and the setext rule is tried before it at every line,
        // so a long item took quadratic time, and far longer under Bun's regex engine: 1,500
        // lines of test output in one item took 11 s. Where no underline can be reached the
        // rule is declined after a linear scan; otherwise marked's own rule decides.
        lheading(src) {
            return mayHaveSetextUnderline(src) ? false : undefined;
        },
        // marked's own quote, ended at a bare quote line that an unquoted line follows, and with
        // its depth capped.
        blockquote(src) {
            const quote = quoteAt(this.rules.block.blockquote, src);
            if (quote === undefined) return undefined;
            quoteWorkLeft -= quote.length + QUOTE_WORK_PER_CALL;
            if (quoteWorkLeft < 0) {
                throw new NestingTooDeep('markdownToAdf: quotes nest too deeply');
            }
            const capped = capQuoteDepth(quote);
            const lexed = capped ? capped.text : quote;
            const queue = this.lexer.inlineQueue;
            const queued = queue.length;
            const token = nested(() => Tokenizer.prototype.blockquote.call(this, lexed));
            if (!token) return token;
            // When lines follow a list in the quote, marked splices the list's raw, without its
            // quote markers, into the quote's raw. The length stays right but the text does not,
            // and a quote around this one lexes that raw again with its lazy lines: whole lines
            // were lost. The raw is what the lexer advanced over, so it is taken from there.
            token.raw = lexed.slice(0, token.raw.length);
            // marked lexes a nested quote again with the lazy lines after it and drops the first
            // token, but not the inline text queued for that token, so the deepest paragraph of a
            // quote ladder was lexed hundreds of times over. Only text this token holds stays.
            dropUnreachableInline(token, queue, queued);
            // The lexer advances by the raw, so it holds the source's lines. The token's `text`,
            // which nothing reads, keeps the capped ones.
            if (capped) token.raw = sourceLines(quote, capped, token.raw);
            return token;
        },
        // marked's own list, with each task item's box removed from the item's own first
        // paragraph (requeueTaskText) and tabs put back in its code (restoreCodeTabs).
        list(src) {
            // Only a list counts as a level of nesting.
            if (!this.rules.block.list.test(src)) return undefined;
            const queue = this.lexer.inlineQueue;
            const queued = queue.length;
            const list = nested(() => Tokenizer.prototype.list.call(this, src));
            if (!list) return list;
            if (list.items.some(item => item.task)) requeueTaskText(list, queue, queued);
            if (list.raw.includes('\t')) {
                for (const item of list.items) {
                    const lines = item.raw.split('\n');
                    restoreCodeTabs(item.tokens, line => lines[line]);
                }
            }
            return list;
        },
        // marked's indented code, without the line ending that marked keeps after its last
        // line. Lines indented four or more past a list item's text continue that text, and
        // marked appends them as code, so that line ending became a blank line: an extra
        // hard break before the next line.
        code(src) {
            const token = Tokenizer.prototype.code.call(this, src);
            if (token) token.text = trimTrailingNewlines(token.text);
            return token;
        },
        // marked's text rule in linear time (see inlineTextLength), and numeric references
        // decoded as marked does except for U+000D (design D8).
        inlineText(src) {
            const length = inlineTextLength(src);
            if (length === 0) return undefined;
            const raw = src.slice(0, length);
            const escaped = this.lexer.state.inRawBlock;
            return {
                type: 'text',
                raw,
                text: escaped ? raw : decodeNumericReferences(raw),
                escaped,
            };
        },
    },
});

// --- Block mapping (design D5, D10) --------------------------------------------------------------

// Where a block lands decides what ADF allows there: headings, rules, tables and quotes only at
// the top level.
type BlockContext = 'document' | 'listItem' | 'blockquote';

const UNCHECKED_TASK = '\u2610 ';
const CHECKED_TASK = '\u2611 ';

const emptyParagraph = (): AdfNode => ({ type: 'paragraph', content: [] });

function mapBlocks(tokens: readonly Token[], context: BlockContext, out: AdfNode[]): void {
    for (const token of tokens) mapBlock(token, context, out);
}

function mapBlock(token: Token, context: BlockContext, out: AdfNode[]): void {
    switch (token.type) {
        case 'space':
        case 'def':
        case 'checkbox': // a tight task item's checkbox, read by mapListItem
            return;
        case 'heading': {
            const heading = token as Tokens.Heading;
            const content = mapInline(heading.tokens);
            out.push(
                context === 'document'
                    ? { type: 'heading', attrs: { level: heading.depth }, content }
                    : { type: 'paragraph', content },
            );
            return;
        }
        case 'paragraph':
        case 'text': // the block-level text of a tight list item
            out.push({ type: 'paragraph', content: mapInline(blockInlineTokens(token)) });
            return;
        case 'code':
            out.push(mapCode(token as Tokens.Code));
            return;
        case 'hr':
            out.push(context === 'document' ? { type: 'rule' } : sourceParagraph(token.raw));
            return;
        case 'blockquote': {
            const quote = token as Tokens.Blockquote;
            if (context !== 'document') {
                // ADF nests no quote in a quote or a list item: its children join the parent.
                mapBlocks(quote.tokens, context, out);
                return;
            }
            const content: AdfNode[] = [];
            mapBlocks(quote.tokens, 'blockquote', content);
            out.push({
                type: 'blockquote',
                content: content.length > 0 ? content : [emptyParagraph()],
            });
            return;
        }
        case 'list':
            out.push(mapList(token as Tokens.List));
            return;
        case 'table':
            out.push(
                context === 'document'
                    ? mapTable(token as Tokens.Table)
                    : sourceParagraph(token.raw),
            );
            return;
        default:
            // Block HTML (design D8) and any token this mapper does not know: keep the source.
            out.push(sourceParagraph(token.raw));
    }
}

function blockInlineTokens(token: Token): Token[] {
    const block = token as Tokens.Paragraph | Tokens.Text;
    return block.tokens ?? [{ type: 'text', raw: block.text, text: block.text }];
}

function trimTrailingNewlines(text: string): string {
    let end = text.length;
    while (end > 0 && text.charCodeAt(end - 1) === 0x0a) end--;
    return text.slice(0, end);
}

// Drops trailing lines that hold only spaces and tabs, with their line endings.
function trimTrailingBlankLines(text: string): string {
    let end = text.length;
    for (;;) {
        let start = end;
        while (start > 0 && isSpaceOrTab(text.charCodeAt(start - 1))) start--;
        if (start === 0 || text.charCodeAt(start - 1) !== 0x0a) return text.slice(0, end);
        end = start - 1;
    }
}

// A paragraph holding a block's markdown source, line by line with hard breaks between lines.
function sourceParagraph(raw: string): AdfNode {
    const content: AdfNode[] = [];
    pushSourceLines(content, trimTrailingBlankLines(raw), NO_MARKS);
    return { type: 'paragraph', content };
}

function mapCode(code: Tokens.Code): AdfNode {
    const indented = code.codeBlockStyle === 'indented';
    // No body ends with a line ending: a fence body never does, and the `code` tokenizer
    // drops the one marked keeps after indented code.
    const text = code.text;
    // The language is the first word of the info string; indented code has none.
    const language = indented ? '' : (/^\S*/.exec(code.lang ?? '')?.[0] ?? '');
    return {
        type: 'codeBlock',
        attrs: language ? { language } : {},
        content: text ? [{ type: 'text', text }] : [],
    };
}

function mapList(list: Tokens.List): AdfNode {
    const content = list.items.map(mapListItem);
    if (!list.ordered) return { type: 'bulletList', content };
    // `start` is a number for ordered lists; ADF's `order` defaults to 1.
    return typeof list.start === 'number' && list.start !== 1
        ? { type: 'orderedList', attrs: { order: list.start }, content }
        : { type: 'orderedList', content };
}

// marked puts a task item's checkbox first among the item's blocks when the list is tight, and
// first among the first paragraph's inline tokens when it is loose.
function findCheckbox(item: Tokens.ListItem): Tokens.Checkbox | undefined {
    const first = item.tokens[0];
    if (first?.type === 'checkbox') return first as Tokens.Checkbox;
    if (first?.type === 'paragraph' || first?.type === 'text') {
        const inline = (first as Tokens.Paragraph | Tokens.Text).tokens?.[0];
        if (inline?.type === 'checkbox') return inline as Tokens.Checkbox;
    }
    return undefined;
}

function mapListItem(item: Tokens.ListItem): AdfNode {
    const content: AdfNode[] = [];
    mapBlocks(item.tokens, 'listItem', content);
    const checkbox = findCheckbox(item);
    // Task items stay items of their own list, marked with a ballot box (design D10).
    if (checkbox) prefixFirstParagraph(content, checkbox.checked ? CHECKED_TASK : UNCHECKED_TASK);
    if (content.length === 0) content.push(emptyParagraph());
    return { type: 'listItem', content };
}

function prefixFirstParagraph(content: AdfNode[], prefix: string): void {
    const first = content[0];
    if (first?.type !== 'paragraph') {
        content.unshift({ type: 'paragraph', content: [{ type: 'text', text: prefix }] });
        return;
    }
    const inline = (first.content ??= []);
    const lead = inline[0];
    if (lead?.type === 'text' && !lead.marks?.length) {
        lead.text = prefix + (lead.text ?? '');
    } else {
        inline.unshift({ type: 'text', text: prefix });
    }
}

function mapTable(table: Tokens.Table): AdfNode {
    const row = (cells: Tokens.TableCell[], type: 'tableHeader' | 'tableCell'): AdfNode => ({
        type: 'tableRow',
        content: cells.map(cell => ({
            type,
            content: [{ type: 'paragraph', content: mapInline(cell.tokens) }],
        })),
    });
    return {
        type: 'table',
        // Alignment is dropped; these attributes are what Atlassian's own transformer emits.
        attrs: { isNumberColumnEnabled: false, layout: 'default' },
        content: [
            row(table.header, 'tableHeader'),
            ...table.rows.map(cells => row(cells, 'tableCell')),
        ],
    };
}

// --- Inline mapping (design D7, D8, D9) ----------------------------------------------------------

const NO_MARKS: readonly AdfMark[] = [];
const STRONG: AdfMark = { type: 'strong' };
const EM: AdfMark = { type: 'em' };
const STRIKE: AdfMark = { type: 'strike' };
const CODE: AdfMark = { type: 'code' };

// Marks are kept in one order, so the same marks compare equal however the markdown nested them.
const MARK_RANK: Record<string, number> = { link: 0, em: 1, strong: 2, strike: 3, code: 4 };
const byRank = (a: AdfMark, b: AdfMark): number =>
    (MARK_RANK[a.type] ?? 9) - (MARK_RANK[b.type] ?? 9);

// No mark type is added twice: the outer one wins.
function withMark(marks: readonly AdfMark[], mark: AdfMark): readonly AdfMark[] {
    if (marks.some(m => m.type === mark.type)) return marks;
    return [...marks, mark].sort(byRank);
}

function linkMark(href: string, title: string | null | undefined): AdfMark {
    return { type: 'link', attrs: title ? { href, title } : { href } };
}

function sameMarks(a: readonly AdfMark[], b: readonly AdfMark[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((mark, k) => {
        const other = b[k];
        return (
            mark.type === other.type &&
            mark.attrs?.href === other.attrs?.href &&
            mark.attrs?.title === other.attrs?.title
        );
    });
}

// Appends text, merging it into the previous text node when the marks are equal. Empty text is
// never emitted.
function pushText(out: AdfNode[], text: string, marks: readonly AdfMark[]): void {
    if (text === '') return;
    const last = out[out.length - 1];
    if (last?.type === 'text' && sameMarks(last.marks ?? NO_MARKS, marks)) {
        last.text = (last.text ?? '') + text;
        return;
    }
    const node: AdfNode = { type: 'text', text };
    if (marks.length > 0) {
        // Each node gets its own mark objects, so no two nodes share mutable attributes.
        node.marks = marks.map(mark =>
            mark.attrs ? { type: mark.type, attrs: { ...mark.attrs } } : { type: mark.type },
        );
    }
    out.push(node);
}

// Source text with its line endings as hard breaks, which never carry marks.
function pushSourceLines(out: AdfNode[], text: string, marks: readonly AdfMark[]): void {
    const lines = text.split('\n');
    pushText(out, lines[0], marks);
    for (let k = 1; k < lines.length; k++) {
        out.push({ type: 'hardBreak' });
        pushText(out, lines[k], marks);
    }
}

// With `breaks`, marked turns every newline in inline text into a `br` token, except one that is
// followed only by whitespace up to the end of the paragraph or link text. A line there that
// holds only spaces and tabs is blank, so it ends the paragraph; any other line (such as a
// U+00A0) follows a hard break without its indentation.
function pushTextLines(out: AdfNode[], text: string, marks: readonly AdfMark[]): void {
    if (!text.includes('\n')) {
        pushText(out, text, marks);
        return;
    }
    const lines = text.split('\n');
    pushText(out, lines[0], marks);
    for (let k = 1; k < lines.length; k++) {
        const line = trimSpacesAndTabs(lines[k]);
        if (line === '') continue;
        out.push({ type: 'hardBreak' });
        pushText(out, line, marks);
    }
}

function mapInline(
    tokens: readonly Token[],
    marks: readonly AdfMark[] = NO_MARKS,
    out: AdfNode[] = [],
): AdfNode[] {
    for (const token of tokens) {
        switch (token.type) {
            case 'text': {
                const text = token as Tokens.Text;
                if (text.tokens && text.tokens.length > 0) mapInline(text.tokens, marks, out);
                else pushTextLines(out, text.text, marks);
                break;
            }
            case 'escape':
                pushText(out, (token as Tokens.Escape).text, marks);
                break;
            case 'strong':
                mapInline((token as Tokens.Strong).tokens, withMark(marks, STRONG), out);
                break;
            case 'em':
                mapInline((token as Tokens.Em).tokens, withMark(marks, EM), out);
                break;
            case 'del':
                mapInline((token as Tokens.Del).tokens, withMark(marks, STRIKE), out);
                break;
            case 'codespan': {
                // `code` combines only with `link`: other inherited marks are dropped here.
                const codeMarks = [CODE, ...marks.filter(mark => mark.type === 'link')].sort(
                    byRank,
                );
                pushText(out, (token as Tokens.Codespan).text, codeMarks);
                break;
            }
            case 'br':
                out.push({ type: 'hardBreak' });
                break;
            case 'link':
            case 'image':
                mapLink(token as Tokens.Link | Tokens.Image, marks, out);
                break;
            case 'checkbox': // a loose task item's checkbox, read by mapListItem
                break;
            default:
                // Inline HTML (design D8) and any token this mapper does not know: keep the source.
                pushSourceLines(out, token.raw, marks);
        }
    }
    return out;
}

// A link, or an image as its alt text linking to the image. Inside a link, the outer link wins.
// When nothing carries the link (empty link text or alt text), the URL becomes the text.
function mapLink(
    token: Tokens.Link | Tokens.Image,
    marks: readonly AdfMark[],
    out: AdfNode[],
): void {
    const linked = marks.some(mark => mark.type === 'link')
        ? marks
        : withMark(marks, linkMark(token.href, token.title));
    const inner = mapInline(token.tokens, linked);
    if (!inner.some(node => node.type === 'text')) pushText(inner, token.href, linked);
    for (const node of inner) {
        if (node.type === 'text') pushText(out, node.text ?? '', node.marks ?? NO_MARKS);
        else out.push(node);
    }
}

// --- Entry point ----------------------------------------------------------------------------------

// Swaps the sentinels back to U+2028 / U+2029 in every emitted string: text, code body, language,
// href and title.
function restoreSeparators(nodes: AdfNode[], sentinels: Sentinels): void {
    const restore = (value: string): string =>
        value
            .replaceAll(sentinels.lineSeparator, LINE_SEPARATOR)
            .replaceAll(sentinels.paragraphSeparator, PARAGRAPH_SEPARATOR);
    for (const node of nodes) {
        if (node.text !== undefined) node.text = restore(node.text);
        const language = node.attrs?.language;
        if (node.attrs && typeof language === 'string') node.attrs.language = restore(language);
        for (const mark of node.marks ?? []) {
            if (typeof mark.attrs?.href === 'string') mark.attrs.href = restore(mark.attrs.href);
            if (typeof mark.attrs?.title === 'string') mark.attrs.title = restore(mark.attrs.title);
        }
        if (node.content) restoreSeparators(node.content, sentinels);
    }
}

// The text as written, nothing interpreted: a paragraph for each run of non-blank lines, with a
// hard break between its lines.
function literalDocument(text: string): AdfDocument {
    const content: AdfNode[] = [];
    const lines = text.split('\n');
    for (let start = 0; start < lines.length;) {
        let end = start;
        while (end < lines.length && !BLANK_LINE.test(lines[end])) end++;
        if (end > start) content.push(sourceParagraph(lines.slice(start, end).join('\n')));
        start = end + 1;
    }
    return { type: 'doc', version: 1, content };
}

/** Converts markdown to an ADF document. */
export function markdownToAdf(text: string): AdfDocument {
    const normalized = normalizeInput(text);
    // Sentinels are picked only when there is a separator to swap, so an input
    // without U+2028 / U+2029 never fails for lack of a free noncharacter.
    const hasSeparators =
        normalized.includes(LINE_SEPARATOR) || normalized.includes(PARAGRAPH_SEPARATOR);
    const sentinels = hasSeparators ? pickSentinels(normalized) : undefined;
    const source = sentinels
        ? normalized
              .replaceAll(LINE_SEPARATOR, sentinels.lineSeparator)
              .replaceAll(PARAGRAPH_SEPARATOR, sentinels.paragraphSeparator)
        : normalized;

    nesting = 0;
    quoteWorkLeft = QUOTE_WORK_MINIMUM + QUOTE_WORK_PER_CHARACTER * source.length;
    const content: AdfNode[] = [];
    try {
        mapBlocks(markdown.lexer(source), 'document', content);
        if (sentinels) restoreSeparators(content, sentinels);
    } catch (error) {
        // Input nested past the limits above, or deeply enough to overflow the stack anyway
        // (such as inline emphasis), is kept as written.
        if (error instanceof RangeError || error instanceof NestingTooDeep) {
            return literalDocument(normalized);
        }
        throw error;
    }
    return { type: 'doc', version: 1, content };
}
