// Child-process fixture for the textToAdf hang tests in atlassian/lib/adf.test.ts.
// It reads one JSON-encoded string from stdin, so a leading BOM, CR, U+2028 and
// U+2029 arrive exactly, converts it, and writes the ADF document as JSON.
import { readFileSync } from 'node:fs';
import { textToAdf } from '../../atlassian/lib/adf.ts';

const input: unknown = JSON.parse(readFileSync(0, 'utf8'));
if (typeof input !== 'string') {
    throw new Error('Expected a JSON-encoded string on stdin');
}
process.stdout.write(JSON.stringify(textToAdf(input)));
