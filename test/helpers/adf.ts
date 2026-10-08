// cspell:words noncharacters
// Test-only ADF helpers, kept outside the published atlassian/** glob:
// - validateAdf checks a document against the vendored ADF JSON schema;
// - summarizeAdf prints the outline notation used by the converter corpus;
// - adfProblems lists the output guarantees a document breaks.
import { readFileSync } from 'node:fs';
import AjvDraft04, { type ErrorObject } from 'ajv-draft-04';
import type { AdfDocument, AdfNode } from '../../atlassian/lib/adf-types.ts';

// The package is CommonJS: its export is the class and also carries `default`.
const Ajv = AjvDraft04.default;
const schema = JSON.parse(
    readFileSync(new URL('../fixtures/adf-schema-full.json', import.meta.url), 'utf8'),
);
const validate = new Ajv({ allErrors: true, strictTuples: false }).compile(schema);

/** Returns the schema errors for a document, or null when it is valid ADF. */
export function validateAdf(doc: unknown): ErrorObject[] | null {
    return validate(doc) ? null : [...(validate.errors ?? [])];
}

const q = (s: string) => JSON.stringify(s);

/**
 * The outline notation of
 * `openspec/changes/archive/2026-10-08-replace-markdown-adf-converter/audit-corpus.md`.
 */
export function summarizeAdf(node: AdfNode | AdfDocument): string {
    const n = node as AdfNode;
    const kids = (sep = ', ') => (n.content ?? []).map(summarizeAdf).join(sep);
    switch (n.type) {
        case 'doc':
            return kids(' | ');
        case 'paragraph':
            return `p[${kids()}]`;
        case 'heading':
            return `h${n.attrs?.level}[${kids()}]`;
        case 'bulletList':
            return `ul[${kids()}]`;
        case 'orderedList':
            return `ol${n.attrs?.order !== undefined ? `(start=${n.attrs.order})` : ''}[${kids()}]`;
        case 'listItem':
            return `li[${kids()}]`;
        case 'codeBlock': {
            const body = (n.content ?? []).map(child => child.text ?? '').join('');
            return `codeBlock(${n.attrs?.language ?? ''})${q(body)}`;
        }
        case 'blockquote':
            return `quote[${kids()}]`;
        case 'rule':
            return 'hr';
        case 'hardBreak':
            return '⏎';
        case 'table':
            return `table[${kids('; ')}]`;
        case 'tableRow':
            return `row[${kids()}]`;
        case 'tableHeader':
            return `th[${kids()}]`;
        case 'tableCell':
            return `td[${kids()}]`;
        case 'text': {
            const marks = (n.marks ?? [])
                .map(m => {
                    if (m.type !== 'link') return m.type;
                    const title = m.attrs?.title ? ` "${m.attrs.title}"` : '';
                    return `link<${m.attrs?.href}${title}>`;
                })
                .sort();
            return marks.length ? `${marks.join('+')}:${q(n.text ?? '')}` : q(n.text ?? '');
        }
        default:
            return `${n.type}${n.attrs ? JSON.stringify(n.attrs) : ''}${n.content ? `[${kids()}]` : ''}`;
    }
}

// The noncharacters the mapper may use as sentinels for U+2028 / U+2029.
const SENTINEL_FIRST = 0xfdd0;
const SENTINEL_LAST = 0xfdef;

// Every code point an input contains, literally or as a numeric reference.
function codePointsIn(input: string): Set<number> {
    const points = new Set<number>();
    for (const char of input) points.add(char.codePointAt(0) as number);
    for (const m of input.matchAll(/&#(?:[xX]([0-9a-fA-F]+)|([0-9]+));/g)) {
        points.add(m[1] !== undefined ? parseInt(m[1], 16) : parseInt(m[2], 10));
    }
    return points;
}

/**
 * Lists the output guarantees a document breaks: empty text nodes, a carriage
 * return in text, a text node carrying the same mark type twice, a hardBreak
 * with marks, and (when `input` is given) a leaked sentinel, i.e. a code point
 * in U+FDD0-U+FDEF that the input does not contain.
 */
export function adfProblems(doc: AdfDocument, input?: string): string[] {
    const problems: string[] = [];
    const inputPoints = input === undefined ? undefined : codePointsIn(input);

    const visit = (node: AdfNode, path: string): void => {
        if (node.type === 'text') {
            const text = node.text ?? '';
            if (text === '') problems.push(`${path}: empty text node`);
            if (text.includes('\r')) problems.push(`${path}: carriage return in text`);
            if (inputPoints) {
                for (const char of text) {
                    const point = char.codePointAt(0) as number;
                    if (
                        point >= SENTINEL_FIRST &&
                        point <= SENTINEL_LAST &&
                        !inputPoints.has(point)
                    ) {
                        problems.push(
                            `${path}: leaked sentinel U+${point.toString(16).toUpperCase()}`,
                        );
                    }
                }
            }
            const types = (node.marks ?? []).map(m => m.type);
            if (new Set(types).size !== types.length) {
                problems.push(`${path}: duplicate mark type (${types.join(', ')})`);
            }
        }
        if (node.type === 'hardBreak' && node.marks?.length) {
            problems.push(`${path}: hardBreak with marks`);
        }
        node.content?.forEach((child, i) => visit(child, `${path}/${i}`));
    };

    doc.content.forEach((node, i) => visit(node, `/${i}`));
    return problems;
}
