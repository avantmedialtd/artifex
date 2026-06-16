/**
 * Bitbucket Cloud API client.
 *
 * Auth uses Bitbucket-specific credentials (BITBUCKET_USERNAME +
 * BITBUCKET_API_TOKEN), wired through `bitbucket/lib/request.ts`. Atlassian
 * API tokens scoped for Jira/Confluence are NOT accepted by Bitbucket Cloud
 * and return 401, so the bb wrappers carry their own Authorization header
 * built from the BITBUCKET_* env vars.
 *
 * Pagination uses the `bbPaginate` helper which follows the `next` URL until
 * absent. Plain-text endpoints (PR diff, pipeline logs) use `bbRequestText`.
 *
 * == Notes on undocumented behaviour ==
 *
 * Bitbucket Cloud's PR task API is sparsely documented. The shapes below
 * reflect what worked against the live API as of this change:
 *
 *   - Resolve a task: PUT /pullrequests/{id}/tasks/{tid} with body
 *     `{ state: "RESOLVED" | "UNRESOLVED" }`. The state field is a sibling of
 *     `content` rather than a separate /resolve endpoint.
 *
 *   - Link a task to a comment: include `{ comment: { id: <commentId> } }` in
 *     the POST body alongside `content`. Standalone tasks omit the field.
 *
 *   - Resolve/reopen a comment thread: unlike tasks, comments DO use a
 *     dedicated sub-resource. POST /pullrequests/{id}/comments/{cid}/resolve
 *     resolves the thread; DELETE on the same path reopens it. A resolved
 *     comment carries a `resolution` object (`pullrequest_comment_resolution`
 *     with `user` and `created_on`). Confirmed against the Bitbucket Cloud REST
 *     API docs; pending a live smoke-test (openspec change
 *     bitbucket-comment-resolve, tasks 1.x / 7.2).
 *
 * Both shapes were derived from observation; if the API behaviour changes,
 * see openspec/changes/add-bitbucket-support/tasks.md (sections 1.3 / 1.4)
 * for the verification recipe and update the field shape here.
 *
 * Reply comments are also lightly documented but work via the same comments
 * endpoint with `{ parent: { id } }` added to the body — see
 * https://community.developer.atlassian.com/t/replies-to-comments-using-api/60953.
 */

import { execSync } from 'node:child_process';
import {
    bbPaginate as paginate,
    bbRequest as request,
    bbRequestText as requestText,
} from './request.ts';
import type {
    BitbucketAccount,
    BitbucketActivityEntry,
    BitbucketBranch,
    BitbucketComment,
    BitbucketCommit,
    BitbucketCommitStatus,
    BitbucketCreateCommentRequest,
    BitbucketCreatePullRequestRequest,
    BitbucketCreateTaskRequest,
    BitbucketDiffStatEntry,
    BitbucketMergeRequest,
    BitbucketPipeline,
    BitbucketPipelineState,
    BitbucketPipelineStep,
    BitbucketPipelineVariable,
    BitbucketPullRequest,
    BitbucketPullRequestState,
    BitbucketRepository,
    BitbucketSrcEntry,
    BitbucketTag,
    BitbucketTask,
    BitbucketTaskState,
    BitbucketTriggerPipelineRequest,
    BitbucketUpdatePullRequestRequest,
    BitbucketUpdateTaskRequest,
    BitbucketWorkspaceMember,
} from './types.ts';

const API_BASE = 'https://api.bitbucket.org/2.0';

function repoUrl(workspace: string, repo: string): string {
    return `${API_BASE}/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}`;
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
    );
    if (entries.length === 0) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of entries) usp.append(k, String(v));
    return `?${usp.toString()}`;
}

/**
 * Read the current git branch via `git rev-parse --abbrev-ref HEAD`.
 * Used as the default source branch for PR creation.
 */
export function getCurrentBranch(): string | null {
    try {
        const out = execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const trimmed = out.trim();
        return trimmed && trimmed !== 'HEAD' ? trimmed : null;
    } catch {
        return null;
    }
}

// --- Repository ---------------------------------------------------------

export async function getRepository(workspace: string, repo: string): Promise<BitbucketRepository> {
    return request<BitbucketRepository>(repoUrl(workspace, repo));
}

// --- Pull requests ------------------------------------------------------

export interface ListPullRequestsOptions {
    state?: BitbucketPullRequestState | 'ALL';
    q?: string;
}

export async function listPullRequests(
    workspace: string,
    repo: string,
    opts: ListPullRequestsOptions = {},
): Promise<BitbucketPullRequest[]> {
    const params: Record<string, string> = {};
    if (opts.state && opts.state !== 'ALL') {
        params.state = opts.state;
    }
    if (opts.q) {
        params.q = opts.q;
    }
    const url = `${repoUrl(workspace, repo)}/pullrequests${buildQuery(params)}`;
    const out: BitbucketPullRequest[] = [];
    for await (const pr of paginate<BitbucketPullRequest>(url)) out.push(pr);
    return out;
}

export async function getPullRequest(
    workspace: string,
    repo: string,
    id: number,
): Promise<BitbucketPullRequest> {
    return request<BitbucketPullRequest>(`${repoUrl(workspace, repo)}/pullrequests/${id}`);
}

export async function getPullRequestDiff(
    workspace: string,
    repo: string,
    id: number,
): Promise<string> {
    return requestText(`${repoUrl(workspace, repo)}/pullrequests/${id}/diff`);
}

export interface CreatePullRequestOptions {
    title: string;
    source: string;
    destination?: string;
    description?: string;
    reviewerAccountIds?: string[];
    closeSource?: boolean;
    draft?: boolean;
}

export async function createPullRequest(
    workspace: string,
    repo: string,
    opts: CreatePullRequestOptions,
): Promise<BitbucketPullRequest> {
    const body: BitbucketCreatePullRequestRequest = {
        title: opts.title,
        source: { branch: { name: opts.source } },
    };
    if (opts.destination) body.destination = { branch: { name: opts.destination } };
    if (opts.description !== undefined) body.description = opts.description;
    if (opts.reviewerAccountIds?.length) {
        body.reviewers = opts.reviewerAccountIds.map(id => ({ account_id: id }));
    }
    if (opts.closeSource !== undefined) body.close_source_branch = opts.closeSource;
    if (opts.draft !== undefined) body.draft = opts.draft;

    return request<BitbucketPullRequest>(`${repoUrl(workspace, repo)}/pullrequests`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export interface UpdatePullRequestOptions {
    title?: string;
    description?: string;
    reviewerAccountIds?: string[];
}

export async function updatePullRequest(
    workspace: string,
    repo: string,
    id: number,
    opts: UpdatePullRequestOptions,
): Promise<BitbucketPullRequest> {
    const body: BitbucketUpdatePullRequestRequest = {};
    if (opts.title !== undefined) body.title = opts.title;
    if (opts.description !== undefined) body.description = opts.description;
    if (opts.reviewerAccountIds) {
        body.reviewers = opts.reviewerAccountIds.map(accountId => ({ account_id: accountId }));
    }
    return request<BitbucketPullRequest>(`${repoUrl(workspace, repo)}/pullrequests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export async function approvePullRequest(
    workspace: string,
    repo: string,
    id: number,
): Promise<unknown> {
    return request(`${repoUrl(workspace, repo)}/pullrequests/${id}/approve`, {
        method: 'POST',
        body: '{}',
    });
}

export async function unapprovePullRequest(
    workspace: string,
    repo: string,
    id: number,
): Promise<unknown> {
    return request(`${repoUrl(workspace, repo)}/pullrequests/${id}/approve`, { method: 'DELETE' });
}

export async function requestChangesPullRequest(
    workspace: string,
    repo: string,
    id: number,
): Promise<unknown> {
    return request(`${repoUrl(workspace, repo)}/pullrequests/${id}/request-changes`, {
        method: 'POST',
        body: '{}',
    });
}

export async function unrequestChangesPullRequest(
    workspace: string,
    repo: string,
    id: number,
): Promise<unknown> {
    return request(`${repoUrl(workspace, repo)}/pullrequests/${id}/request-changes`, {
        method: 'DELETE',
    });
}

export type MergeStrategy = 'merge_commit' | 'squash' | 'fast_forward';

export async function mergePullRequest(
    workspace: string,
    repo: string,
    id: number,
    opts: { strategy?: MergeStrategy; closeSource?: boolean; message?: string } = {},
): Promise<BitbucketPullRequest> {
    const body: BitbucketMergeRequest = {};
    if (opts.strategy) body.merge_strategy = opts.strategy;
    if (opts.closeSource !== undefined) body.close_source_branch = opts.closeSource;
    if (opts.message !== undefined) body.message = opts.message;
    return request<BitbucketPullRequest>(`${repoUrl(workspace, repo)}/pullrequests/${id}/merge`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function declinePullRequest(
    workspace: string,
    repo: string,
    id: number,
): Promise<BitbucketPullRequest> {
    return request<BitbucketPullRequest>(`${repoUrl(workspace, repo)}/pullrequests/${id}/decline`, {
        method: 'POST',
        body: '{}',
    });
}

// --- PR comments --------------------------------------------------------

export async function listComments(
    workspace: string,
    repo: string,
    prId: number,
): Promise<BitbucketComment[]> {
    const out: BitbucketComment[] = [];
    for await (const c of paginate<BitbucketComment>(
        `${repoUrl(workspace, repo)}/pullrequests/${prId}/comments`,
    )) {
        out.push(c);
    }
    return out;
}

export async function getComment(
    workspace: string,
    repo: string,
    prId: number,
    commentId: number,
): Promise<BitbucketComment> {
    return request<BitbucketComment>(
        `${repoUrl(workspace, repo)}/pullrequests/${prId}/comments/${commentId}`,
    );
}

export interface AddCommentOptions {
    body: string;
    inline?: { path: string; to?: number; from?: number };
    parentId?: number;
}

export function buildCommentBody(opts: AddCommentOptions): BitbucketCreateCommentRequest {
    const body: BitbucketCreateCommentRequest = { content: { raw: opts.body } };
    if (opts.inline) {
        body.inline = {
            path: opts.inline.path,
            ...(opts.inline.to !== undefined ? { to: opts.inline.to } : {}),
            ...(opts.inline.from !== undefined ? { from: opts.inline.from } : {}),
        };
    }
    if (opts.parentId !== undefined) body.parent = { id: opts.parentId };
    return body;
}

export async function addComment(
    workspace: string,
    repo: string,
    prId: number,
    opts: AddCommentOptions,
): Promise<BitbucketComment> {
    return request<BitbucketComment>(`${repoUrl(workspace, repo)}/pullrequests/${prId}/comments`, {
        method: 'POST',
        body: JSON.stringify(buildCommentBody(opts)),
    });
}

export async function updateComment(
    workspace: string,
    repo: string,
    prId: number,
    commentId: number,
    body: string,
): Promise<BitbucketComment> {
    return request<BitbucketComment>(
        `${repoUrl(workspace, repo)}/pullrequests/${prId}/comments/${commentId}`,
        {
            method: 'PUT',
            body: JSON.stringify({ content: { raw: body } }),
        },
    );
}

export async function deleteComment(
    workspace: string,
    repo: string,
    prId: number,
    commentId: number,
): Promise<unknown> {
    return request(`${repoUrl(workspace, repo)}/pullrequests/${prId}/comments/${commentId}`, {
        method: 'DELETE',
    });
}

/**
 * Resolve a comment thread. POST to the `/resolve` sub-resource; the response
 * is the updated comment carrying a populated `resolution`. See the
 * resolve/reopen note in the file header.
 */
export async function resolveComment(
    workspace: string,
    repo: string,
    prId: number,
    commentId: number,
): Promise<BitbucketComment> {
    return request<BitbucketComment>(
        `${repoUrl(workspace, repo)}/pullrequests/${prId}/comments/${commentId}/resolve`,
        { method: 'POST', body: '{}' },
    );
}

/** Reopen (unresolve) a comment thread by DELETEing the `/resolve` sub-resource. */
export async function reopenComment(
    workspace: string,
    repo: string,
    prId: number,
    commentId: number,
): Promise<unknown> {
    return request(
        `${repoUrl(workspace, repo)}/pullrequests/${prId}/comments/${commentId}/resolve`,
        { method: 'DELETE' },
    );
}

// --- PR tasks -----------------------------------------------------------

export async function listTasks(
    workspace: string,
    repo: string,
    prId: number,
): Promise<BitbucketTask[]> {
    const out: BitbucketTask[] = [];
    for await (const t of paginate<BitbucketTask>(
        `${repoUrl(workspace, repo)}/pullrequests/${prId}/tasks`,
    )) {
        out.push(t);
    }
    return out;
}

export interface AddTaskOptions {
    body: string;
    onCommentId?: number;
}

export function buildTaskBody(opts: AddTaskOptions): BitbucketCreateTaskRequest {
    const body: BitbucketCreateTaskRequest = { content: { raw: opts.body } };
    if (opts.onCommentId !== undefined) body.comment = { id: opts.onCommentId };
    return body;
}

export async function addTask(
    workspace: string,
    repo: string,
    prId: number,
    opts: AddTaskOptions,
): Promise<BitbucketTask> {
    return request<BitbucketTask>(`${repoUrl(workspace, repo)}/pullrequests/${prId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(buildTaskBody(opts)),
    });
}

export interface UpdateTaskOptions {
    body?: string;
    state?: BitbucketTaskState;
}

export async function updateTask(
    workspace: string,
    repo: string,
    prId: number,
    taskId: number,
    opts: UpdateTaskOptions,
): Promise<BitbucketTask> {
    const body: BitbucketUpdateTaskRequest = {};
    if (opts.body !== undefined) body.content = { raw: opts.body };
    if (opts.state !== undefined) body.state = opts.state;
    return request<BitbucketTask>(
        `${repoUrl(workspace, repo)}/pullrequests/${prId}/tasks/${taskId}`,
        {
            method: 'PUT',
            body: JSON.stringify(body),
        },
    );
}

export async function deleteTask(
    workspace: string,
    repo: string,
    prId: number,
    taskId: number,
): Promise<unknown> {
    return request(`${repoUrl(workspace, repo)}/pullrequests/${prId}/tasks/${taskId}`, {
        method: 'DELETE',
    });
}

// --- Pipelines ----------------------------------------------------------

export interface ListPipelinesOptions {
    branch?: string;
    /**
     * `state.name` values plus the `result.name` aliases callers usually want.
     * Internally normalised onto Bitbucket's accepted query.
     */
    status?: BitbucketPipelineState;
    sort?: string;
}

export async function listPipelines(
    workspace: string,
    repo: string,
    opts: ListPipelinesOptions = {},
): Promise<BitbucketPipeline[]> {
    const params: Record<string, string> = { sort: opts.sort ?? '-created_on' };
    if (opts.branch) params['target.branch'] = opts.branch;
    if (opts.status) params['status'] = opts.status;
    const url = `${repoUrl(workspace, repo)}/pipelines/${buildQuery(params)}`;
    const out: BitbucketPipeline[] = [];
    for await (const p of paginate<BitbucketPipeline>(url)) out.push(p);
    return out;
}

export async function getPipeline(
    workspace: string,
    repo: string,
    uuidOrNumber: string,
): Promise<BitbucketPipeline> {
    const id = uuidOrNumber.startsWith('{') ? uuidOrNumber : `{${uuidOrNumber}}`;
    // Build numbers and uuids both work as the path segment; uuids must be brace-wrapped.
    const segment = /^\d+$/.test(uuidOrNumber) ? uuidOrNumber : id;
    return request<BitbucketPipeline>(`${repoUrl(workspace, repo)}/pipelines/${segment}`);
}

export interface TriggerPipelineOptions {
    branch?: string;
    commit?: string;
    custom?: string;
    variables?: BitbucketPipelineVariable[];
}

export function buildTriggerBody(opts: TriggerPipelineOptions): BitbucketTriggerPipelineRequest {
    const target: BitbucketTriggerPipelineRequest['target'] = {};

    if (opts.commit) {
        target.type = 'pipeline_commit_target';
        target.commit = { type: 'commit', hash: opts.commit };
        if (opts.branch) {
            target.ref_type = 'branch';
            target.ref_name = opts.branch;
        }
        if (opts.custom) {
            target.selector = { type: 'custom', pattern: opts.custom };
        }
    } else if (opts.branch) {
        target.type = 'pipeline_ref_target';
        target.ref_type = 'branch';
        target.ref_name = opts.branch;
        if (opts.custom) {
            target.selector = { type: 'custom', pattern: opts.custom };
        }
    } else {
        throw new Error('triggerPipeline requires at least one of --branch or --commit');
    }

    const out: BitbucketTriggerPipelineRequest = { target };
    if (opts.variables?.length) out.variables = opts.variables;
    return out;
}

export async function triggerPipeline(
    workspace: string,
    repo: string,
    opts: TriggerPipelineOptions,
): Promise<BitbucketPipeline> {
    return request<BitbucketPipeline>(`${repoUrl(workspace, repo)}/pipelines/`, {
        method: 'POST',
        body: JSON.stringify(buildTriggerBody(opts)),
    });
}

export async function stopPipeline(
    workspace: string,
    repo: string,
    uuid: string,
): Promise<unknown> {
    const segment = uuid.startsWith('{') ? uuid : `{${uuid}}`;
    return request(`${repoUrl(workspace, repo)}/pipelines/${segment}/stopPipeline`, {
        method: 'POST',
        body: '{}',
    });
}

export async function listSteps(
    workspace: string,
    repo: string,
    pipelineUuid: string,
): Promise<BitbucketPipelineStep[]> {
    const segment = pipelineUuid.startsWith('{') ? pipelineUuid : `{${pipelineUuid}}`;
    const out: BitbucketPipelineStep[] = [];
    for await (const s of paginate<BitbucketPipelineStep>(
        `${repoUrl(workspace, repo)}/pipelines/${segment}/steps/`,
    )) {
        out.push(s);
    }
    return out;
}

export async function getStep(
    workspace: string,
    repo: string,
    pipelineUuid: string,
    stepUuid: string,
): Promise<BitbucketPipelineStep> {
    const pSeg = pipelineUuid.startsWith('{') ? pipelineUuid : `{${pipelineUuid}}`;
    const sSeg = stepUuid.startsWith('{') ? stepUuid : `{${stepUuid}}`;
    return request<BitbucketPipelineStep>(
        `${repoUrl(workspace, repo)}/pipelines/${pSeg}/steps/${sSeg}`,
    );
}

export async function getStepLog(
    workspace: string,
    repo: string,
    pipelineUuid: string,
    stepUuid: string,
): Promise<string> {
    const pSeg = pipelineUuid.startsWith('{') ? pipelineUuid : `{${pipelineUuid}}`;
    const sSeg = stepUuid.startsWith('{') ? stepUuid : `{${stepUuid}}`;
    return requestText(`${repoUrl(workspace, repo)}/pipelines/${pSeg}/steps/${sSeg}/log`);
}

// --- Members ------------------------------------------------------------

export interface ListMembersOptions {
    query?: string;
}

export async function listMembers(
    workspace: string,
    opts: ListMembersOptions = {},
): Promise<BitbucketWorkspaceMember[]> {
    // Bitbucket Cloud's /workspaces/{ws}/members endpoint does not support
    // server-side filtering on display_name (rejects "~" with HTTP 400, and
    // nickname only accepts "=" / "!="). Filter client-side after pagination.
    const url = `${API_BASE}/workspaces/${encodeURIComponent(workspace)}/members`;
    const out: BitbucketWorkspaceMember[] = [];
    for await (const m of paginate<BitbucketWorkspaceMember>(url)) out.push(m);
    if (!opts.query) return out;
    const needle = opts.query.toLowerCase();
    return out.filter(m => {
        const name = m.user.display_name?.toLowerCase() ?? '';
        const nick = m.user.nickname?.toLowerCase() ?? '';
        return name.includes(needle) || nick.includes(needle);
    });
}

// --- Read surface: account ----------------------------------------------

/**
 * The authenticated account (`GET /user`). Requires the token's Account read
 * scope; a 403 is rewritten with a scope hint since that is the common cause.
 */
export async function getCurrentUser(): Promise<BitbucketAccount> {
    try {
        return await request<BitbucketAccount>(`${API_BASE}/user`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // The shared request layer surfaces Bitbucket's error envelope, whose 403
        // body reads "…lack one or more required privilege scopes." (no "403"), so
        // match the scope wording as well as the bare HTTP status fallback.
        if (msg.includes('403') || /forbidden|privilege scope|scope/i.test(msg)) {
            throw new Error(
                'whoami failed: the Bitbucket token lacks the Account read scope. ' +
                    'Grant "Account: Read" on the workspace API token or app password ' +
                    `(https://bitbucket.org/account/settings/app-passwords/).\nUnderlying error: ${msg}`,
            );
        }
        throw err;
    }
}

// --- Read surface: repositories -----------------------------------------

export interface ListRepositoriesOptions {
    query?: string;
    role?: string;
    sort?: string;
}

export async function listRepositories(
    workspace: string,
    opts: ListRepositoriesOptions = {},
): Promise<BitbucketRepository[]> {
    const url =
        `${API_BASE}/repositories/${encodeURIComponent(workspace)}` +
        buildQuery({ q: opts.query, role: opts.role, sort: opts.sort });
    const out: BitbucketRepository[] = [];
    for await (const r of paginate<BitbucketRepository>(url)) out.push(r);
    return out;
}

// --- Read surface: refs (branches & tags) -------------------------------

export interface ListRefsOptions {
    query?: string;
    sort?: string;
}

export async function listBranches(
    workspace: string,
    repo: string,
    opts: ListRefsOptions = {},
): Promise<BitbucketBranch[]> {
    const url =
        `${repoUrl(workspace, repo)}/refs/branches` +
        buildQuery({ q: opts.query, sort: opts.sort });
    const out: BitbucketBranch[] = [];
    for await (const b of paginate<BitbucketBranch>(url)) out.push(b);
    return out;
}

export async function getBranch(
    workspace: string,
    repo: string,
    name: string,
): Promise<BitbucketBranch> {
    return request<BitbucketBranch>(
        `${repoUrl(workspace, repo)}/refs/branches/${encodeURIComponent(name)}`,
    );
}

export async function listTags(
    workspace: string,
    repo: string,
    opts: ListRefsOptions = {},
): Promise<BitbucketTag[]> {
    const url =
        `${repoUrl(workspace, repo)}/refs/tags` + buildQuery({ q: opts.query, sort: opts.sort });
    const out: BitbucketTag[] = [];
    for await (const t of paginate<BitbucketTag>(url)) out.push(t);
    return out;
}

export async function getTag(workspace: string, repo: string, name: string): Promise<BitbucketTag> {
    return request<BitbucketTag>(
        `${repoUrl(workspace, repo)}/refs/tags/${encodeURIComponent(name)}`,
    );
}

/**
 * Resolve a ref to a commit hash *only when it contains a slash*.
 *
 * In path-positional endpoints (`/src/{ref}/{path}`, `/commits/{ref}`,
 * `/diff/{spec}`) Bitbucket Cloud treats a `%2F`-encoded slash as a path
 * delimiter and resolves the wrong ref (BCLOUD-20223). Slash-free refs (`main`,
 * `v1.2.0`, a sha) are safe in those positions and are returned unchanged with
 * no extra request; slashed refs (`feature/x`) are looked up via the *leaf*
 * `refs/branches|tags/{name}` endpoints (which DO accept `%2F`) and replaced
 * with their target hash. Unknown refs are returned as-is so the API surfaces a
 * clear 404.
 */
async function resolveRefToHash(workspace: string, repo: string, ref: string): Promise<string> {
    if (!ref.includes('/')) return ref;
    try {
        const branch = await getBranch(workspace, repo, ref);
        if (branch.target?.hash) return branch.target.hash;
    } catch {
        /* not a branch — fall through to tag */
    }
    try {
        const tag = await getTag(workspace, repo, ref);
        if (tag.target?.hash) return tag.target.hash;
    } catch {
        /* not a tag — give up, let the downstream call 404 */
    }
    return ref;
}

/**
 * Resolve a revspec for the diff/patch endpoints. Splits on `...`/`..` (git
 * refnames cannot contain consecutive dots, so this is unambiguous) and
 * hash-resolves each slashed side. A bare sha or slash-free ref incurs no extra
 * request.
 */
async function resolveSpec(workspace: string, repo: string, spec: string): Promise<string> {
    const sep = spec.includes('...') ? '...' : spec.includes('..') ? '..' : null;
    if (!sep) return resolveRefToHash(workspace, repo, spec);
    const [a, b] = spec.split(sep);
    const [ra, rb] = await Promise.all([
        resolveRefToHash(workspace, repo, a ?? ''),
        resolveRefToHash(workspace, repo, b ?? ''),
    ]);
    return `${ra}${sep}${rb}`;
}

// --- Read surface: commits ----------------------------------------------

export interface ListCommitsOptions {
    branch?: string;
    include?: string[];
    exclude?: string[];
    /** Stop draining pages once this many commits are collected. Default 25. */
    limit?: number;
}

export async function listCommits(
    workspace: string,
    repo: string,
    opts: ListCommitsOptions = {},
): Promise<BitbucketCommit[]> {
    // Defensive: never let an invalid limit defeat the cap and drain full history.
    const limit = Number.isInteger(opts.limit) && (opts.limit as number) > 0 ? opts.limit! : 25;
    const branchSeg = opts.branch
        ? await resolveRefToHash(workspace, repo, opts.branch)
        : undefined;
    const base = branchSeg
        ? `${repoUrl(workspace, repo)}/commits/${encodeURIComponent(branchSeg)}`
        : `${repoUrl(workspace, repo)}/commits`;
    const params = new URLSearchParams();
    for (const inc of opts.include ?? []) params.append('include', inc);
    for (const exc of opts.exclude ?? []) params.append('exclude', exc);
    const qs = params.toString();
    const url = qs ? `${base}?${qs}` : base;
    const out: BitbucketCommit[] = [];
    for await (const c of paginate<BitbucketCommit>(url)) {
        out.push(c);
        if (out.length >= limit) break;
    }
    return out;
}

export async function getCommit(
    workspace: string,
    repo: string,
    sha: string,
): Promise<BitbucketCommit> {
    return request<BitbucketCommit>(
        `${repoUrl(workspace, repo)}/commit/${encodeURIComponent(sha)}`,
    );
}

// --- Read surface: diff / patch / diffstat (commit sha or revspec) -------

/** Raw unified diff for a commit sha or a revspec such as `main..feature`. */
export async function getDiff(workspace: string, repo: string, spec: string): Promise<string> {
    const resolved = await resolveSpec(workspace, repo, spec);
    return requestText(`${repoUrl(workspace, repo)}/diff/${encodeURIComponent(resolved)}`);
}

/** Mbox-style patch for a commit sha or a revspec. */
export async function getPatch(workspace: string, repo: string, spec: string): Promise<string> {
    const resolved = await resolveSpec(workspace, repo, spec);
    return requestText(`${repoUrl(workspace, repo)}/patch/${encodeURIComponent(resolved)}`);
}

/** Per-file added/removed summary for a commit sha or a revspec. */
export async function getDiffStat(
    workspace: string,
    repo: string,
    spec: string,
): Promise<BitbucketDiffStatEntry[]> {
    const resolved = await resolveSpec(workspace, repo, spec);
    const out: BitbucketDiffStatEntry[] = [];
    for await (const d of paginate<BitbucketDiffStatEntry>(
        `${repoUrl(workspace, repo)}/diffstat/${encodeURIComponent(resolved)}`,
    )) {
        out.push(d);
    }
    return out;
}

// --- Read surface: source (read & browse) -------------------------------

/** Encode a repo-relative path: keep the slashes, encode each segment. */
function encodePath(path: string): string {
    return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

/**
 * Resolve the ref for a `/src/{ref}/…` request: fall back to the repository's
 * main branch when omitted, and hash-resolve a slashed ref so the slash is not
 * mis-read as a path delimiter (see `resolveRefToHash`).
 */
async function resolveRef(workspace: string, repo: string, ref?: string): Promise<string> {
    if (!ref) {
        const info = await getRepository(workspace, repo);
        const main = info.mainbranch?.name;
        if (!main) {
            throw new Error('Could not resolve the repository main branch; pass --ref explicitly');
        }
        return main;
    }
    return resolveRefToHash(workspace, repo, ref);
}

export async function readSource(
    workspace: string,
    repo: string,
    path: string,
    ref?: string,
): Promise<string> {
    const resolved = await resolveRef(workspace, repo, ref);
    return requestText(
        `${repoUrl(workspace, repo)}/src/${encodeURIComponent(resolved)}/${encodePath(path)}`,
    );
}

export interface BrowseSourceOptions {
    ref?: string;
    recursive?: boolean;
}

export async function browseSource(
    workspace: string,
    repo: string,
    path: string,
    opts: BrowseSourceOptions = {},
): Promise<BitbucketSrcEntry[]> {
    const resolved = await resolveRef(workspace, repo, opts.ref);
    const base = `${repoUrl(workspace, repo)}/src/${encodeURIComponent(resolved)}/`;
    const dir = path ? `${encodePath(path)}/` : '';
    const url = `${base}${dir}` + buildQuery({ max_depth: opts.recursive ? 100 : undefined });
    const out: BitbucketSrcEntry[] = [];
    for await (const e of paginate<BitbucketSrcEntry>(url)) out.push(e);
    return out;
}

// --- Read surface: PR activity & statuses -------------------------------

export async function listPullRequestActivity(
    workspace: string,
    repo: string,
    id: number,
    opts: { limit?: number } = {},
): Promise<BitbucketActivityEntry[]> {
    const limit = Number.isInteger(opts.limit) && (opts.limit as number) > 0 ? opts.limit! : 25;
    const out: BitbucketActivityEntry[] = [];
    for await (const a of paginate<BitbucketActivityEntry>(
        `${repoUrl(workspace, repo)}/pullrequests/${id}/activity`,
    )) {
        out.push(a);
        if (out.length >= limit) break;
    }
    return out;
}

export async function listPullRequestStatuses(
    workspace: string,
    repo: string,
    id: number,
): Promise<BitbucketCommitStatus[]> {
    const out: BitbucketCommitStatus[] = [];
    for await (const s of paginate<BitbucketCommitStatus>(
        `${repoUrl(workspace, repo)}/pullrequests/${id}/statuses`,
    )) {
        out.push(s);
    }
    return out;
}
