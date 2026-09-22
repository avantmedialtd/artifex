/**
 * Pure summarizers for the review and merge-signal cells of the `pr list` /
 * `pr mine` tables, plus the grouping of signal fetch failures into warnings.
 *
 * Kept apart from the formatters (which only lay out cells) and the client
 * (which only fetches), mirroring `filters.ts`. Signals are informational:
 * nothing here decides whether a pull request can be merged, because Bitbucket
 * Cloud has no public merge-check API.
 */

import type {
    BitbucketCommitStatus,
    BitbucketCommitStatusState,
    BitbucketConflict,
    BitbucketPaginated,
    BitbucketPullRequest,
    BitbucketUser,
    PullRequestSignals,
} from './types.ts';

// --- Review -------------------------------------------------------------

export interface ReviewSummary {
    /** Participants who approved, excluding the author. */
    approvals: number;
    /** Participants who requested changes, excluding the author. */
    changesRequested: number;
    /** Reviewers who have neither approved nor requested changes. */
    pending: number;
}

/** Whether two users are the same account: by `account_id`, falling back to `uuid`. */
function sameAccount(a: BitbucketUser, b: BitbucketUser): boolean {
    if (a.account_id && b.account_id) return a.account_id === b.account_id;
    return Boolean(a.uuid) && a.uuid === b.uuid;
}

/**
 * Summarize a pull request's review state, or return `null` when the response
 * carried no `participants`, so "unknown" stays distinct from "none".
 *
 * The author's own approval does not count toward Bitbucket's minimum-approvals
 * check, so the author is excluded from approvals and change requests. Pending
 * is based on `reviewers[]`, so participants who only commented never count.
 */
export function summarizeReview(pr: BitbucketPullRequest): ReviewSummary | null {
    const participants = pr.participants;
    if (!participants) return null;
    const others = participants.filter(p => !sameAccount(p.user, pr.author));
    const responded = participants.filter(
        p => p.approved === true || p.state === 'changes_requested',
    );
    return {
        approvals: others.filter(p => p.approved === true).length,
        changesRequested: others.filter(p => p.state === 'changes_requested').length,
        pending: (pr.reviewers ?? []).filter(r => !responded.some(p => sameAccount(p.user, r)))
            .length,
    };
}

// --- Builds -------------------------------------------------------------

export type BuildState = 'failed' | 'stopped' | 'running' | 'passed' | 'none';

export interface BuildSummary {
    state: BuildState;
    /** Number of head-commit statuses in `state`; 0 for `none`. */
    count: number;
}

/** First status state present wins, so any FAILED outranks everything else. */
const BUILD_PRECEDENCE: [BitbucketCommitStatusState, BuildState][] = [
    ['FAILED', 'failed'],
    ['STOPPED', 'stopped'],
    ['INPROGRESS', 'running'],
    ['SUCCESSFUL', 'passed'],
];

/** Whether two hashes name the same commit: the shorter must be a prefix of the longer. */
function sameCommit(a: string, b: string): boolean {
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
    return longer.startsWith(shorter);
}

/**
 * Summarize the build statuses of a pull request's source head commit, the only
 * commit Bitbucket's builds check looks at (`…/statuses` covers every commit).
 *
 * With `headHash` unknown, all statuses are used. Otherwise each status is judged
 * on its own: it is kept when its commit prefix-matches `headHash` (list responses
 * carry a short hash, statuses the full one) or when it carries no commit.
 */
export function summarizeBuilds(
    statuses: BitbucketCommitStatus[],
    headHash: string | undefined,
): BuildSummary {
    const onHead = headHash
        ? statuses.filter(s => !s.commit?.hash || sameCommit(s.commit.hash, headHash))
        : statuses;
    for (const [statusState, state] of BUILD_PRECEDENCE) {
        const count = onHead.filter(s => s.state === statusState).length;
        if (count > 0) return { state, count };
    }
    return { state: 'none', count: 0 };
}

// --- Conflicts ----------------------------------------------------------

export interface ConflictSummary {
    /** The page's `size` when present, else the number of entries on the page. */
    count: number;
    /** More conflicts may exist beyond `count`: a `next` page without a `size`. */
    more: boolean;
}

/**
 * Summarize the first (and only fetched) page of `…/pullrequests/{id}/conflicts`.
 */
export function summarizeConflicts(page: BitbucketPaginated<BitbucketConflict>): ConflictSummary {
    if (typeof page.size === 'number') return { count: page.size, more: false };
    return { count: page.values?.length ?? 0, more: Boolean(page.next) };
}

// --- Fetch failures -----------------------------------------------------

const SIGNAL_NAMES: (keyof PullRequestSignals)[] = ['builds', 'conflicts'];

/** `HTTP 401: <message>`, without repeating a status the message already leads with. */
function describeFailure(status: number | undefined, message: string): string {
    const text = message.replace(/\s+/g, ' ').trim();
    if (status === undefined) return text || 'unknown error';
    const http = `HTTP ${status}`;
    if (!text) return http;
    return text.startsWith(http) ? text : `${http}: ${text}`;
}

/**
 * Group the signals that could not be fetched into stderr warning lines: one per
 * signal and cause (the HTTP status, else the error message), so 50 identical
 * failures produce one line. Each line counts the affected pull requests and
 * quotes a sample message. `null` entries (pull requests not checked) are ignored.
 */
export function groupSignalFailures(signals: (PullRequestSignals | null)[]): string[] {
    const lines: string[] = [];
    for (const name of SIGNAL_NAMES) {
        const groups = new Map<string, { count: number; status?: number; message: string }>();
        for (const entry of signals) {
            const result = entry?.[name];
            if (!result || !('error' in result)) continue;
            const { status, message } = result.error;
            const key = status === undefined ? `error:${message}` : `status:${status}`;
            const group = groups.get(key);
            if (group) group.count++;
            else groups.set(key, { count: 1, status, message });
        }
        for (const { count, status, message } of groups.values()) {
            const prs = count === 1 ? 'pull request' : 'pull requests';
            lines.push(
                `Warning: ${name} unavailable for ${count} ${prs} (${describeFailure(status, message)})`,
            );
        }
    }
    return lines;
}
