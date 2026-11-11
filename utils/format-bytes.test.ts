import { describe, it, expect } from 'vitest';
import { formatBytes } from './format-bytes.ts';

describe('formatBytes', () => {
    it.each([
        [0, '0 B'],
        [1023, '1023 B'],
        [1024, '1.0 KB'],
        // The two attachments the spec scenarios name.
        [38_612, '37.7 KB'],
        [26_904, '26.3 KB'],
        [1024 * 1024, '1.0 MB'],
        [5_452_595, '5.2 MB'],
        [1536 * 1024 * 1024, '1536.0 MB'],
    ])('formats %d bytes as %s', (bytes, expected) => {
        expect(formatBytes(bytes)).toBe(expected);
    });
});
