/**
 * Client-side resolution-state filters for Bitbucket PR comments and tasks.
 *
 * Kept separate from the formatters (which render to strings) because these are
 * pure data transforms over the already-drained page set. Filtering happens
 * client-side rather than via the API `q` param: resolution lives on a thread's
 * root comment, and only a client-side walk can keep a resolved root together
 * with its replies (which carry no `resolution` of their own).
 */

import type { BitbucketComment, BitbucketTask } from './types.ts';

export type ResolutionFilter = 'resolved' | 'unresolved';

/**
 * Map the mutually-exclusive `--resolved` / `--unresolved` flags to a filter,
 * or `undefined` when neither is set. Assumes the caller has already rejected
 * the both-set case.
 */
export function resolutionFilterFromFlags(
    resolved?: boolean,
    unresolved?: boolean,
): ResolutionFilter | undefined {
    if (resolved) return 'resolved';
    if (unresolved) return 'unresolved';
    return undefined;
}

/**
 * Filter comments by the resolution state of their thread.
 *
 * Resolution is a thread property carried only on the thread's top-level
 * comment; replies never carry their own `resolution`. Filtering therefore
 * keeps or drops whole threads by their root: a comment survives iff its
 * top-level ancestor's resolution presence matches `filter`, so the replies of
 * a surviving thread are retained and the rendered tree stays intact.
 *
 * Returns the input array unchanged when `filter` is `undefined`.
 */
export function filterCommentsByResolution(
    comments: BitbucketComment[],
    filter: ResolutionFilter | undefined,
): BitbucketComment[] {
    if (!filter) return comments;

    const byId = new Map<number, BitbucketComment>();
    for (const c of comments) byId.set(c.id, c);

    // Walk `parent.id` up to the thread's top-level ancestor. Guard against
    // cyclic or missing parent references: a visited-set bounds any loop, and a
    // parent id absent from the fetched set makes the nearest reachable comment
    // the effective root rather than crashing.
    const rootOf = (comment: BitbucketComment): BitbucketComment => {
        const seen = new Set<number>();
        let current = comment;
        while (current.parent?.id !== undefined) {
            if (seen.has(current.id)) break;
            seen.add(current.id);
            const parent = byId.get(current.parent.id);
            if (parent === undefined) break;
            current = parent;
        }
        return current;
    };

    const wantResolved = filter === 'resolved';
    return comments.filter(c => (rootOf(c).resolution != null) === wantResolved);
}

/**
 * Filter tasks by their resolution state. Tasks carry per-task `state` with no
 * nesting, so this is a flat match. Returns the input unchanged when `filter`
 * is `undefined`.
 */
export function filterTasksByResolution(
    tasks: BitbucketTask[],
    filter: ResolutionFilter | undefined,
): BitbucketTask[] {
    if (!filter) return tasks;
    const wantState = filter === 'resolved' ? 'RESOLVED' : 'UNRESOLVED';
    return tasks.filter(t => t.state === wantState);
}
