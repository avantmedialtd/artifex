/**
 * Jenkins configuration module.
 *
 * Reads credentials from JENKINS_* environment variables.
 */

export interface JenkinsConfig {
    baseUrl: string;
    user: string;
    apiToken: string;
}

function getRequiredEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(
            `${name} is not set. ` +
                'Create a .env file in your project directory with:\n' +
                '  JENKINS_BASE_URL=https://jenkins.example.com\n' +
                '  JENKINS_USER=your-username\n' +
                '  JENKINS_API_TOKEN=your-api-token',
        );
    }
    return value;
}

export function getJenkinsConfig(): JenkinsConfig {
    return {
        baseUrl: getRequiredEnvVar('JENKINS_BASE_URL').replace(/\/$/, ''),
        user: getRequiredEnvVar('JENKINS_USER'),
        apiToken: getRequiredEnvVar('JENKINS_API_TOKEN'),
    };
}
