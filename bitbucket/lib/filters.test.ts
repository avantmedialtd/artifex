import { describe, it, expect } from 'vitest';
import {
    filterCommentsByResolution,
    filterTasksByResolution,
    resolutionFilterFromFlags,
} from './filters.ts';
import type { BitbucketComment, BitbucketTask } from './types.ts';

const fakeUser = {
    type: 'user' as const,
    account_id: 'acct1',
    nickname: 'alice',
    display_name: 'Alice',
};

// Build a comment with the minimum required fields; overrides layer on top.
function comment(id: number, overrides: Partial<BitbucketComment> = {}): BitbucketComment {
    return {
        id,
        content: { raw: `comment ${id}` },
        user: fakeUser,
        created_on: '2025-01-01T00:00:00Z',
        updated_on: '2025-01-01T00:00:00Z',
        ...overrides,
    };
}

const resolution = {
    type: 'pullrequest_comment_resolution',
    user: fakeUser,
    created_on: '2025-01-03T00:00:00Z',
};

function task(id: number, state: BitbucketTask['state']): BitbucketTask {
    return {
        id,
        content: { raw: `task ${id}` },
        state,
        creator: fakeUser,
        created_on: '2025-01-01T00:00:00Z',
        updated_on: '2025-01-01T00:00:00Z',
    };
}

describe('resolutionFilterFromFlags', () => {
    it('maps flags to a filter, defaulting to undefined', () => {
        expect(resolutionFilterFromFlags(true, false)).toBe('resolved');
        expect(resolutionFilterFromFlags(false, true)).toBe('unresolved');
        expect(resolutionFilterFromFlags(false, false)).toBeUndefined();
        expect(resolutionFilterFromFlags(undefined, undefined)).toBeUndefined();
    });
});

describe('filterCommentsByResolution', () => {
    it('returns the input unchanged when the filter is undefined', () => {
        const comments = [comment(1, { resolution }), comment(2)];
        expect(filterCommentsByResolution(comments, undefined)).toBe(comments);
    });

    it('keeps a resolved root together with its replies under --resolved', () => {
        const comments = [
            comment(1, { resolution }),
            comment(2, { parent: { id: 1 } }),
            comment(3, { parent: { id: 1 } }),
        ];
        const out = filterCommentsByResolution(comments, 'resolved');
        expect(out.map(c => c.id)).toEqual([1, 2, 3]);
    });

    it('keeps an open root together with its replies under --unresolved', () => {
        const comments = [
            comment(1),
            comment(2, { parent: { id: 1 } }),
            comment(3, { parent: { id: 1 } }),
        ];
        const out = filterCommentsByResolution(comments, 'unresolved');
        expect(out.map(c => c.id)).toEqual([1, 2, 3]);
    });

    it('drops open threads under --resolved and resolved threads under --unresolved', () => {
        const comments = [
            comment(1, { resolution }), // resolved root
            comment(2, { parent: { id: 1 } }),
            comment(3), // open root
            comment(4, { parent: { id: 3 } }),
        ];
        expect(filterCommentsByResolution(comments, 'resolved').map(c => c.id)).toEqual([1, 2]);
        expect(filterCommentsByResolution(comments, 'unresolved').map(c => c.id)).toEqual([3, 4]);
    });

    it('resolves a deeply nested reply to its top-level root', () => {
        // 1 (resolved) → 2 → 3 ; the grandchild inherits the root's state.
        const comments = [
            comment(1, { resolution }),
            comment(2, { parent: { id: 1 } }),
            comment(3, { parent: { id: 2 } }),
        ];
        expect(filterCommentsByResolution(comments, 'resolved').map(c => c.id)).toEqual([1, 2, 3]);
        expect(filterCommentsByResolution(comments, 'unresolved')).toEqual([]);
    });

    it('filters a deleted root by its own resolution', () => {
        const comments = [
            comment(1, { deleted: true, resolution }),
            comment(2, { parent: { id: 1 } }),
        ];
        expect(filterCommentsByResolution(comments, 'resolved').map(c => c.id)).toEqual([1, 2]);
        expect(filterCommentsByResolution(comments, 'unresolved')).toEqual([]);
    });

    it('treats a reply with a missing parent as its own root without looping', () => {
        // Parent id 99 is not in the set; the reply is the nearest reachable
        // root and has no resolution, so it counts as open.
        const orphan = comment(2, { parent: { id: 99 } });
        expect(filterCommentsByResolution([orphan], 'unresolved')).toEqual([orphan]);
        expect(filterCommentsByResolution([orphan], 'resolved')).toEqual([]);
    });

    it('does not loop on a cyclic parent chain', () => {
        const a = comment(1, { parent: { id: 2 } });
        const b = comment(2, { parent: { id: 1 } });
        // The walk is bounded; the exact root is arbitrary but must terminate.
        expect(() => filterCommentsByResolution([a, b], 'unresolved')).not.toThrow();
        expect(filterCommentsByResolution([a, b], 'unresolved').length).toBe(2);
    });
});

describe('filterTasksByResolution', () => {
    const tasks = [task(1, 'UNRESOLVED'), task(2, 'RESOLVED'), task(3, 'UNRESOLVED')];

    it('returns the input unchanged when the filter is undefined', () => {
        expect(filterTasksByResolution(tasks, undefined)).toBe(tasks);
    });

    it('keeps only resolved tasks under --resolved', () => {
        expect(filterTasksByResolution(tasks, 'resolved').map(t => t.id)).toEqual([2]);
    });

    it('keeps only unresolved tasks under --unresolved', () => {
        expect(filterTasksByResolution(tasks, 'unresolved').map(t => t.id)).toEqual([1, 3]);
    });
});
