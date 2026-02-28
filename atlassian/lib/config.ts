/**
 * Shared Atlassian configuration module.
 *
 * Reads credentials from environment variables with ATLASSIAN_* preferred
 * and JIRA_* as legacy fallback. Used by both Jira and Confluence clients.
 */

export interface AtlassianConfig {
    baseUrl: string;
    email: string;
    apiToken: string;
}

/**
 * Get an environment variable with fallback to legacy name.
 * Throws a descriptive error if neither is set.
 */
function getEnvVar(name: string, legacyName: string): string {
    const value = process.env[name] || process.env[legacyName];
    if (!value) {
        throw new Error(
            `${name} is not set. ` +
                'Create a .env file in your project directory with:\n' +
                '  ATLASSIAN_BASE_URL=https://your-domain.atlassian.net\n' +
                '  ATLASSIAN_EMAIL=your-email@example.com\n' +
                '  ATLASSIAN_API_TOKEN=your-api-token\n\n' +
                'Legacy variables are also supported:\n' +
                '  JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN',
        );
    }
    return value;
}

/**
 * Get Atlassian configuration from environment variables.
 * Prefers ATLASSIAN_* variables, falls back to JIRA_* for backward compatibility.
 */
export function getAtlassianConfig(): AtlassianConfig {
    return {
        baseUrl: getEnvVar('ATLASSIAN_BASE_URL', 'JIRA_BASE_URL').replace(/\/$/, ''),
        email: getEnvVar('ATLASSIAN_EMAIL', 'JIRA_EMAIL'),
        apiToken: getEnvVar('ATLASSIAN_API_TOKEN', 'JIRA_API_TOKEN'),
    };
}
