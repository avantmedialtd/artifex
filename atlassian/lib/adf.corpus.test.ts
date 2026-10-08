// The converter regression corpus: agent-style markdown from the exploration audit
// (openspec/changes/archive/2026-10-08-replace-markdown-adf-converter/audit-corpus.md), copied
// unchanged to test/fixtures/adf-corpus.json with the outline textToAdf must produce for each
// input. The cases after the 66 audited ones were added for defects found in the implementation
// review.
//
// This pins the "Output is valid ADF" and "Converter output survives a round trip" scenarios of
// the Shared ADF conversion requirement. Each case must:
// - convert to its expected outline (the notation of summarizeAdf);
// - be valid against the vendored ADF JSON schema;
// - keep the output guarantees adfProblems checks: no empty or CR-bearing text, no duplicate mark
//   type, no hardBreak with marks and no leaked sentinel;
// - survive textToAdf -> adfToText -> textToAdf unchanged.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adfProblems, summarizeAdf, validateAdf } from '../../test/helpers/adf.ts';
import { adfToText, textToAdf } from './adf.ts';

interface CorpusCase {
    id: string;
    group: string;
    construct: string;
    input: string;
    expected: string;
    note?: string;
}

const corpus = JSON.parse(
    readFileSync(new URL('../../test/fixtures/adf-corpus.json', import.meta.url), 'utf8'),
) as CorpusCase[];

describe('converter regression corpus', () => {
    it('should hold the 66 audited cases and the review cases, each with its own id', () => {
        expect(corpus).toHaveLength(72);
        expect(new Set(corpus.map(({ id }) => id)).size).toBe(corpus.length);
    });

    for (const { id, group, construct, input, expected } of corpus) {
        describe(`${id} (${group}: ${construct})`, () => {
            it('should convert to the expected outline', () => {
                expect(summarizeAdf(textToAdf(input))).toBe(expected);
            });

            it('should convert to valid ADF', () => {
                expect(validateAdf(textToAdf(input))).toBeNull();
            });

            it('should keep the output guarantees', () => {
                expect(adfProblems(textToAdf(input), input)).toEqual([]);
            });

            it('should survive adfToText and textToAdf unchanged', () => {
                const adf = textToAdf(input);
                expect(textToAdf(adfToText(adf))).toStrictEqual(adf);
            });
        });
    }
});
