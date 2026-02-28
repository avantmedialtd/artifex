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
}

/**
 * Make an authenticated request to an Atlassian API.
 * Accepts a full URL (caller is responsible for constructing the URL with the correct API path).
 */
export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
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
            const errorData = (await response.json()) as AtlassianApiError;
            if (errorData.errorMessages?.length) {
                errorMessage = errorData.errorMessages.join('\n');
            } else if (errorData.message) {
                errorMessage = errorData.message;
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
