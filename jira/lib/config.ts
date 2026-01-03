/**
 * Jira configuration module.
 *
 * Uses environment variables loaded by the global utils/env.ts loader.
 * Validation is lazy - errors are only thrown when getConfig() is called.
 */

export interface Config {
    baseUrl: string;
    email: string;
    apiToken: string;
}

/**
 * Get an environment variable, throwing a descriptive error if not set.
 */
function getEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(
            `${name} is not set. ` +
                'Create a .env file in your project directory with:\n' +
                '  JIRA_BASE_URL=https://your-domain.atlassian.net\n' +
                '  JIRA_EMAIL=your-email@example.com\n' +
                '  JIRA_API_TOKEN=your-api-token',
        );
    }
    return value;
}

/**
 * Get Jira configuration from environment variables.
 * Throws descriptive error if any required variable is missing.
 */
export function getConfig(): Config {
    return {
        baseUrl: getEnvVar('JIRA_BASE_URL').replace(/\/$/, ''),
        email: getEnvVar('JIRA_EMAIL'),
        apiToken: getEnvVar('JIRA_API_TOKEN'),
    };
}
