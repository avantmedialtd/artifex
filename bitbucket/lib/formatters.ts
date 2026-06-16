/**
 * Bitbucket Cloud terminal formatters.
 *
 * Mirrors the Jira/Confluence formatter pattern: each function takes a typed
 * API response and returns a markdown-flavored string. JSON output is handled
 * by the command handler, not here.
 */

import { link } from '../../utils/output.ts';
import type {
    BitbucketAccount,
    BitbucketActivityEntry,
    BitbucketBranch,
    BitbucketComment,
    BitbucketCommit,
    BitbucketCommitStatus,
    BitbucketDiffStatEntry,
    BitbucketParticipant,
    BitbucketPipeline,
    BitbucketPipelineStep,
    BitbucketPullRequest,
    BitbucketRepository,
    BitbucketSrcEntry,
    BitbucketTag,
    BitbucketTask,
    BitbucketWorkspaceMember,
} from './types.ts';

export function output(data: unknown, asJson: boolean): void {
    if (asJson) {
        console.log(JSON.stringify(data, null, 2));
    } else if (typeof data === 'string') {
        console.log(data);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function prLink(pr: BitbucketPullRequest): string {
    const href = pr.links?.html?.href;
    return href ? link(`#${pr.id}`, href) : `#${pr.id}`;
}

function pipelineState(pipeline: BitbucketPipeline | BitbucketPipelineStep): string {
    const result = pipeline.state.result?.name;
    return result ? `${pipeline.state.name}/${result}` : pipeline.state.name;
}

function shortDuration(seconds?: number): string {
    if (!seconds) return '—';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m${secs}s` : `${secs}s`;
}

// --- Pull requests ------------------------------------------------------

export function formatPullRequestList(prs: BitbucketPullRequest[]): string {
    if (prs.length === 0) return '_No pull requests._';
    const lines: string[] = [];
    lines.push('| ID | State | Title | Author | Branches | Updated |');
    lines.push('|----|-------|-------|--------|----------|---------|');
    for (const pr of prs) {
        lines.push(
            `| ${prLink(pr)} | ${pr.state} | ${escapePipe(pr.title)} | ${pr.author.display_name} ` +
                `| ${pr.source.branch.name} → ${pr.destination.branch.name} ` +
                `| ${formatDate(pr.updated_on)} |`,
        );
    }
    return lines.join('\n');
}

export function formatPullRequest(pr: BitbucketPullRequest): string {
    const lines: string[] = [];
    lines.push(`# ${prLink(pr)}: ${pr.title}`);
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| State | ${pr.state}${pr.draft ? ' (draft)' : ''} |`);
    lines.push(`| Author | ${pr.author.display_name} |`);
    lines.push(`| Source | \`${pr.source.branch.name}\` |`);
    lines.push(`| Destination | \`${pr.destination.branch.name}\` |`);
    lines.push(`| Created | ${formatDate(pr.created_on)} |`);
    lines.push(`| Updated | ${formatDate(pr.updated_on)} |`);

    const reviewers = pr.participants?.filter(p => p.role === 'REVIEWER') ?? [];
    if (reviewers.length > 0) {
        const review = reviewers
            .map(p => {
                const status = p.approved
                    ? '✓ approved'
                    : p.state === 'changes_requested'
                      ? '✗ changes requested'
                      : '○ pending';
                return `${p.user.display_name} (${status})`;
            })
            .join('; ');
        lines.push(`| Reviewers | ${review} |`);
    }

    if (pr.description) {
        lines.push('');
        lines.push('## Description');
        lines.push('');
        lines.push(pr.description);
    }
    return lines.join('\n');
}

// --- Comments -----------------------------------------------------------

export function formatCommentList(comments: BitbucketComment[]): string {
    if (comments.length === 0) return '_No comments._';
    // Build a child map keyed by parent id for indented display.
    const byParent = new Map<number | undefined, BitbucketComment[]>();
    for (const c of comments) {
        const parent = c.parent?.id;
        const list = byParent.get(parent) ?? [];
        list.push(c);
        byParent.set(parent, list);
    }

    const lines: string[] = [];
    const top = byParent.get(undefined) ?? [];
    const walk = (comment: BitbucketComment, depth: number) => {
        const indent = '  '.repeat(depth);
        const anchor = comment.inline
            ? ` _on ${comment.inline.path}:${comment.inline.to ?? comment.inline.from ?? '?'}_`
            : '';
        const deleted = comment.deleted ? ' (deleted)' : '';
        const resolution = comment.resolution
            ? ` ✓ resolved${
                  comment.resolution.user ? ` by ${comment.resolution.user.display_name}` : ''
              }${
                  comment.resolution.created_on
                      ? ` (${formatDate(comment.resolution.created_on)})`
                      : ''
              }`
            : '';
        lines.push(
            `${indent}- **#${comment.id}** ${comment.user.display_name}${anchor}${deleted} — ${formatDate(
                comment.updated_on,
            )}${resolution}`,
        );
        const body = comment.content.raw.split('\n');
        for (const line of body) {
            lines.push(`${indent}  > ${line}`);
        }
        const children = byParent.get(comment.id) ?? [];
        for (const child of children) walk(child, depth + 1);
    };
    for (const c of top) walk(c, 0);
    return lines.join('\n');
}

// --- Tasks --------------------------------------------------------------

export function formatTaskList(tasks: BitbucketTask[]): string {
    if (tasks.length === 0) return '_No tasks._';
    const lines: string[] = [];
    for (const t of tasks) {
        const checkbox = t.state === 'RESOLVED' ? '[x]' : '[ ]';
        const link = t.comment ? ` _on comment #${t.comment.id}_` : '';
        lines.push(
            `- ${checkbox} **#${t.id}** ${escapePipe(t.content.raw)}${link} _(${t.creator.display_name}, ${formatDate(t.updated_on)})_`,
        );
    }
    return lines.join('\n');
}

// --- Pipelines ----------------------------------------------------------

export function formatPipelineList(pipelines: BitbucketPipeline[]): string {
    if (pipelines.length === 0) return '_No pipelines._';
    const lines: string[] = [];
    lines.push('| Build | State | Branch | Duration | Created |');
    lines.push('|-------|-------|--------|----------|---------|');
    for (const p of pipelines) {
        const branch = p.target.ref_name ?? p.target.commit?.hash?.slice(0, 7) ?? '—';
        lines.push(
            `| #${p.build_number} | ${pipelineState(p)} | ${branch} ` +
                `| ${shortDuration(p.duration_in_seconds)} | ${formatDate(p.created_on)} |`,
        );
    }
    return lines.join('\n');
}

export function formatPipeline(pipeline: BitbucketPipeline): string {
    const lines: string[] = [];
    lines.push(`# Pipeline #${pipeline.build_number}`);
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| UUID | ${pipeline.uuid} |`);
    lines.push(`| State | ${pipelineState(pipeline)} |`);
    if (pipeline.target.ref_name) lines.push(`| Branch | ${pipeline.target.ref_name} |`);
    if (pipeline.target.commit?.hash)
        lines.push(`| Commit | \`${pipeline.target.commit.hash.slice(0, 12)}\` |`);
    if (pipeline.target.selector?.pattern)
        lines.push(`| Custom | ${pipeline.target.selector.pattern} |`);
    if (pipeline.creator) lines.push(`| Triggered by | ${pipeline.creator.display_name} |`);
    lines.push(`| Created | ${formatDate(pipeline.created_on)} |`);
    if (pipeline.completed_on) lines.push(`| Completed | ${formatDate(pipeline.completed_on)} |`);
    if (pipeline.duration_in_seconds !== undefined)
        lines.push(`| Duration | ${shortDuration(pipeline.duration_in_seconds)} |`);
    return lines.join('\n');
}

export function formatStepList(steps: BitbucketPipelineStep[]): string {
    if (steps.length === 0) return '_No steps._';
    const lines: string[] = [];
    lines.push('| Step | Name | State | Duration |');
    lines.push('|------|------|-------|----------|');
    for (const s of steps) {
        lines.push(
            `| ${s.uuid} | ${s.name ?? '—'} | ${pipelineState(s)} ` +
                `| ${shortDuration(s.duration_in_seconds)} |`,
        );
    }
    return lines.join('\n');
}

// --- Members ------------------------------------------------------------

export function formatMembers(members: BitbucketWorkspaceMember[]): string {
    if (members.length === 0) return '_No members._';
    const lines: string[] = [];
    lines.push('| Display Name | Nickname | Account ID |');
    lines.push('|--------------|----------|------------|');
    for (const m of members) {
        lines.push(
            `| ${m.user.display_name} | ${m.user.nickname ?? '—'} | \`${m.user.account_id}\` |`,
        );
    }
    return lines.join('\n');
}

// --- Read surface -------------------------------------------------------

function shortHash(hash: string | undefined): string {
    return hash ? hash.slice(0, 7) : '—';
}

function commitAuthor(commit: BitbucketCommit): string {
    return commit.author?.user?.display_name ?? commit.author?.raw ?? '—';
}

function firstLine(message: string | undefined): string {
    return (message ?? '').split('\n')[0]?.trim() ?? '';
}

export function formatAccount(account: BitbucketAccount): string {
    const lines: string[] = [];
    lines.push(`# ${account.display_name}`);
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    if (account.username) lines.push(`| Username | ${account.username} |`);
    if (account.nickname) lines.push(`| Nickname | ${account.nickname} |`);
    lines.push(`| Account ID | \`${account.account_id}\` |`);
    if (account.uuid) lines.push(`| UUID | ${account.uuid} |`);
    return lines.join('\n');
}

export function formatRepositoryList(repos: BitbucketRepository[]): string {
    if (repos.length === 0) return '_No repositories._';
    const lines: string[] = [];
    lines.push('| Name | Full Name | Main Branch |');
    lines.push('|------|-----------|-------------|');
    for (const r of repos) {
        lines.push(
            `| ${escapePipe(r.name)} | ${escapePipe(r.full_name)} | ${r.mainbranch?.name ?? '—'} |`,
        );
    }
    return lines.join('\n');
}

export function formatRepository(repo: BitbucketRepository): string {
    const lines: string[] = [];
    lines.push(`# ${repo.full_name}`);
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| Name | ${repo.name} |`);
    lines.push(`| Main branch | ${repo.mainbranch?.name ?? '—'} |`);
    if (repo.workspace?.slug) lines.push(`| Workspace | ${repo.workspace.slug} |`);
    if (repo.uuid) lines.push(`| UUID | ${repo.uuid} |`);
    return lines.join('\n');
}

export function formatBranchList(branches: BitbucketBranch[]): string {
    if (branches.length === 0) return '_No branches._';
    const lines: string[] = [];
    lines.push('| Branch | Head |');
    lines.push('|--------|------|');
    for (const b of branches) {
        lines.push(`| ${escapePipe(b.name)} | \`${shortHash(b.target?.hash)}\` |`);
    }
    return lines.join('\n');
}

export function formatBranch(branch: BitbucketBranch): string {
    return [
        `# Branch \`${branch.name}\``,
        '',
        `- Head: \`${shortHash(branch.target?.hash)}\``,
    ].join('\n');
}

export function formatTagList(tags: BitbucketTag[]): string {
    if (tags.length === 0) return '_No tags._';
    const lines: string[] = [];
    lines.push('| Tag | Target |');
    lines.push('|-----|--------|');
    for (const t of tags) {
        lines.push(`| ${escapePipe(t.name)} | \`${shortHash(t.target?.hash)}\` |`);
    }
    return lines.join('\n');
}

export function formatTag(tag: BitbucketTag): string {
    const lines: string[] = [
        `# Tag \`${tag.name}\``,
        '',
        `- Target: \`${shortHash(tag.target?.hash)}\``,
    ];
    if (tag.message) lines.push(`- Message: ${firstLine(tag.message)}`);
    return lines.join('\n');
}

export function formatCommitList(commits: BitbucketCommit[]): string {
    if (commits.length === 0) return '_No commits._';
    const lines: string[] = [];
    lines.push('| Commit | Author | Date | Message |');
    lines.push('|--------|--------|------|---------|');
    for (const c of commits) {
        lines.push(
            `| \`${shortHash(c.hash)}\` | ${escapePipe(commitAuthor(c))} | ${formatDate(c.date)} ` +
                `| ${escapePipe(firstLine(c.message))} |`,
        );
    }
    return lines.join('\n');
}

export function formatCommit(commit: BitbucketCommit): string {
    const lines: string[] = [];
    lines.push(`# Commit \`${shortHash(commit.hash)}\``);
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| Hash | \`${commit.hash}\` |`);
    lines.push(`| Author | ${commitAuthor(commit)} |`);
    lines.push(`| Date | ${formatDate(commit.date)} |`);
    if (commit.parents?.length) {
        lines.push(
            `| Parents | ${commit.parents.map(p => `\`${shortHash(p.hash)}\``).join(', ')} |`,
        );
    }
    if (commit.message) {
        lines.push('');
        lines.push('## Message');
        lines.push('');
        lines.push(commit.message.trim());
    }
    return lines.join('\n');
}

export function formatDiffStat(entries: BitbucketDiffStatEntry[]): string {
    if (entries.length === 0) return '_No changes._';
    const lines: string[] = [];
    lines.push('| Status | File | +/− |');
    lines.push('|--------|------|-----|');
    for (const e of entries) {
        const path = e.new?.path ?? e.old?.path ?? '—';
        lines.push(`| ${e.status} | ${escapePipe(path)} | +${e.lines_added} −${e.lines_removed} |`);
    }
    return lines.join('\n');
}

export function formatSrcList(entries: BitbucketSrcEntry[]): string {
    if (entries.length === 0) return '_Empty._';
    const lines: string[] = [];
    for (const e of entries) {
        const isDir = e.type === 'commit_directory';
        const suffix = isDir ? '/' : '';
        const size = !isDir && e.size !== undefined ? ` (${e.size} B)` : '';
        lines.push(`- ${escapePipe(e.path)}${suffix}${size}`);
    }
    return lines.join('\n');
}

export function formatActivity(entries: BitbucketActivityEntry[]): string {
    if (entries.length === 0) return '_No activity._';
    const lines: string[] = [];
    for (const a of entries) {
        if (a.approval) {
            lines.push(
                `- ✓ **approved** by ${a.approval.user?.display_name ?? '—'} — ${formatDate(a.approval.date)}`,
            );
        } else if (a.changes_requested) {
            lines.push(
                `- ✗ **changes requested** by ${a.changes_requested.user?.display_name ?? '—'} — ${formatDate(a.changes_requested.date)}`,
            );
        } else if (a.update) {
            const who = a.update.author?.display_name ?? '—';
            lines.push(
                `- ⟳ **${a.update.state ?? 'update'}** by ${who} — ${formatDate(a.update.date)}`,
            );
        } else if (a.comment) {
            lines.push(
                `- 💬 **comment** by ${a.comment.user?.display_name ?? '—'} — ${formatDate(a.comment.updated_on)}`,
            );
        }
    }
    return lines.length ? lines.join('\n') : '_No activity._';
}

function statusState(state: BitbucketCommitStatus['state']): string {
    const mark =
        state === 'SUCCESSFUL'
            ? '✓'
            : state === 'FAILED'
              ? '✗'
              : state === 'INPROGRESS'
                ? '⟳'
                : '○';
    return `${mark} ${state}`;
}

export function formatStatusList(statuses: BitbucketCommitStatus[]): string {
    if (statuses.length === 0) return '_No statuses._';
    // Group by commit so a multi-commit PR's gate is not misleadingly flat.
    const byCommit = new Map<string, BitbucketCommitStatus[]>();
    for (const s of statuses) {
        const key = s.commit?.hash ?? '—';
        const list = byCommit.get(key) ?? [];
        list.push(s);
        byCommit.set(key, list);
    }
    const lines: string[] = [];
    for (const [hash, list] of byCommit) {
        lines.push(`### Commit \`${shortHash(hash)}\``);
        for (const s of list) {
            const where = s.url ? ` — ${link(s.key, s.url)}` : ` — ${s.key}`;
            lines.push(`- ${statusState(s.state)} ${s.name ?? s.key}${where}`);
        }
    }
    return lines.join('\n');
}

export function formatReviewers(participants: BitbucketParticipant[], pendingOnly = false): string {
    // Show all participants (REVIEWER + PARTICIPANT) so the rendered view matches
    // the raw `participants[]` that `--json` emits; assigned reviewers sort first.
    const ordered = [...participants].sort((a, b) =>
        a.role === b.role ? 0 : a.role === 'REVIEWER' ? -1 : 1,
    );
    const shown = pendingOnly ? ordered.filter(p => !p.approved) : ordered;
    if (shown.length === 0) return pendingOnly ? '_No pending reviewers._' : '_No reviewers._';
    const lines: string[] = [];
    for (const p of shown) {
        const status = p.approved
            ? '✓ approved'
            : p.state === 'changes_requested'
              ? '✗ changes requested'
              : '○ pending';
        lines.push(`- ${p.user.display_name} (${p.role.toLowerCase()}) — ${status}`);
    }
    return lines.join('\n');
}

// ------------------------------------------------------------------------

function escapePipe(s: string): string {
    return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
