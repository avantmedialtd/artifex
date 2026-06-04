/**
 * Bitbucket Cloud terminal formatters.
 *
 * Mirrors the Jira/Confluence formatter pattern: each function takes a typed
 * API response and returns a markdown-flavored string. JSON output is handled
 * by the command handler, not here.
 */

import { link } from '../../utils/output.ts';
import type {
    BitbucketComment,
    BitbucketPipeline,
    BitbucketPipelineStep,
    BitbucketPullRequest,
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

// ------------------------------------------------------------------------

function escapePipe(s: string): string {
    return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
