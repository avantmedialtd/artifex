/**
 * Bitbucket Cloud API response types.
 * See https://developer.atlassian.com/cloud/bitbucket/rest/.
 */

export interface BitbucketUser {
    type: 'user';
    account_id: string;
    nickname?: string;
    display_name: string;
    uuid?: string;
}

export interface BitbucketBranch {
    name: string;
    target?: { hash: string };
}

export interface BitbucketRepository {
    name: string;
    full_name: string;
    uuid?: string;
    mainbranch?: { name: string; type?: string };
    workspace?: { slug: string; name?: string };
}

export type BitbucketPullRequestState = 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';

export interface BitbucketPullRequestEndpoint {
    branch: { name: string };
    commit?: { hash: string };
    repository?: { full_name: string };
}

export interface BitbucketParticipant {
    user: BitbucketUser;
    role: 'PARTICIPANT' | 'REVIEWER';
    approved: boolean;
    state?: 'approved' | 'changes_requested' | null;
}

export interface BitbucketPullRequest {
    id: number;
    title: string;
    description?: string;
    state: BitbucketPullRequestState;
    draft?: boolean;
    author: BitbucketUser;
    source: BitbucketPullRequestEndpoint;
    destination: BitbucketPullRequestEndpoint;
    reviewers?: BitbucketUser[];
    participants?: BitbucketParticipant[];
    created_on: string;
    updated_on: string;
    links?: { html?: { href: string } };
}

export interface BitbucketCommentInline {
    path: string;
    to?: number | null;
    from?: number | null;
}

/**
 * Resolution state of a comment thread. Present (non-null) when the thread has
 * been resolved; absent or null when the thread is open. Field shape confirmed
 * against the Bitbucket Cloud REST API docs (`pullrequest_comment_resolution`);
 * see the resolve/reopen note in `client.ts`.
 */
export interface BitbucketCommentResolution {
    type?: string;
    user?: BitbucketUser;
    created_on?: string;
}

export interface BitbucketComment {
    id: number;
    content: { raw: string; markup?: string; html?: string };
    user: BitbucketUser;
    created_on: string;
    updated_on: string;
    deleted?: boolean;
    inline?: BitbucketCommentInline;
    parent?: { id: number };
    pullrequest?: { id: number };
    resolution?: BitbucketCommentResolution | null;
}

export type BitbucketTaskState = 'RESOLVED' | 'UNRESOLVED';

/**
 * Bitbucket Cloud PR task. The Atlassian docs are sparse on tasks; the shape
 * below reflects what the REST API returns and accepts based on observed
 * behaviour against the live API. The `state` field is mutated via PUT to
 * resolve/unresolve. The `comment` link is present when a task is anchored
 * to a specific comment.
 */
export interface BitbucketTask {
    id: number;
    content: { raw: string; markup?: string; html?: string };
    state: BitbucketTaskState;
    creator: BitbucketUser;
    created_on: string;
    updated_on: string;
    resolved_on?: string;
    resolved_by?: BitbucketUser;
    comment?: { id: number };
}

export type BitbucketPipelineState =
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'SUCCESSFUL'
    | 'FAILED'
    | 'STOPPED'
    | 'ERROR'
    | 'PAUSED'
    | 'HALTED'
    | 'EXPIRED';

export interface BitbucketPipelineTarget {
    type?: string;
    ref_type?: 'branch' | 'tag';
    ref_name?: string;
    commit?: { hash: string; type?: string };
    selector?: { type: 'default' | 'custom' | 'branches' | 'tags'; pattern?: string };
}

export interface BitbucketPipelineVariable {
    key: string;
    value: string;
    secured?: boolean;
}

export interface BitbucketPipelineStateInfo {
    name: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'STOPPED' | 'PAUSED' | 'HALTED';
    type?: string;
    result?: { name: 'SUCCESSFUL' | 'FAILED' | 'ERROR' | 'STOPPED' | 'EXPIRED'; type?: string };
}

export interface BitbucketPipeline {
    uuid: string;
    build_number: number;
    state: BitbucketPipelineStateInfo;
    target: BitbucketPipelineTarget;
    creator?: BitbucketUser;
    created_on: string;
    completed_on?: string;
    duration_in_seconds?: number;
    build_seconds_used?: number;
    repository?: { full_name: string };
}

export interface BitbucketPipelineStep {
    uuid: string;
    name?: string;
    state: BitbucketPipelineStateInfo;
    started_on?: string;
    completed_on?: string;
    duration_in_seconds?: number;
    pipeline?: { uuid: string };
}

export interface BitbucketWorkspaceMember {
    user: BitbucketUser;
    workspace?: { slug: string };
}

// --- Read surface: account, refs, commits, source, statuses, activity ---

/** The authenticated account, as returned by `GET /user`. */
export interface BitbucketAccount {
    type?: string;
    account_id: string;
    nickname?: string;
    display_name: string;
    username?: string;
    uuid?: string;
    created_on?: string;
}

/** A commit object as returned by the commits/commit endpoints. */
export interface BitbucketCommit {
    hash: string;
    message?: string;
    date?: string;
    author?: { raw?: string; user?: BitbucketUser };
    summary?: { raw?: string };
    parents?: { hash: string }[];
}

/** A tag ref under `…/refs/tags`. */
export interface BitbucketTag {
    name: string;
    target?: { hash: string; date?: string };
    message?: string;
    date?: string;
    tagger?: { raw?: string; user?: BitbucketUser };
}

/** One entry of a `…/diffstat/{spec}` response. */
export interface BitbucketDiffStatEntry {
    type?: string;
    status: 'added' | 'removed' | 'modified' | 'renamed' | string;
    lines_added: number;
    lines_removed: number;
    old?: { path: string } | null;
    new?: { path: string } | null;
}

export type BitbucketCommitStatusState = 'INPROGRESS' | 'SUCCESSFUL' | 'FAILED' | 'STOPPED';

/** A build/commit status, as returned by `…/pullrequests/{id}/statuses`. */
export interface BitbucketCommitStatus {
    type?: string;
    key: string;
    name?: string;
    description?: string;
    state: BitbucketCommitStatusState;
    url?: string;
    refname?: string;
    commit?: { hash: string };
    created_on?: string;
    updated_on?: string;
}

/** One entry of a `…/src/{ref}/{path}/` directory listing. */
export interface BitbucketSrcEntry {
    type: 'commit_file' | 'commit_directory';
    path: string;
    size?: number;
    mimetype?: string | null;
    commit?: { hash: string };
    attributes?: string[];
}

/** One entry of a `…/pullrequests/{id}/activity` feed (only one sub-key is set). */
export interface BitbucketActivityEntry {
    update?: {
        state?: string;
        date?: string;
        author?: BitbucketUser;
        title?: string;
        reason?: string;
    };
    approval?: { date?: string; user?: BitbucketUser };
    changes_requested?: { date?: string; user?: BitbucketUser };
    comment?: BitbucketComment;
    pull_request?: { id: number; title?: string };
}

export interface BitbucketPaginated<T> {
    values?: T[];
    next?: string;
    previous?: string;
    page?: number;
    pagelen?: number;
    size?: number;
}

export interface BitbucketCreatePullRequestRequest {
    title: string;
    description?: string;
    source: { branch: { name: string } };
    destination?: { branch: { name: string } };
    reviewers?: { account_id: string }[];
    close_source_branch?: boolean;
    draft?: boolean;
}

export interface BitbucketUpdatePullRequestRequest {
    title?: string;
    description?: string;
    reviewers?: { account_id: string }[];
}

export interface BitbucketCreateCommentRequest {
    content: { raw: string };
    inline?: { path: string; to?: number; from?: number };
    parent?: { id: number };
}

export interface BitbucketCreateTaskRequest {
    content: { raw: string };
    comment?: { id: number };
}

export interface BitbucketUpdateTaskRequest {
    content?: { raw: string };
    state?: BitbucketTaskState;
}

export interface BitbucketMergeRequest {
    type?: string;
    message?: string;
    close_source_branch?: boolean;
    merge_strategy?: 'merge_commit' | 'squash' | 'fast_forward';
}

export interface BitbucketTriggerPipelineRequest {
    target: BitbucketPipelineTarget & { type?: string };
    variables?: BitbucketPipelineVariable[];
}
