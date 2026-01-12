import type {
    JiraIssue,
    JiraProject,
    JiraIssueType,
    JiraTransition,
    JiraComment,
    JiraSearchResult,
} from './types.ts';
import type { JiraAttachment } from './client.ts';
import { adfToText } from './client.ts';

// Output helper
export function output(data: unknown, asJson: boolean): void {
    if (asJson) {
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log(data);
    }
}

// Date formatting
function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Single issue to markdown
export function formatIssue(issue: JiraIssue): string {
    const f = issue.fields;
    const lines: string[] = [];

    lines.push(`# ${issue.key}: ${f.summary}`);
    lines.push('');
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Status | ${f.status.name} |`);
    lines.push(`| Type | ${f.issuetype.name} |`);
    if (f.priority) {
        lines.push(`| Priority | ${f.priority.name} |`);
    }
    lines.push(`| Assignee | ${f.assignee?.displayName ?? 'Unassigned'} |`);
    lines.push(`| Reporter | ${f.reporter?.displayName ?? 'Unknown'} |`);
    lines.push(`| Project | ${f.project.name} (${f.project.key}) |`);
    lines.push(`| Created | ${formatDate(f.created)} |`);
    lines.push(`| Updated | ${formatDate(f.updated)} |`);

    if (f.labels?.length) {
        lines.push(`| Labels | ${f.labels.join(', ')} |`);
    }

    if (f.parent) {
        lines.push(`| Parent | ${f.parent.key}: ${f.parent.fields.summary} |`);
    }

    // Time tracking
    if (f.timetracking) {
        const tt = f.timetracking;
        if (tt.originalEstimate || tt.remainingEstimate || tt.timeSpent) {
            const parts: string[] = [];
            if (tt.originalEstimate) parts.push(`Original: ${tt.originalEstimate}`);
            if (tt.remainingEstimate) parts.push(`Remaining: ${tt.remainingEstimate}`);
            if (tt.timeSpent) parts.push(`Spent: ${tt.timeSpent}`);
            lines.push(`| Estimate | ${parts.join(' / ')} |`);
        }
    }

    // Description
    const description = adfToText(f.description);
    if (description) {
        lines.push('');
        lines.push('## Description');
        lines.push('');
        lines.push(description);
    }

    // Subtasks
    if (f.subtasks?.length) {
        lines.push('');
        lines.push('## Subtasks');
        lines.push('');
        for (const subtask of f.subtasks) {
            const status = subtask.fields.status.name;
            const checkbox = status.toLowerCase() === 'done' ? '[x]' : '[ ]';
            lines.push(`- ${checkbox} **${subtask.key}**: ${subtask.fields.summary} (${status})`);
        }
    }

    // Comments
    if (f.comment?.comments.length) {
        lines.push('');
        lines.push(`## Comments (${f.comment.total})`);
        for (const comment of f.comment.comments) {
            lines.push('');
            lines.push(`### ${comment.author.displayName} - ${formatDate(comment.created)}`);
            lines.push('');
            lines.push(adfToText(comment.body));
        }
    }

    return lines.join('\n');
}

// Issue list to markdown table
export function formatIssueList(result: JiraSearchResult): string {
    const lines: string[] = [];

    // Handle both old (total) and new (isLast) API response formats
    const count = result.total ?? result.issues.length;
    lines.push(`Found ${count} issue(s)`);
    lines.push('');

    if (result.issues.length === 0) {
        return lines.join('\n');
    }

    lines.push(`| Key | Type | Status | Summary | Assignee | Estimate |`);
    lines.push(`|-----|------|--------|---------|----------|----------|`);

    for (const issue of result.issues) {
        const f = issue.fields;
        const assignee = f.assignee?.displayName ?? 'Unassigned';
        // Truncate summary if too long
        const summary = f.summary.length > 50 ? f.summary.slice(0, 47) + '...' : f.summary;
        const estimate =
            f.timetracking?.remainingEstimate ?? f.timetracking?.originalEstimate ?? '-';
        lines.push(
            `| ${issue.key} | ${f.issuetype.name} | ${f.status.name} | ${summary} | ${assignee} | ${estimate} |`,
        );
    }

    // Show pagination info if there are more results
    if (result.total !== undefined && result.total > result.issues.length) {
        lines.push('');
        lines.push(`*Showing ${result.issues.length} of ${result.total} results*`);
    } else if (result.isLast === false) {
        lines.push('');
        lines.push(`*More results available*`);
    }

    return lines.join('\n');
}

// Projects list to markdown
export function formatProjects(projects: JiraProject[]): string {
    const lines: string[] = [];

    lines.push(`# Projects (${projects.length})`);
    lines.push('');
    lines.push(`| Key | Name | Type |`);
    lines.push(`|-----|------|------|`);

    for (const project of projects) {
        lines.push(`| ${project.key} | ${project.name} | ${project.projectTypeKey} |`);
    }

    return lines.join('\n');
}

// Issue types to markdown
export function formatIssueTypes(projectKey: string, types: JiraIssueType[]): string {
    const lines: string[] = [];

    lines.push(`# Issue Types for ${projectKey}`);
    lines.push('');
    lines.push(`| Name | Subtask | Description |`);
    lines.push(`|------|---------|-------------|`);

    for (const type of types) {
        const desc = type.description?.slice(0, 50) ?? '';
        lines.push(`| ${type.name} | ${type.subtask ? 'Yes' : 'No'} | ${desc} |`);
    }

    return lines.join('\n');
}

// Transitions to markdown
export function formatTransitions(issueKey: string, transitions: JiraTransition[]): string {
    const lines: string[] = [];

    lines.push(`# Available Transitions for ${issueKey}`);
    lines.push('');

    if (transitions.length === 0) {
        lines.push('No transitions available.');
        return lines.join('\n');
    }

    lines.push(`| Transition | Target Status |`);
    lines.push(`|------------|---------------|`);

    for (const t of transitions) {
        lines.push(`| ${t.name} | ${t.to.name} |`);
    }

    return lines.join('\n');
}

// Comments to markdown
export function formatComments(issueKey: string, comments: JiraComment[]): string {
    const lines: string[] = [];

    lines.push(`# Comments on ${issueKey} (${comments.length})`);

    if (comments.length === 0) {
        lines.push('');
        lines.push('No comments.');
        return lines.join('\n');
    }

    for (const comment of comments) {
        lines.push('');
        lines.push(`## ${comment.author.displayName} - ${formatDate(comment.created)}`);
        lines.push('');
        lines.push(adfToText(comment.body));
    }

    return lines.join('\n');
}

// Attachments to markdown
export function formatAttachments(issueKey: string, attachments: JiraAttachment[]): string {
    const lines: string[] = [];

    lines.push(`# Attachments added to ${issueKey}`);
    lines.push('');

    if (attachments.length === 0) {
        lines.push('No attachments added.');
        return lines.join('\n');
    }

    lines.push(`| Filename | Size | Type |`);
    lines.push(`|----------|------|------|`);

    for (const att of attachments) {
        const size =
            att.size < 1024
                ? `${att.size} B`
                : att.size < 1024 * 1024
                  ? `${(att.size / 1024).toFixed(1)} KB`
                  : `${(att.size / 1024 / 1024).toFixed(1)} MB`;
        lines.push(`| ${att.filename} | ${size} | ${att.mimeType} |`);
    }

    return lines.join('\n');
}

// Success message
export function formatSuccess(message: string): string {
    return `**Success:** ${message}`;
}
