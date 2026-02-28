import type {
    ConfluencePage,
    ConfluenceSpace,
    ConfluenceComment,
    ConfluenceLabel,
    ConfluenceAttachment,
    ConfluencePaginatedResponse,
    ConfluenceSearchResult,
} from './types.ts';
import { adfToText } from '../../atlassian/lib/adf.ts';
import type { AdfDocument } from '../../atlassian/lib/adf-types.ts';
import { link } from '../../utils/output.ts';

// Confluence URL helpers
function getBaseUrl(): string {
    return (process.env.ATLASSIAN_BASE_URL || process.env.JIRA_BASE_URL)?.replace(/\/$/, '') ?? '';
}

export function pageLink(pageId: string, title: string, webui?: string): string {
    const baseUrl = getBaseUrl();
    if (!baseUrl) return `${title} (${pageId})`;
    const url = webui ? `${baseUrl}/wiki${webui}` : `${baseUrl}/wiki/pages/${pageId}`;
    return link(title, url);
}

function spaceLink(spaceKey: string, webui?: string): string {
    const baseUrl = getBaseUrl();
    if (!baseUrl) return spaceKey;
    const url = webui ? `${baseUrl}/wiki${webui}` : `${baseUrl}/wiki/spaces/${spaceKey}`;
    return link(spaceKey, url);
}

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

// Parse ADF body from Confluence page/comment
function parseBody(body?: {
    storage?: { representation: string; value: string };
    atlas_doc_format?: { representation: string; value: string };
}): string {
    if (!body) return '';

    if (body.atlas_doc_format?.value) {
        try {
            const adf = JSON.parse(body.atlas_doc_format.value) as AdfDocument;
            return adfToText(adf);
        } catch {
            return body.atlas_doc_format.value;
        }
    }

    if (body.storage?.value) {
        // Storage format is XHTML - return as-is for now
        return body.storage.value;
    }

    return '';
}

// Single page to markdown
export function formatPage(page: ConfluencePage): string {
    const lines: string[] = [];

    lines.push(`# ${pageLink(page.id, page.title, page._links?.webui)}`);
    lines.push('');
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| ID | ${page.id} |`);
    lines.push(`| Status | ${page.status} |`);
    lines.push(`| Space ID | ${page.spaceId} |`);

    if (page.parentId) {
        lines.push(`| Parent ID | ${page.parentId} |`);
    }

    if (page.version) {
        lines.push(`| Version | ${page.version.number} |`);
        lines.push(`| Updated | ${formatDate(page.version.createdAt)} |`);
        if (page.version.message) {
            lines.push(`| Version Message | ${page.version.message} |`);
        }
    }

    if (page.createdAt) {
        lines.push(`| Created | ${formatDate(page.createdAt)} |`);
    }

    // Body content
    const content = parseBody(page.body);
    if (content) {
        lines.push('');
        lines.push('## Content');
        lines.push('');
        lines.push(content);
    }

    return lines.join('\n');
}

// Page list to markdown table
export function formatPageList(result: ConfluencePaginatedResponse<ConfluencePage>): string {
    const lines: string[] = [];

    lines.push(`Found ${result.results.length} page(s)`);
    lines.push('');

    if (result.results.length === 0) {
        return lines.join('\n');
    }

    lines.push(`| ID | Title | Status | Updated |`);
    lines.push(`|----|-------|--------|---------|`);

    for (const page of result.results) {
        const title = page.title.length > 50 ? page.title.slice(0, 47) + '...' : page.title;
        const updated = page.version ? formatDate(page.version.createdAt) : '-';
        lines.push(
            `| ${page.id} | ${pageLink(page.id, title, page._links?.webui)} | ${page.status} | ${updated} |`,
        );
    }

    if (result._links?.next) {
        lines.push('');
        lines.push('*More results available*');
    }

    return lines.join('\n');
}

// Spaces list to markdown
export function formatSpaces(result: ConfluencePaginatedResponse<ConfluenceSpace>): string {
    const lines: string[] = [];

    lines.push(`# Spaces (${result.results.length})`);
    lines.push('');
    lines.push(`| Key | Name | Type | Status |`);
    lines.push(`|-----|------|------|--------|`);

    for (const space of result.results) {
        lines.push(
            `| ${spaceLink(space.key, space._links?.webui)} | ${space.name} | ${space.type} | ${space.status} |`,
        );
    }

    return lines.join('\n');
}

// Single space to markdown
export function formatSpace(space: ConfluenceSpace): string {
    const lines: string[] = [];

    lines.push(`# Space: ${spaceLink(space.key, space._links?.webui)} - ${space.name}`);
    lines.push('');
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| ID | ${space.id} |`);
    lines.push(`| Key | ${space.key} |`);
    lines.push(`| Type | ${space.type} |`);
    lines.push(`| Status | ${space.status} |`);

    if (space.homepageId) {
        lines.push(`| Homepage ID | ${space.homepageId} |`);
    }

    if (space.description?.plain?.value) {
        lines.push('');
        lines.push('## Description');
        lines.push('');
        lines.push(space.description.plain.value);
    }

    return lines.join('\n');
}

// Comments to markdown
export function formatComments(
    pageId: string,
    result: ConfluencePaginatedResponse<ConfluenceComment>,
): string {
    const lines: string[] = [];

    lines.push(`# Comments on page ${pageId} (${result.results.length})`);

    if (result.results.length === 0) {
        lines.push('');
        lines.push('No comments.');
        return lines.join('\n');
    }

    for (const comment of result.results) {
        lines.push('');
        const date = comment.version ? formatDate(comment.version.createdAt) : '';
        lines.push(`## Comment ${comment.id} - ${date}`);
        lines.push('');
        lines.push(parseBody(comment.body));
    }

    return lines.join('\n');
}

// Labels to markdown
export function formatLabels(
    pageId: string,
    result: ConfluencePaginatedResponse<ConfluenceLabel>,
): string {
    const lines: string[] = [];

    lines.push(`# Labels on page ${pageId} (${result.results.length})`);
    lines.push('');

    if (result.results.length === 0) {
        lines.push('No labels.');
        return lines.join('\n');
    }

    lines.push(`| Name | Prefix |`);
    lines.push(`|------|--------|`);

    for (const label of result.results) {
        lines.push(`| ${label.name} | ${label.prefix} |`);
    }

    return lines.join('\n');
}

// Attachments to markdown
export function formatAttachments(
    pageId: string,
    result: ConfluencePaginatedResponse<ConfluenceAttachment>,
): string {
    const lines: string[] = [];

    lines.push(`# Attachments on page ${pageId} (${result.results.length})`);
    lines.push('');

    if (result.results.length === 0) {
        lines.push('No attachments.');
        return lines.join('\n');
    }

    lines.push(`| Filename | Size | Type |`);
    lines.push(`|----------|------|------|`);

    for (const att of result.results) {
        const size =
            att.fileSize < 1024
                ? `${att.fileSize} B`
                : att.fileSize < 1024 * 1024
                  ? `${(att.fileSize / 1024).toFixed(1)} KB`
                  : `${(att.fileSize / 1024 / 1024).toFixed(1)} MB`;
        lines.push(`| ${att.title} | ${size} | ${att.mediaType} |`);
    }

    return lines.join('\n');
}

// Search results to markdown
export function formatSearchResults(result: ConfluenceSearchResult): string {
    const lines: string[] = [];

    lines.push(`Found ${result.totalSize} result(s)`);
    lines.push('');

    if (result.results.length === 0) {
        return lines.join('\n');
    }

    lines.push(`| ID | Type | Title | Excerpt |`);
    lines.push(`|----|------|-------|---------|`);

    for (const item of result.results) {
        const c = item.content;
        const title = c.title.length > 40 ? c.title.slice(0, 37) + '...' : c.title;
        const excerpt = item.excerpt ? item.excerpt.replace(/<[^>]*>/g, '').slice(0, 50) : '-';
        const linkedTitle = pageLink(c.id, title, c._links.webui);
        lines.push(`| ${c.id} | ${c.type} | ${linkedTitle} | ${excerpt} |`);
    }

    if (result.totalSize > result.results.length) {
        lines.push('');
        lines.push(`*Showing ${result.results.length} of ${result.totalSize} results*`);
    }

    return lines.join('\n');
}

// Page tree display
export function formatPageTree(page: ConfluencePage, children: ConfluencePage[]): string {
    const lines: string[] = [];

    lines.push(`# Page Tree: ${pageLink(page.id, page.title, page._links?.webui)}`);
    lines.push('');

    lines.push(`${page.title} (${page.id})`);
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const isLast = i === children.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        lines.push(`${prefix}${child.title} (${child.id})`);
    }

    if (children.length === 0) {
        lines.push('  (no child pages)');
    }

    return lines.join('\n');
}

// Success message
export function formatSuccess(message: string): string {
    return `**Success:** ${message}`;
}
