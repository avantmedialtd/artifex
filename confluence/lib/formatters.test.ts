import { describe, it, expect } from 'vitest';
import { formatAttachments } from './formatters.ts';
import type { ConfluenceAttachment } from './types.ts';

function attachment(id: string, title: string, fileSize: number): ConfluenceAttachment {
    return { id, status: 'current', title, mediaType: 'image/png', fileSize };
}

describe('formatAttachments', () => {
    it('shows each attachment ID, so one can be downloaded by it', () => {
        const out = formatAttachments('12345', {
            results: [
                attachment('att12345678', 'diagram.png', 38_612),
                attachment('att87654321', 'tiny.png', 512),
            ],
        });
        expect(out).toBe(
            [
                '# Attachments on page 12345 (2)',
                '',
                '| ID | Filename | Size | Type |',
                '|----|----------|------|------|',
                '| att12345678 | diagram.png | 37.7 KB | image/png |',
                '| att87654321 | tiny.png | 512 B | image/png |',
            ].join('\n'),
        );
    });

    it('says when there are none', () => {
        expect(formatAttachments('12345', { results: [] })).toBe(
            '# Attachments on page 12345 (0)\n\nNo attachments.',
        );
    });
});
