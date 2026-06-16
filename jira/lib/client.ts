import { getConfig, type Config } from './config.ts';
import {
    getAuthHeader as getSharedAuthHeader,
    getBaseUrl as getSharedBaseUrl,
} from '../../atlassian/lib/request.ts';
import { textToAdf, adfToText } from '../../atlassian/lib/adf.ts';
import type {
    JiraIssue,
    JiraSearchResult,
    JiraProject,
    JiraIssueType,
    JiraTransitionsResponse,
    JiraComment,
    JiraCreateIssueRequest,
    JiraUpdateIssueRequest,
    JiraError,
    JiraUser,
    JiraVersion,
    JiraCreateVersionRequest,
    JiraUpdateVersionRequest,
    JiraRemoteLink,
    JiraVisibility,
    JiraEditMetaResponse,
    BulkTaskSubmitResponse,
    BulkTaskStatus,
} from './types.ts';
import type { JiraFieldCatalogEntry, JiraCreateMetaResponse } from './fields/codec-types.ts';

// Re-export ADF converters for backward compatibility
export { textToAdf, adfToText };

/**
 * Error thrown for non-2xx Jira responses. Carries the HTTP status so callers
 * can react to specific codes (e.g. retry a transition on 409 Conflict).
 */
export class JiraApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'JiraApiError';
        this.status = status;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Lazy config loading - only fetched when first API call is made
let _config: Config | null = null;

function ensureConfig(): Config {
    if (!_config) {
        _config = getConfig();
    }
    return _config;
}

function getAuthHeader(): string {
    return getSharedAuthHeader();
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = getSharedBaseUrl();
    const url = `${baseUrl}/rest/api/3${endpoint}`;

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
        throw new JiraApiError(errorMessage, response.status);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return {} as T;
    }

    return response.json() as Promise<T>;
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
    fixVersions?: string[],
    affectedVersions?: string[],
    customFields?: Record<string, unknown>,
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
    if (fixVersions?.length) {
        body.fields.fixVersions = fixVersions.map(name => ({ name }));
    }
    if (affectedVersions?.length) {
        body.fields.versions = affectedVersions.map(name => ({ name }));
    }
    if (customFields) {
        for (const [key, value] of Object.entries(customFields)) {
            body.fields[key] = value;
        }
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
        fixVersions?: string[];
        affectedVersions?: string[];
        parent?: string;
        clearParent?: boolean;
        customFields?: Record<string, unknown>;
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
    if (updates.fixVersions !== undefined) {
        body.fields.fixVersions = updates.fixVersions.map(name => ({ name }));
    }
    if (updates.affectedVersions !== undefined) {
        body.fields.versions = updates.affectedVersions.map(name => ({ name }));
    }
    // `parent` is the canonical field for both subtask parents and epic-level
    // parents (it replaced the deprecated Epic Link). Clearing via `null` is
    // undocumented and project-type-dependent — treated as provisional.
    if (updates.clearParent) {
        body.fields.parent = null;
    } else if (updates.parent !== undefined) {
        body.fields.parent = { key: updates.parent };
    }
    if (updates.customFields) {
        for (const [key, value] of Object.entries(updates.customFields)) {
            body.fields[key] = value;
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

export async function addComment(
    issueKey: string,
    text: string,
    visibility?: JiraVisibility,
): Promise<JiraComment> {
    const body: { body: unknown; visibility?: JiraVisibility } = { body: textToAdf(text) };
    if (visibility) body.visibility = visibility;
    return request<JiraComment>(`/issue/${issueKey}/comment`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function updateComment(
    issueKey: string,
    commentId: string,
    text: string,
    visibility?: JiraVisibility,
): Promise<JiraComment> {
    const body: { body: unknown; visibility?: JiraVisibility } = { body: textToAdf(text) };
    if (visibility) body.visibility = visibility;
    return request<JiraComment>(`/issue/${issueKey}/comment/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export async function deleteComment(issueKey: string, commentId: string): Promise<void> {
    await request(`/issue/${issueKey}/comment/${commentId}`, {
        method: 'DELETE',
    });
}

/**
 * Add a Jira Service Management request comment, choosing public vs internal.
 * The platform comment API's `jsdPublic` flag is read-only, so internal/public
 * notes go through the JSM API (a different base path). The body is plain text.
 */
export async function addServiceDeskComment(
    issueKey: string,
    text: string,
    isPublic: boolean,
): Promise<JiraComment> {
    const baseUrl = getSharedBaseUrl();
    const url = `${baseUrl}/rest/servicedeskapi/request/${issueKey}/comment`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: getAuthHeader(),
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ body: text, public: isPublic }),
    });
    if (!response.ok) {
        throw new JiraApiError(`HTTP ${response.status}: ${response.statusText}`, response.status);
    }
    return response.json() as Promise<JiraComment>;
}

// Edit metadata — the per-issue, edit-context twin of createmeta.
export async function getEditMeta(issueKey: string): Promise<JiraEditMetaResponse> {
    return request<JiraEditMetaResponse>(`/issue/${issueKey}/editmeta`);
}

// Bulk operations (async). All submits return a taskId; poll /bulk/queue/{taskId}.
const BULK_FAILURE_STATES = ['FAIL', 'DEAD', 'CANCEL'];

export async function getBulkTaskStatus(taskId: string): Promise<BulkTaskStatus> {
    return request<BulkTaskStatus>(`/bulk/queue/${taskId}`);
}

/**
 * Poll a bulk task until it reaches a terminal state. Resolves on success,
 * throws on a failure/cancelled state, and throws if it never settles. The
 * failure-state enum is not fully documented, so matching is substring-based.
 */
export async function pollBulkTask(
    taskId: string,
    options: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<BulkTaskStatus> {
    const interval = options.intervalMs ?? 1000;
    const maxAttempts = options.maxAttempts ?? 120;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = await getBulkTaskStatus(taskId);
        const s = (status.status ?? '').toUpperCase();
        if (s.includes('COMPLETE')) return status;
        if (BULK_FAILURE_STATES.some(f => s.includes(f))) {
            throw new Error(`Bulk task ${taskId} ended with status ${status.status}`);
        }
        await sleep(interval);
    }
    throw new Error(`Bulk task ${taskId} did not complete after ${maxAttempts} polls`);
}

export async function submitBulkMove(
    mapping: Record<string, unknown>,
    sendBulkNotification = false,
): Promise<string> {
    const res = await request<BulkTaskSubmitResponse>('/bulk/issues/move', {
        method: 'POST',
        body: JSON.stringify({ sendBulkNotification, targetToSourcesMapping: mapping }),
    });
    return res.taskId;
}

/**
 * Move one issue to another project (and optionally a new issue type) via the
 * async bulk move endpoint. The target type defaults to the issue's current
 * type. Status/field defaults are inferred so callers need not hand-map them.
 */
export async function moveIssue(
    issueKey: string,
    toProjectKey: string,
    options: { type?: string; intervalMs?: number; maxAttempts?: number } = {},
): Promise<BulkTaskStatus> {
    let typeName = options.type;
    if (!typeName) {
        const issue = await getIssue(issueKey);
        typeName = issue.fields.issuetype.name;
    }
    const types = await getIssueTypes(toProjectKey);
    const match = types.find(t => t.name.toLowerCase() === typeName.toLowerCase());
    if (!match) {
        const available = types.map(t => t.name).join(', ');
        throw new Error(
            `Issue type "${typeName}" not found in project ${toProjectKey}. Available: ${available}`,
        );
    }
    // Mapping key is the target descriptor "PROJECT-KEY,<issueTypeId>".
    const mapping = {
        [`${toProjectKey},${match.id}`]: {
            issueIdsOrKeys: [issueKey],
            inferStatusDefaults: true,
            inferFieldDefaults: true,
            inferSubtaskTypeDefault: true,
            inferClassificationDefaults: true,
        },
    };
    const taskId = await submitBulkMove(mapping);
    return pollBulkTask(taskId, {
        intervalMs: options.intervalMs,
        maxAttempts: options.maxAttempts,
    });
}

// Bulk edit / transition / delete over a set of issue keys.
export const BULK_MAX_ISSUES = 1000;

export function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

export async function submitBulkDelete(issueKeys: string[]): Promise<string> {
    const res = await request<BulkTaskSubmitResponse>('/bulk/issues/delete', {
        method: 'POST',
        body: JSON.stringify({ selectedIssueIdsOrKeys: issueKeys }),
    });
    return res.taskId;
}

export async function submitBulkTransition(
    issueKeys: string[],
    transitionId: string,
): Promise<string> {
    const res = await request<BulkTaskSubmitResponse>('/bulk/issues/transition', {
        method: 'POST',
        body: JSON.stringify({
            bulkTransitionInputs: [{ selectedIssueIdsOrKeys: issueKeys, transitionId }],
        }),
    });
    return res.taskId;
}

export async function submitBulkEdit(
    issueKeys: string[],
    editedFieldsInput: Record<string, unknown>,
): Promise<string> {
    const res = await request<BulkTaskSubmitResponse>('/bulk/issues/fields', {
        method: 'POST',
        body: JSON.stringify({
            selectedIssueIdsOrKeys: issueKeys,
            selectedActions: Object.keys(editedFieldsInput),
            editedFieldsInput,
        }),
    });
    return res.taskId;
}

/**
 * Apply a bulk submit over a set of issue keys, chunked to the per-request cap
 * and run serially (so at most one bulk task is in flight, well within the
 * global 5-concurrent ceiling). Returns each chunk's final task status.
 */
export async function runBulkOverKeys(
    keys: string[],
    submit: (chunk: string[]) => Promise<string>,
    options: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<BulkTaskStatus[]> {
    const results: BulkTaskStatus[] = [];
    for (const part of chunk(keys, BULK_MAX_ISSUES)) {
        const taskId = await submit(part);
        results.push(await pollBulkTask(taskId, options));
    }
    return results;
}

// Transitions
export async function getTransitions(
    issueKey: string,
    options: { expandFields?: boolean } = {},
): Promise<JiraTransitionsResponse> {
    const query = options.expandFields ? '?expand=transitions.fields' : '';
    return request<JiraTransitionsResponse>(`/issue/${issueKey}/transitions${query}`);
}

export interface TransitionOptions {
    // Sets the Resolution field on the transition screen (e.g. "Fixed", "Won't Do").
    resolution?: string;
    // Added as a comment in the same request, rendered as ADF.
    comment?: string;
    // Raw transition-screen fields merged into the `fields` body (advanced).
    fields?: Record<string, unknown>;
}

export async function transitionIssue(
    issueKey: string,
    transitionName: string,
    options: TransitionOptions = {},
): Promise<void> {
    const { transitions } = await getTransitions(issueKey);
    const transition = transitions.find(t => t.name.toLowerCase() === transitionName.toLowerCase());

    if (!transition) {
        const available = transitions.map(t => t.name).join(', ');
        throw new Error(`Transition "${transitionName}" not found. Available: ${available}`);
    }

    // A field must appear in either `fields` or `update`, never both. The
    // resolution and any raw screen fields go in `fields`; the comment goes
    // in `update.comment` as ADF.
    const body: {
        transition: { id: string };
        fields?: Record<string, unknown>;
        update?: Record<string, unknown>;
    } = { transition: { id: transition.id } };

    const fields: Record<string, unknown> = { ...options.fields };
    if (options.resolution) {
        fields.resolution = { name: options.resolution };
    }
    if (Object.keys(fields).length > 0) {
        body.fields = fields;
    }
    if (options.comment) {
        body.update = { comment: [{ add: { body: textToAdf(options.comment) } }] };
    }

    // Jira returns 409 when another transition is already in flight; retry with backoff.
    for (let attempt = 1; ; attempt++) {
        try {
            await request(`/issue/${issueKey}/transitions`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            return;
        } catch (err) {
            if (err instanceof JiraApiError && err.status === 409 && attempt < 3) {
                await sleep(attempt * 250);
                continue;
            }
            throw err;
        }
    }
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

// Issue Links
export async function linkIssue(
    outwardIssueKey: string,
    linkType: string,
    inwardIssueKey: string,
): Promise<void> {
    await request('/issueLink', {
        method: 'POST',
        body: JSON.stringify({
            type: { name: linkType },
            outwardIssue: { key: outwardIssueKey },
            inwardIssue: { key: inwardIssueKey },
        }),
    });
}

export async function unlinkIssue(linkId: string): Promise<void> {
    await request(`/issueLink/${linkId}`, {
        method: 'DELETE',
    });
}

// Remote Links
export async function getRemoteLinks(issueKey: string): Promise<JiraRemoteLink[]> {
    return request<JiraRemoteLink[]>(`/issue/${issueKey}/remotelink`);
}

export async function addRemoteLink(issueKey: string, url: string, title: string): Promise<void> {
    await request(`/issue/${issueKey}/remotelink`, {
        method: 'POST',
        body: JSON.stringify({
            object: { url, title },
        }),
    });
}

export async function removeRemoteLink(issueKey: string, linkId: string): Promise<void> {
    await request(`/issue/${issueKey}/remotelink/${linkId}`, {
        method: 'DELETE',
    });
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

// Field catalog (instance-wide)
export async function getFields(): Promise<JiraFieldCatalogEntry[]> {
    return request<JiraFieldCatalogEntry[]>('/field');
}

// createmeta for a project + issue type (resolves type name → id first)
export async function getCreateMeta(
    projectKey: string,
    issueTypeName: string,
): Promise<JiraCreateMetaResponse> {
    const types = await getIssueTypes(projectKey);
    const match = types.find(t => t.name.toLowerCase() === issueTypeName.toLowerCase());
    if (!match) {
        const available = types.map(t => t.name).join(', ');
        throw new Error(
            `Issue type "${issueTypeName}" not found in project ${projectKey}. Available: ${available}`,
        );
    }
    return request<JiraCreateMetaResponse>(
        `/issue/createmeta/${projectKey}/issuetypes/${match.id}`,
    );
}

// Versions
export async function getProjectVersions(projectKey: string): Promise<JiraVersion[]> {
    return request<JiraVersion[]>(`/project/${projectKey}/versions`);
}

export async function getVersion(versionId: string): Promise<JiraVersion> {
    return request<JiraVersion>(`/version/${versionId}`);
}

export async function createVersion(
    projectKey: string,
    name: string,
    options?: {
        description?: string;
        startDate?: string;
        releaseDate?: string;
        released?: boolean;
    },
): Promise<JiraVersion> {
    // First get the project to obtain the numeric project ID
    const project = await request<{ id: string }>(`/project/${projectKey}`);

    const body: JiraCreateVersionRequest = {
        name,
        projectId: parseInt(project.id, 10),
    };

    if (options?.description) {
        body.description = options.description;
    }
    if (options?.startDate) {
        body.startDate = options.startDate;
    }
    if (options?.releaseDate) {
        body.releaseDate = options.releaseDate;
    }
    if (options?.released !== undefined) {
        body.released = options.released;
    }

    return request<JiraVersion>('/version', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function updateVersion(
    versionId: string,
    updates: {
        name?: string;
        description?: string;
        startDate?: string;
        releaseDate?: string;
        released?: boolean;
    },
): Promise<JiraVersion> {
    const body: JiraUpdateVersionRequest = {};

    if (updates.name !== undefined) {
        body.name = updates.name;
    }
    if (updates.description !== undefined) {
        body.description = updates.description;
    }
    if (updates.startDate !== undefined) {
        body.startDate = updates.startDate;
    }
    if (updates.releaseDate !== undefined) {
        body.releaseDate = updates.releaseDate;
    }
    if (updates.released !== undefined) {
        body.released = updates.released;
    }

    return request<JiraVersion>(`/version/${versionId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export async function deleteVersion(
    versionId: string,
    options?: {
        moveFixIssuesTo?: string;
        moveAffectedIssuesTo?: string;
    },
): Promise<void> {
    let endpoint = `/version/${versionId}`;
    const params: string[] = [];

    if (options?.moveFixIssuesTo) {
        params.push(`moveFixIssuesTo=${options.moveFixIssuesTo}`);
    }
    if (options?.moveAffectedIssuesTo) {
        params.push(`moveAffectedIssuesTo=${options.moveAffectedIssuesTo}`);
    }
    if (params.length > 0) {
        endpoint += `?${params.join('&')}`;
    }

    await request(endpoint, {
        method: 'DELETE',
    });
}
