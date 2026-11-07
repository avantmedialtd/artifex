/**
 * The body of the pull request PUT sent by `pr update`, `pr ready` and
 * `pr draft`, built from the fetched pull request and the requested changes.
 *
 * Kept out of `client.ts`, which `commands/bitbucket.test.ts` replaces with a
 * mock factory: like `filters.ts` and `signals.ts`, this is a pure helper that
 * the command imports directly.
 */

import type { BitbucketPullRequest, BitbucketUpdatePullRequestRequest } from './types.ts';

/** The changes asked for. A field left undefined is not changed. */
export interface PullRequestChanges {
    title?: string;
    /** An empty string clears the description. */
    description?: string;
    /** Replaces the whole reviewer list. */
    reviewerAccountIds?: string[];
    /** `false` marks a draft ready for review; `true` moves the pull request back to draft. */
    draft?: boolean;
}

export type PullRequestUpdate =
    | { kind: 'put'; body: BitbucketUpdatePullRequestRequest }
    /** `draft` was the only change, and the pull request is already in that state. */
    | { kind: 'noop'; state: 'ready' | 'draft' };

/**
 * Builds the PUT body, or reports a no-op when `draft` is the only change and
 * `current` is already in the requested state.
 *
 * == Resend set: title, description and reviewers, on every PUT ==
 *
 * The body always carries `title`, `description` and `reviewers`: the new value
 * of a field the user changed, otherwise its current value from `current`.
 * Reviewers are sent as `{ account_id }`. A pull request without a description
 * resends `''`, which is how Bitbucket represents an empty description, so the
 * body has the same shape every time. `draft` is sent only when it differs from
 * the current draft state.
 *
 * Nothing here is verified against Bitbucket. The sandbox spike that was to
 * observe how Bitbucket treats a pull request PUT that leaves fields out did
 * NOT run, because no Bitbucket credentials were available. On 2026-11-07 the
 * user chose the design's fallback instead: always resend title, description
 * and reviewers. These unverified reports motivate it:
 *
 *   - a PUT without `title` is rejected with HTTP 400 (two third-party tools
 *     resend the title for this reason);
 *   - a PUT without `reviewers` clears the reviewers (an Atlassian community
 *     thread). Marking a draft ready would then notify nobody.
 *
 * Nobody reported whether a PUT without `description` clears it, so it is
 * resent as well.
 *
 * The accepted risks of resending:
 *
 *   - an edit made in Bitbucket between the GET of `current` and this PUT is
 *     overwritten by the resent value of that field (the window is one round
 *     trip);
 *   - a resent reviewer list that contains an inactive user is rejected with
 *     "Malformed reviewers list" (BCLOUD-23093). The command then suggests
 *     passing `--reviewers` explicitly.
 *
 * A future sandbox spike (tasks 1.1 to 1.7 of the openspec change
 * add-bb-pr-draft-ready) may show that some unchanged fields can be left out.
 * Narrow the set here, in this one place.
 */
export function buildPullRequestUpdate(
    current: BitbucketPullRequest,
    changes: PullRequestChanges,
): PullRequestUpdate {
    const isDraft = Boolean(current.draft);
    const draftChanged = changes.draft !== undefined && changes.draft !== isDraft;
    const onlyDraft =
        changes.title === undefined &&
        changes.description === undefined &&
        changes.reviewerAccountIds === undefined;
    if (changes.draft !== undefined && !draftChanged && onlyDraft) {
        return { kind: 'noop', state: isDraft ? 'draft' : 'ready' };
    }

    const reviewerAccountIds =
        changes.reviewerAccountIds ?? (current.reviewers ?? []).map(user => user.account_id);
    const body: BitbucketUpdatePullRequestRequest = {
        title: changes.title ?? current.title,
        description: changes.description ?? current.description ?? '',
        reviewers: reviewerAccountIds.map(accountId => ({ account_id: accountId })),
    };
    if (draftChanged) body.draft = changes.draft;
    return { kind: 'put', body };
}
