/**
 * Confluence API client.
 *
 * Uses v2 API (/wiki/api/v2/) for most operations.
 * Falls back to v1 API (/wiki/rest/api/) for search, label management, and attachment uploads.
 */

import {
    request as sharedRequest,
    getAuthHeader,
    getBaseUrl,
} from '../../atlassian/lib/request.ts';
import { textToAdf, adfToText } from '../../atlassian/lib/adf.ts';
import type {
    ConfluencePage,
    ConfluenceSpace,
    ConfluenceComment,
    ConfluenceLabel,
    ConfluenceAttachment,
    ConfluencePaginatedResponse,
    ConfluenceSearchResult,
    ConfluenceCreatePageRequest,
    ConfluenceUpdatePageRequest,
} from './types.ts';

export { textToAdf, adfToText };

// API request helpers

function v2Url(endpoint: string): string {
    return `${getBaseUrl()}/wiki/api/v2${endpoint}`;
}

function v1Url(endpoint: string): string {
    return `${getBaseUrl()}/wiki/rest/api${endpoint}`;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    return sharedRequest<T>(url, options);
}

// Space operations

export async function listSpaces(
    limit: number = 50,
): Promise<ConfluencePaginatedResponse<ConfluenceSpace>> {
    return request<ConfluencePaginatedResponse<ConfluenceSpace>>(v2Url(`/spaces?limit=${limit}`));
}

export async function getSpace(spaceId: string): Promise<ConfluenceSpace> {
    return request<ConfluenceSpace>(v2Url(`/spaces/${spaceId}`));
}

export async function getSpaceByKey(spaceKey: string): Promise<ConfluenceSpace> {
    const result = await request<ConfluencePaginatedResponse<ConfluenceSpace>>(
        v2Url(`/spaces?keys=${encodeURIComponent(spaceKey)}&limit=1`),
    );
    if (result.results.length === 0) {
        throw new Error(`Space with key "${spaceKey}" not found`);
    }
    return result.results[0];
}

// Page operations

export async function getPage(pageId: string): Promise<ConfluencePage> {
    return request<ConfluencePage>(v2Url(`/pages/${pageId}?body-format=atlas_doc_format`));
}

export async function listPages(
    spaceKey: string,
    limit: number = 50,
): Promise<ConfluencePaginatedResponse<ConfluencePage>> {
    // v2 API requires space ID, so resolve key to ID first
    const space = await getSpaceByKey(spaceKey);
    return request<ConfluencePaginatedResponse<ConfluencePage>>(
        v2Url(`/spaces/${space.id}/pages?limit=${limit}&body-format=atlas_doc_format`),
    );
}

export async function createPage(
    spaceKey: string,
    title: string,
    bodyMarkdown: string,
    parentId?: string,
    status: 'current' | 'draft' = 'current',
): Promise<ConfluencePage> {
    const space = await getSpaceByKey(spaceKey);
    const adf = textToAdf(bodyMarkdown);

    const body: ConfluenceCreatePageRequest = {
        spaceId: space.id,
        status,
        title,
        body: {
            representation: 'atlas_doc_format',
            value: JSON.stringify(adf),
        },
    };

    if (parentId) {
        body.parentId = parentId;
    }

    return request<ConfluencePage>(v2Url('/pages'), {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function updatePage(
    pageId: string,
    updates: {
        title?: string;
        bodyMarkdown?: string;
        status?: 'current' | 'draft';
        versionMessage?: string;
    },
): Promise<ConfluencePage> {
    // Fetch current page to get version number and current values
    const current = await getPage(pageId);
    const currentVersion = current.version?.number ?? 0;

    const title = updates.title ?? current.title;
    const status = updates.status ?? (current.status as 'current' | 'draft');

    // Build body - use new content or keep current
    let bodyValue: string;
    if (updates.bodyMarkdown !== undefined) {
        const adf = textToAdf(updates.bodyMarkdown);
        bodyValue = JSON.stringify(adf);
    } else if (current.body?.atlas_doc_format?.value) {
        bodyValue = current.body.atlas_doc_format.value;
    } else {
        bodyValue = JSON.stringify(textToAdf(''));
    }

    const body: ConfluenceUpdatePageRequest = {
        id: pageId,
        status,
        title,
        body: {
            representation: 'atlas_doc_format',
            value: bodyValue,
        },
        version: {
            number: currentVersion + 1,
            message: updates.versionMessage,
        },
    };

    return request<ConfluencePage>(v2Url(`/pages/${pageId}`), {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

export async function deletePage(pageId: string): Promise<void> {
    await request(v2Url(`/pages/${pageId}`), {
        method: 'DELETE',
    });
}

// Page hierarchy

export async function getChildPages(
    pageId: string,
    limit: number = 50,
): Promise<ConfluencePaginatedResponse<ConfluencePage>> {
    return request<ConfluencePaginatedResponse<ConfluencePage>>(
        v2Url(`/pages/${pageId}/children?limit=${limit}`),
    );
}

export async function getAncestors(
    pageId: string,
): Promise<ConfluencePaginatedResponse<ConfluencePage>> {
    return request<ConfluencePaginatedResponse<ConfluencePage>>(
        v2Url(`/pages/${pageId}/ancestors`),
    );
}

// Comments (v2 API - footer comments)

export async function getComments(
    pageId: string,
    limit: number = 50,
): Promise<ConfluencePaginatedResponse<ConfluenceComment>> {
    return request<ConfluencePaginatedResponse<ConfluenceComment>>(
        v2Url(`/pages/${pageId}/footer-comments?body-format=atlas_doc_format&limit=${limit}`),
    );
}

export async function addComment(pageId: string, bodyMarkdown: string): Promise<ConfluenceComment> {
    const adf = textToAdf(bodyMarkdown);
    return request<ConfluenceComment>(v2Url('/footer-comments'), {
        method: 'POST',
        body: JSON.stringify({
            pageId,
            body: {
                representation: 'atlas_doc_format',
                value: JSON.stringify(adf),
            },
        }),
    });
}

// Labels (v2 read, v1 write)

export async function getLabels(
    pageId: string,
    limit: number = 50,
): Promise<ConfluencePaginatedResponse<ConfluenceLabel>> {
    return request<ConfluencePaginatedResponse<ConfluenceLabel>>(
        v2Url(`/pages/${pageId}/labels?limit=${limit}`),
    );
}

export async function addLabels(pageId: string, labels: string[]): Promise<ConfluenceLabel[]> {
    const body = labels.map(name => ({ prefix: 'global', name }));
    return request<ConfluenceLabel[]>(v1Url(`/content/${pageId}/label`), {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function removeLabel(pageId: string, label: string): Promise<void> {
    await request(v1Url(`/content/${pageId}/label/${encodeURIComponent(label)}`), {
        method: 'DELETE',
    });
}

// Attachments (v2 read, v1 write)

export async function getAttachments(
    pageId: string,
    limit: number = 50,
): Promise<ConfluencePaginatedResponse<ConfluenceAttachment>> {
    return request<ConfluencePaginatedResponse<ConfluenceAttachment>>(
        v2Url(`/pages/${pageId}/attachments?limit=${limit}`),
    );
}

export async function addAttachment(
    pageId: string,
    filePath: string,
): Promise<{ results: ConfluenceAttachment[] }> {
    const fs = await import('fs');
    const path = await import('path');

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

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

    const boundary = '----ConfluenceAttachmentBoundary' + Date.now();
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const headerBuffer = Buffer.from(header, 'utf-8');
    const footerBuffer = Buffer.from(footer, 'utf-8');
    const bodyBuffer = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);

    const url = `${getBaseUrl()}/wiki/rest/api/content/${pageId}/child/attachment`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: getAuthHeader(),
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'X-Atlassian-Token': 'no-check',
        },
        body: bodyBuffer,
    });

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const errorData = (await response.json()) as { message?: string };
            if (errorData.message) {
                errorMessage = errorData.message;
            }
        } catch {
            // Use default error message
        }
        throw new Error(errorMessage);
    }

    return response.json() as Promise<{ results: ConfluenceAttachment[] }>;
}

// Search (v1 API - CQL search)

export async function search(cql: string, limit: number = 50): Promise<ConfluenceSearchResult> {
    return request<ConfluenceSearchResult>(
        v1Url(`/content/search?cql=${encodeURIComponent(cql)}&limit=${limit}`),
    );
}
