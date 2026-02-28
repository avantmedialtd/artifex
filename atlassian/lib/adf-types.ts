// Atlassian Document Format (ADF) types
// Shared between Jira and Confluence

export interface AdfDocument {
    type: 'doc';
    version: 1;
    content: AdfNode[];
}

export interface AdfNode {
    type: string;
    content?: AdfNode[];
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}
