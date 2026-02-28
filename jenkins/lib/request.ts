/**
 * HTTP request helper for Jenkins API.
 * Handles authentication, URL construction, and error handling.
 */

import { getJenkinsConfig, type JenkinsConfig } from './config.ts';

// Lazy config loading - only fetched when first API call is made
let _config: JenkinsConfig | null = null;

function ensureConfig(): JenkinsConfig {
    if (!_config) {
        _config = getJenkinsConfig();
    }
    return _config;
}

export function getAuthHeader(): string {
    const config = ensureConfig();
    const credentials = Buffer.from(`${config.user}:${config.apiToken}`).toString('base64');
    return `Basic ${credentials}`;
}

export function getBaseUrl(): string {
    return ensureConfig().baseUrl;
}

/**
 * Resolve a user-facing job path (e.g., "my-pipeline/feature/auth")
 * to the Jenkins URL path (e.g., "/job/my-pipeline/job/feature/job/auth").
 */
export function resolveJobPath(name: string): string {
    return name
        .split('/')
        .map(segment => `/job/${encodeURIComponent(segment)}`)
        .join('');
}

/**
 * Resolve a build number argument.
 * Returns "lastBuild" when omitted or "latest", otherwise the numeric string.
 */
export function resolveBuildNumber(buildArg?: string): string {
    if (!buildArg || buildArg === 'latest') {
        return 'lastBuild';
    }
    return buildArg;
}

/**
 * Make an authenticated JSON request to the Jenkins API.
 */
export async function request<T>(path: string): Promise<T> {
    const url = `${getBaseUrl()}${path}`;

    const response = await fetch(url, {
        headers: {
            Authorization: getAuthHeader(),
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const text = await response.text();
            if (text) {
                errorMessage = `HTTP ${response.status}: ${text.slice(0, 200)}`;
            }
        } catch {
            // Use default error message
        }
        throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
}

/**
 * Make an authenticated request that returns plain text (e.g., console output).
 */
export async function requestText(path: string): Promise<string> {
    const url = `${getBaseUrl()}${path}`;

    const response = await fetch(url, {
        headers: {
            Authorization: getAuthHeader(),
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
}
