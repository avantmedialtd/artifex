import { getConfig, type Config } from './config.ts';
import type {
    JiraIssue,
    JiraSearchResult,
    JiraProject,
    JiraIssueType,
    JiraTransitionsResponse,
    JiraComment,
    JiraCreateIssueRequest,
    JiraUpdateIssueRequest,
    JiraAdfDocument,
    JiraError,
    JiraUser,
} from './types.ts';

// Lazy config loading - only fetched when first API call is made
let _config: Config | null = null;

function ensureConfig(): Config {
    if (!_config) {
        _config = getConfig();
    }
    return _config;
}

function getAuthHeader(): string {
    const config = ensureConfig();
    const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    return `Basic ${credentials}`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const config = ensureConfig();
    const url = `${config.baseUrl}/rest/api/3${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: getAuthHeader(),
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const errorData = (await response.json()) as JiraError;
            if (errorData.errorMessages?.length) {
                errorMessage = errorData.errorMessages.join('\n');
            } else if (errorData.errors) {
                errorMessage = Object.entries(errorData.errors)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n');
            }
        } catch {
            // Use default error message
        }
        throw new Error(errorMessage);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return {} as T;
    }

    return response.json() as Promise<T>;
}

// Markdown to ADF conversion
export function textToAdf(text: string): JiraAdfDocument {
    const lines = text.split('\n');
    const content: JiraAdfNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Skip empty lines
        if (line.trim() === '') {
            i++;
            continue;
        }

        // Headings (## Heading)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            content.push({
                type: 'heading',
                attrs: { level },
                content: parseInlineMarkdown(headingMatch[2]),
            });
            i++;
            continue;
        }

        // Unordered list (- item or * item)
        if (/^[-*]\s+/.test(line)) {
            const listItems: JiraAdfNode[] = [];
            while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
                const itemText = lines[i].replace(/^[-*]\s+/, '');
                listItems.push({
                    type: 'listItem',
                    content: [
                        {
                            type: 'paragraph',
                            content: parseInlineMarkdown(itemText),
                        },
                    ],
                });
                i++;
            }
            content.push({
                type: 'bulletList',
                content: listItems,
            });
            continue;
        }

        // Ordered list (1. item)
        if (/^\d+\.\s+/.test(line)) {
            const listItems: JiraAdfNode[] = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
                const itemText = lines[i].replace(/^\d+\.\s+/, '');
                listItems.push({
                    type: 'listItem',
                    content: [
                        {
                            type: 'paragraph',
                            content: parseInlineMarkdown(itemText),
                        },
                    ],
                });
                i++;
            }
            content.push({
                type: 'orderedList',
                content: listItems,
            });
            continue;
        }

        // Regular paragraph - collect consecutive non-empty, non-special lines
        const paragraphLines: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !/^#{1,6}\s+/.test(lines[i]) &&
            !/^[-*]\s+/.test(lines[i]) &&
            !/^\d+\.\s+/.test(lines[i])
        ) {
            paragraphLines.push(lines[i]);
            i++;
        }

        if (paragraphLines.length > 0) {
            const paragraphContent: JiraAdfNode[] = [];
            paragraphLines.forEach((pLine, idx) => {
                paragraphContent.push(...parseInlineMarkdown(pLine));
                if (idx < paragraphLines.length - 1) {
                    paragraphContent.push({ type: 'hardBreak' });
                }
            });
            content.push({
                type: 'paragraph',
                content: paragraphContent,
            });
        }
    }

    return {
        type: 'doc',
        version: 1,
        content,
    };
}

// Parse inline markdown (bold, italic, code, links)
function parseInlineMarkdown(text: string): JiraAdfNode[] {
    const nodes: JiraAdfNode[] = [];
    // Regex to match **bold**, *italic*, `code`, and [text](url)
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) });
        }

        if (match[2]) {
            // Bold **text**
            nodes.push({
                type: 'text',
                text: match[2],
                marks: [{ type: 'strong' }],
            });
        } else if (match[3]) {
            // Italic *text*
            nodes.push({
                type: 'text',
                text: match[3],
                marks: [{ type: 'em' }],
            });
        } else if (match[4]) {
            // Code `text`
            nodes.push({
                type: 'text',
                text: match[4],
                marks: [{ type: 'code' }],
            });
        } else if (match[5] && match[6]) {
            // Link [text](url)
            nodes.push({
                type: 'text',
                text: match[5],
                marks: [{ type: 'link', attrs: { href: match[6] } }],
            });
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        nodes.push({ type: 'text', text: text.slice(lastIndex) });
    }

    // If no matches, return the whole text as a single node
    if (nodes.length === 0) {
        nodes.push({ type: 'text', text });
    }

    return nodes;
}

// ADF to markdown conversion
export function adfToText(adf: JiraAdfDocument | string | null | undefined): string {
    if (!adf) return '';
    if (typeof adf === 'string') return adf;

    interface AdfNode {
        type: string;
        content?: AdfNode[];
        text?: string;
        attrs?: Record<string, unknown>;
        marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
    }

    function convertInlineNode(node: AdfNode): string {
        if (node.type === 'text' && node.text) {
            let text = node.text;
            // Apply marks in reverse order for proper nesting
            if (node.marks) {
                for (const mark of node.marks) {
                    if (mark.type === 'strong') {
                        text = `**${text}**`;
                    } else if (mark.type === 'em') {
                        text = `*${text}*`;
                    } else if (mark.type === 'code') {
                        text = `\`${text}\``;
                    } else if (mark.type === 'link' && mark.attrs?.href) {
                        text = `[${text}](${mark.attrs.href})`;
                    }
                }
            }
            return text;
        }
        if (node.type === 'hardBreak') {
            return '\n';
        }
        if (node.content) {
            return node.content.map(convertInlineNode).join('');
        }
        return '';
    }

    function convertBlock(node: AdfNode, listPrefix = ''): string {
        switch (node.type) {
            case 'heading': {
                const level = (node.attrs?.level as number) ?? 1;
                const prefix = '#'.repeat(level);
                const text = node.content?.map(convertInlineNode).join('') ?? '';
                return `${prefix} ${text}`;
            }

            case 'paragraph': {
                const text = node.content?.map(convertInlineNode).join('') ?? '';
                return listPrefix ? `${listPrefix}${text}` : text;
            }

            case 'bulletList': {
                return node.content?.map(item => convertBlock(item, '- ')).join('\n') ?? '';
            }

            case 'orderedList': {
                return (
                    node.content
                        ?.map((item, idx) => convertBlock(item, `${idx + 1}. `))
                        .join('\n') ?? ''
                );
            }

            case 'listItem': {
                // List items contain paragraphs or other blocks
                return (
                    node.content
                        ?.map((child, idx) => convertBlock(child, idx === 0 ? listPrefix : '   '))
                        .join('\n') ?? ''
                );
            }

            case 'codeBlock': {
                const lang = (node.attrs?.language as string) ?? '';
                const code = node.content?.map(convertInlineNode).join('') ?? '';
                return `\`\`\`${lang}\n${code}\n\`\`\``;
            }

            case 'blockquote': {
                const text = node.content?.map(n => convertBlock(n)).join('\n') ?? '';
                return text
                    .split('\n')
                    .map(line => `> ${line}`)
                    .join('\n');
            }

            case 'rule': {
                return '---';
            }

            default: {
                // Fallback: try to extract text content
                if (node.content) {
                    return node.content.map(n => convertBlock(n)).join('\n');
                }
                return '';
            }
        }
    }

    return adf.content.map(block => convertBlock(block as AdfNode)).join('\n\n');
}

// Issue operations
export async function getIssue(issueKey: string): Promise<JiraIssue> {
    return request<JiraIssue>(`/issue/${issueKey}?expand=renderedFields&fields=*all`);
}

export async function searchIssues(
    jql: string,
    maxResults: number = 50,
): Promise<JiraSearchResult> {
    // Use the new /search/jql endpoint (CHANGE-2046 migration)
    // https://developer.atlassian.com/changelog/#CHANGE-2046
    return request<JiraSearchResult>(
        `/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=*all`,
    );
}

export async function listProjectIssues(
    projectKey: string,
    maxResults: number = 50,
): Promise<JiraSearchResult> {
    return searchIssues(`project = ${projectKey} ORDER BY updated DESC`, maxResults);
}

export async function createIssue(
    projectKey: string,
    issueType: string,
    summary: string,
    description?: string,
    priority?: string,
    labels?: string[],
    parentKey?: string,
    originalEstimate?: string,
): Promise<JiraIssue> {
    const body: JiraCreateIssueRequest = {
        fields: {
            project: { key: projectKey },
            issuetype: { name: issueType },
            summary,
        },
    };

    if (description) {
        body.fields.description = textToAdf(description);
    }
    if (priority) {
        body.fields.priority = { name: priority };
    }
    if (labels?.length) {
        body.fields.labels = labels;
    }
    if (parentKey) {
        body.fields.parent = { key: parentKey };
    }
    if (originalEstimate) {
        body.fields.timetracking = { originalEstimate };
    }

    return request<JiraIssue>('/issue', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function updateIssue(
    issueKey: string,
    updates: {
        summary?: string;
        description?: string;
        priority?: string;
        labels?: string[];
        originalEstimate?: string;
        remainingEstimate?: string;
    },
): Promise<void> {
    const body: JiraUpdateIssueRequest = { fields: {} };

    if (updates.summary !== undefined) {
        body.fields.summary = updates.summary;
    }
    if (updates.description !== undefined) {
        body.fields.description = updates.description ? textToAdf(updates.description) : null;
    }
    if (updates.priority !== undefined) {
        body.fields.priority = { name: updates.priority };
    }
    if (updates.labels !== undefined) {
        body.fields.labels = updates.labels;
    }
    if (updates.originalEstimate !== undefined || updates.remainingEstimate !== undefined) {
        body.fields.timetracking = {};
        if (updates.originalEstimate !== undefined) {
            body.fields.timetracking.originalEstimate = updates.originalEstimate;
        }
        if (updates.remainingEstimate !== undefined) {
            body.fields.timetracking.remainingEstimate = updates.remainingEstimate;
        }
    }

    await request(`/issue/${issueKey}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export async function deleteIssue(issueKey: string): Promise<void> {
    await request(`/issue/${issueKey}`, {
        method: 'DELETE',
    });
}

// Comments
export async function getComments(issueKey: string): Promise<JiraComment[]> {
    const response = await request<{ comments: JiraComment[] }>(`/issue/${issueKey}/comment`);
    return response.comments;
}

export async function addComment(issueKey: string, text: string): Promise<JiraComment> {
    return request<JiraComment>(`/issue/${issueKey}/comment`, {
        method: 'POST',
        body: JSON.stringify({
            body: textToAdf(text),
        }),
    });
}

// Transitions
export async function getTransitions(issueKey: string): Promise<JiraTransitionsResponse> {
    return request<JiraTransitionsResponse>(`/issue/${issueKey}/transitions`);
}

export async function transitionIssue(issueKey: string, transitionName: string): Promise<void> {
    const { transitions } = await getTransitions(issueKey);
    const transition = transitions.find(t => t.name.toLowerCase() === transitionName.toLowerCase());

    if (!transition) {
        const available = transitions.map(t => t.name).join(', ');
        throw new Error(`Transition "${transitionName}" not found. Available: ${available}`);
    }

    await request(`/issue/${issueKey}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ transition: { id: transition.id } }),
    });
}

// Assignment
export async function findUser(query: string): Promise<JiraUser[]> {
    return request<JiraUser[]>(`/user/search?query=${encodeURIComponent(query)}`);
}

export async function assignIssue(issueKey: string, userEmail: string): Promise<void> {
    // First find the user by email
    const users = await findUser(userEmail);
    const user = users.find(u => u.emailAddress?.toLowerCase() === userEmail.toLowerCase());

    if (!user) {
        throw new Error(`User with email "${userEmail}" not found`);
    }

    await request(`/issue/${issueKey}/assignee`, {
        method: 'PUT',
        body: JSON.stringify({ accountId: user.accountId }),
    });
}

export async function unassignIssue(issueKey: string): Promise<void> {
    await request(`/issue/${issueKey}/assignee`, {
        method: 'PUT',
        body: JSON.stringify({ accountId: null }),
    });
}

// Attachments
export interface JiraAttachment {
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    content: string;
    created: string;
    author: JiraUser;
}

export async function addAttachment(issueKey: string, filePath: string): Promise<JiraAttachment[]> {
    const fs = await import('fs');
    const path = await import('path');

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    // Determine MIME type from extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.json': 'application/json',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    // Create form data boundary
    const boundary = '----JiraAttachmentBoundary' + Date.now();

    // Build multipart form data manually
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const headerBuffer = Buffer.from(header, 'utf-8');
    const footerBuffer = Buffer.from(footer, 'utf-8');
    const bodyBuffer = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);

    const config = ensureConfig();
    const url = `${config.baseUrl}/rest/api/3/issue/${issueKey}/attachments`;
    const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'X-Atlassian-Token': 'no-check',
        },
        body: bodyBuffer,
    });

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const errorData = (await response.json()) as JiraError;
            if (errorData.errorMessages?.length) {
                errorMessage = errorData.errorMessages.join('\n');
            }
        } catch {
            // Use default error message
        }
        throw new Error(errorMessage);
    }

    return response.json() as Promise<JiraAttachment[]>;
}

// Projects
export async function getProjects(): Promise<JiraProject[]> {
    return request<JiraProject[]>('/project');
}

// Issue Types
export async function getIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    const project = await request<{ issueTypes: JiraIssueType[] }>(`/project/${projectKey}`);
    return project.issueTypes;
}
