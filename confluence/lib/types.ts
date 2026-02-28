// Confluence API Types

import type { AdfDocument } from '../../atlassian/lib/adf-types.ts';

export interface ConfluenceVersion {
    number: number;
    message?: string;
    minorEdit?: boolean;
    authorId?: string;
    createdAt: string;
}

export interface ConfluenceBody {
    storage?: { representation: string; value: string };
    atlas_doc_format?: { representation: string; value: string };
}

export interface ConfluencePage {
    id: string;
    status: 'current' | 'draft' | 'trashed';
    title: string;
    spaceId: string;
    parentId?: string;
    parentType?: string;
    position?: number;
    authorId?: string;
    ownerId?: string;
    createdAt?: string;
    version?: ConfluenceVersion;
    body?: ConfluenceBody;
    _links?: {
        webui?: string;
        editui?: string;
        tinyui?: string;
    };
}

export interface ConfluenceSpace {
    id: string;
    key: string;
    name: string;
    type: 'global' | 'personal';
    status: string;
    description?: { plain?: { value: string } };
    homepageId?: string;
    _links?: { webui?: string };
}

export interface ConfluenceComment {
    id: string;
    status: string;
    title?: string;
    parentCommentId?: string;
    version?: ConfluenceVersion;
    body?: ConfluenceBody;
    _links?: { webui?: string };
}

export interface ConfluenceLabel {
    id: string;
    name: string;
    prefix: string;
}

export interface ConfluenceAttachment {
    id: string;
    status: string;
    title: string;
    mediaType: string;
    fileSize: number;
    webuiLink?: string;
    downloadLink?: string;
    version?: ConfluenceVersion;
}

export interface ConfluencePaginatedResponse<T> {
    results: T[];
    _links?: {
        next?: string;
        base?: string;
    };
}

// v1 search result type (CQL search uses v1 API)
export interface ConfluenceSearchResult {
    results: Array<{
        content: {
            id: string;
            type: string;
            status: string;
            title: string;
            _links: { webui: string };
        };
        excerpt?: string;
        lastModified?: string;
    }>;
    totalSize: number;
    start: number;
    limit: number;
    _links?: { next?: string };
}

// Request types for create/update operations
export interface ConfluenceCreatePageRequest {
    spaceId: string;
    status: 'current' | 'draft';
    title: string;
    parentId?: string;
    body: {
        representation: 'atlas_doc_format' | 'storage';
        value: string;
    };
}

export interface ConfluenceUpdatePageRequest {
    id: string;
    status: 'current' | 'draft';
    title: string;
    body: {
        representation: 'atlas_doc_format' | 'storage';
        value: string;
    };
    version: {
        number: number;
        message?: string;
    };
}

export { AdfDocument };
