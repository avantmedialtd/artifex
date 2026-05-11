/**
 * Authenticated request helper for the SonarQube REST API.
 *
 * Uses `Authorization: Bearer <token>` (the modern SonarQube auth scheme).
 * Maps HTTP errors to named error classes so the command layer can render
 * actionable messages rather than dumping raw API responses.
 */

import type { SonarConfig } from './config.ts';

export class SonarRequestError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly body: string,
    ) {
        super(message);
        this.name = 'SonarRequestError';
    }
}

export class SonarAuthError extends SonarRequestError {
    constructor(status: number, body: string) {
        super(
            `SonarQube rejected the token (HTTP ${status}). Check SONAR_TOKEN — it may be invalid, expired, or lack permission.`,
            status,
            body,
        );
        this.name = 'SonarAuthError';
    }
}

export class SonarPRNotAnalyzedError extends SonarRequestError {
    constructor(
        public readonly projectKey: string,
        public readonly pullRequest: string,
        body: string,
    ) {
        super(
            `SonarQube has not analyzed PR ${pullRequest} for project '${projectKey}'. ` +
                'Either the scanner has not run for this PR, or the PR id differs from what was passed to sonar-scanner.',
            404,
            body,
        );
        this.name = 'SonarPRNotAnalyzedError';
    }
}

export class SonarProjectNotFoundError extends SonarRequestError {
    constructor(
        public readonly projectKey: string,
        body: string,
    ) {
        super(
            `SonarQube project '${projectKey}' not found. Check the project key — it must match what was passed as sonar.projectKey at scan time.`,
            404,
            body,
        );
        this.name = 'SonarProjectNotFoundError';
    }
}

export type QueryValue = string | number | boolean | undefined | null;

function buildQuery(params: Record<string, QueryValue>): string {
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== '',
    );
    if (entries.length === 0) return '';
    const usp = new URLSearchParams();
    for (const [k, v] of entries) usp.append(k, String(v));
    return `?${usp.toString()}`;
}

/**
 * Make a GET request to the SonarQube API and return the parsed JSON.
 *
 * `path` is the API path starting with `/api/...` (the base URL is prepended).
 * `query` is a record of query parameters; undefined / null / '' values are dropped.
 *
 * `errorContext` lets the caller hint which error subclass to use for 404s.
 */
export interface RequestErrorContext {
    /** Project key, used to construct SonarPRNotAnalyzedError / SonarProjectNotFoundError. */
    projectKey?: string;
    /** PR identifier, used to construct SonarPRNotAnalyzedError. */
    pullRequest?: string;
    /**
     * When set, a 404 maps to SonarPRNotAnalyzedError instead of SonarProjectNotFoundError.
     * Use for endpoints scoped to a specific PR.
     */
    notFoundMeansPRNotAnalyzed?: boolean;
}

export async function request<T>(
    config: SonarConfig,
    path: string,
    query: Record<string, QueryValue> = {},
    errorContext: RequestErrorContext = {},
): Promise<T> {
    const url = `${config.baseUrl}${path}${buildQuery(query)}`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        if (response.status === 401 || response.status === 403) {
            throw new SonarAuthError(response.status, body);
        }
        if (response.status === 404) {
            if (
                errorContext.notFoundMeansPRNotAnalyzed &&
                errorContext.projectKey &&
                errorContext.pullRequest
            ) {
                throw new SonarPRNotAnalyzedError(
                    errorContext.projectKey,
                    errorContext.pullRequest,
                    body,
                );
            }
            if (errorContext.projectKey) {
                throw new SonarProjectNotFoundError(errorContext.projectKey, body);
            }
        }
        throw new SonarRequestError(
            `SonarQube request failed (HTTP ${response.status}): ${body.slice(0, 300)}`,
            response.status,
            body,
        );
    }

    return response.json() as Promise<T>;
}
