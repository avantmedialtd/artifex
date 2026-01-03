// Jira API Types

export interface JiraUser {
    accountId: string;
    emailAddress?: string;
    displayName: string;
    active: boolean;
}

export interface JiraStatus {
    id: string;
    name: string;
    statusCategory: {
        id: number;
        key: string;
        name: string;
    };
}

export interface JiraIssueType {
    id: string;
    name: string;
    description?: string;
    subtask: boolean;
}

export interface JiraPriority {
    id: string;
    name: string;
}

export interface JiraProject {
    id: string;
    key: string;
    name: string;
    projectTypeKey: string;
}

export interface JiraComment {
    id: string;
    author: JiraUser;
    body: string | JiraAdfDocument;
    created: string;
    updated: string;
}

export interface JiraTransition {
    id: string;
    name: string;
    to: JiraStatus;
}

// Atlassian Document Format (ADF) types
export interface JiraAdfDocument {
    type: 'doc';
    version: 1;
    content: JiraAdfNode[];
}

export interface JiraAdfNode {
    type: string;
    content?: JiraAdfNode[];
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface JiraIssueFields {
    summary: string;
    description?: string | JiraAdfDocument | null;
    status: JiraStatus;
    issuetype: JiraIssueType;
    priority?: JiraPriority;
    assignee?: JiraUser | null;
    reporter?: JiraUser;
    project: JiraProject;
    created: string;
    updated: string;
    labels?: string[];
    comment?: {
        comments: JiraComment[];
        total: number;
    };
    parent?: {
        key: string;
        fields: {
            summary: string;
        };
    };
    subtasks?: Array<{
        key: string;
        fields: {
            summary: string;
            status: JiraStatus;
        };
    }>;
}

export interface JiraIssue {
    id: string;
    key: string;
    self: string;
    fields: JiraIssueFields;
}

export interface JiraSearchResult {
    startAt?: number;
    maxResults?: number;
    total?: number;
    // New API uses isLast instead of total (CHANGE-2046 migration)
    isLast?: boolean;
    issues: JiraIssue[];
}

export interface JiraTransitionsResponse {
    transitions: JiraTransition[];
}

export interface JiraCreateIssueRequest {
    fields: {
        project: { key: string };
        issuetype: { name: string };
        summary: string;
        description?: JiraAdfDocument;
        priority?: { name: string };
        assignee?: { accountId: string };
        labels?: string[];
        parent?: { key: string };
    };
}

export interface JiraUpdateIssueRequest {
    fields: Partial<{
        summary: string;
        description: JiraAdfDocument | null;
        priority: { name: string };
        assignee: { accountId: string } | null;
        labels: string[];
    }>;
}

export interface JiraCreateCommentRequest {
    body: JiraAdfDocument;
}

export interface JiraError {
    errorMessages: string[];
    errors: Record<string, string>;
}

// CLI Types
export interface CommandOptions {
    json?: boolean;
    project?: string;
    type?: string;
    summary?: string;
    description?: string;
    priority?: string;
    assignee?: string;
    labels?: string;
    to?: string;
    add?: string;
    limit?: number;
    parent?: string;
}

export interface ParsedArgs {
    command: string;
    args: string[];
    options: CommandOptions;
}
