/**
 * Shared HTTP request helper for Atlassian APIs.
 * Handles authentication, error parsing, and common response patterns.
 */

import { getAtlassianConfig, type AtlassianConfig } from './config.ts';

// Lazy config loading - only fetched when first API call is made
let _config: AtlassianConfig | null = null;

function ensureConfig(): AtlassianConfig {
    if (!_config) {
        _config = getAtlassianConfig();
    }
    return _config;
}

export function getAuthHeader(): string {
    const config = ensureConfig();
    const credentials = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    return `Basic ${credentials}`;
}

export function getBaseUrl(): string {
    return ensureConfig().baseUrl;
}

export interface AtlassianApiError {
    errorMessages?: string[];
    errors?: Record<string, string>;
    message?: string;
    // Bitbucket Cloud error envelope: { type: "error", error: { message, fields? } }
    error?: { message?: string; detail?: string; fields?: Record<string, string[]> };
}

/**
 * Make an authenticated request to an Atlassian API.
 * Accepts a full URL (caller is responsible for constructing the URL with the correct API path).
 *
 * If `options.headers.Authorization` is set, the default Atlassian auth header is skipped —
 * this lets product-specific wrappers (e.g. Bitbucket) supply their own credentials without
 * needing the Atlassian env vars to be present.
 */
export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const userHeaders = (options.headers ?? {}) as Record<string, string>;
    const hasAuth = 'Authorization' in userHeaders;
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(hasAuth ? {} : { Authorization: getAuthHeader() }),
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...userHeaders,
        },
    });

    if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return {} as T;
    }

    return response.json() as Promise<T>;
}

/**
 * Build a human-readable error message from an Atlassian (Jira/Confluence/Bitbucket)
 * error response. Handles all three known envelope shapes.
 */
async function parseErrorMessage(response: Response): Promise<string> {
    const fallback = `HTTP ${response.status}: ${response.statusText}`;
    try {
        const errorData = (await response.json()) as AtlassianApiError;
        if (errorData.errorMessages?.length) {
            return errorData.errorMessages.join('\n');
        }
        if (errorData.error?.message) {
            // Bitbucket Cloud envelope
            return errorData.error.message;
        }
        if (errorData.message) {
            return errorData.message;
        }
        if (errorData.errors) {
            return Object.entries(errorData.errors)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n');
        }
    } catch {
        // fall through to default
    }
    return fallback;
}

/**
 * Make an authenticated request to an Atlassian API and return the body as text.
 * For endpoints that return non-JSON content (e.g. Bitbucket pipeline logs, PR diffs).
 */
export async function requestText(url: string, options: RequestInit = {}): Promise<string> {
    const userHeaders = (options.headers ?? {}) as Record<string, string>;
    const hasAuth = 'Authorization' in userHeaders;
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(hasAuth ? {} : { Authorization: getAuthHeader() }),
            Accept: 'text/plain, */*',
            ...userHeaders,
        },
    });

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const text = await response.text();
            if (text) {
                try {
                    const errorData = JSON.parse(text) as AtlassianApiError;
                    if (errorData.errorMessages?.length) {
                        errorMessage = errorData.errorMessages.join('\n');
                    } else if (errorData.error?.message) {
                        errorMessage = errorData.error.message;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData.errors) {
                        errorMessage = Object.entries(errorData.errors)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join('\n');
                    } else {
                        errorMessage = text;
                    }
                } catch {
                    errorMessage = text;
                }
            }
        } catch {
            // Use default error message
        }
        throw new Error(errorMessage);
    }

    if (response.status === 204) {
        return '';
    }

    return response.text();
}

/**
 * Walk an Atlassian Cloud cursor-paginated endpoint, yielding each value.
 *
 * Atlassian Cloud APIs (notably Bitbucket Cloud) return `{values, next}` where
 * `next` is a fully-qualified URL to the next page, or absent when complete.
 * Authentication and error handling are inherited from `request<T>()`.
 */
export async function* paginate<T>(url: string): AsyncIterable<T> {
    let nextUrl: string | undefined = url;
    while (nextUrl) {
        const page: { values?: T[]; next?: string } = await request<{
            values?: T[];
            next?: string;
        }>(nextUrl);
        if (page.values) {
            for (const value of page.values) {
                yield value;
            }
        }
        nextUrl = page.next;
    }
}
