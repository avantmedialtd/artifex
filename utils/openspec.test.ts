import { describe, it, expect } from 'vitest';
import { parseOpenspecListOutput } from './openspec.ts';

describe('parseOpenspecListOutput', () => {
    it('should parse multiple changes with different statuses', () => {
        const output = `Changes:
  add-apply-interactive-select      0/8 tasks
  fix-extension-archive-refresh     3/8 tasks
  show-changes-titles               ✓ Complete`;

        const changes = parseOpenspecListOutput(output);

        expect(changes).toHaveLength(3);
        expect(changes[0]).toEqual({
            id: 'add-apply-interactive-select',
            status: '0/8 tasks',
        });
        expect(changes[1]).toEqual({
            id: 'fix-extension-archive-refresh',
            status: '3/8 tasks',
        });
        expect(changes[2]).toEqual({
            id: 'show-changes-titles',
            status: '✓ Complete',
        });
    });

    it('should return empty array for empty output', () => {
        const changes = parseOpenspecListOutput('');
        expect(changes).toHaveLength(0);
    });

    it('should return empty array for only header', () => {
        const output = 'Changes:';
        const changes = parseOpenspecListOutput(output);
        expect(changes).toHaveLength(0);
    });

    it('should handle single change', () => {
        const output = `Changes:
  my-single-change     ⚠ In Progress`;

        const changes = parseOpenspecListOutput(output);

        expect(changes).toHaveLength(1);
        expect(changes[0]).toEqual({
            id: 'my-single-change',
            status: '⚠ In Progress',
        });
    });

    it('should handle extra whitespace in lines', () => {
        const output = `Changes:
    padded-change        5/10 tasks  `;

        const changes = parseOpenspecListOutput(output);

        expect(changes).toHaveLength(1);
        expect(changes[0]).toEqual({
            id: 'padded-change',
            status: '5/10 tasks',
        });
    });

    it('should skip empty lines', () => {
        const output = `Changes:

  first-change     1/2 tasks

  second-change    2/2 tasks

`;

        const changes = parseOpenspecListOutput(output);

        expect(changes).toHaveLength(2);
        expect(changes[0].id).toBe('first-change');
        expect(changes[1].id).toBe('second-change');
    });
});
