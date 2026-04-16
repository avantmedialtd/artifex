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
} from './types.ts';
import type { JiraFieldCatalogEntry, JiraCreateMetaResponse } from './fields/codec-types.ts';

// Re-export ADF converters for backward compatibility
export { textToAdf, adfToText };

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
        throw new Error(errorMessage);
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
