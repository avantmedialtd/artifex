/**
 * SonarQube configuration resolution.
 *
 * Three pieces of config, three different resolution rules:
 *   - token:      SONAR_TOKEN env (no fallback — secrets do not belong in properties files)
 *   - baseUrl:    SONAR_BASE_URL env → sonar.host.url in sonar-project.properties
 *   - projectKey: --project flag    → sonar.projectKey in sonar-project.properties
 *
 * The properties file is located by walking up from `cwd` (defaults to process.cwd()).
 */

import { loadProperties, propertiesSearchPath } from './properties.ts';

export interface SonarConfig {
    baseUrl: string;
    projectKey: string;
    token: string;
    /** Path to the properties file used during resolution, or null when none. */
    propertiesPath: string | null;
}

export interface ResolveSonarConfigOptions {
    /** Explicit project key from a `--project` flag. */
    projectFlag?: string;
    /** Working directory to search from. Defaults to `process.cwd()`. */
    cwd?: string;
    /** Override `process.env` (for tests). */
    env?: NodeJS.ProcessEnv;
}

export class SonarConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SonarConfigError';
    }
}

function stripTrailingSlash(url: string): string {
    return url.replace(/\/+$/, '');
}

export function getSonarConfig(options: ResolveSonarConfigOptions = {}): SonarConfig {
    const env = options.env ?? process.env;
    const cwd = options.cwd ?? process.cwd();

    const token = env.SONAR_TOKEN;
    if (!token) {
        throw new SonarConfigError(
            'SONAR_TOKEN is not set. ' +
                'Create a user token in your SonarQube account and export:\n' +
                '  SONAR_TOKEN=<token>',
        );
    }

    const props = loadProperties(cwd);

    const envBaseUrl = env.SONAR_BASE_URL?.trim();
    const propsBaseUrl = props?.values['sonar.host.url']?.trim();
    const rawBaseUrl = envBaseUrl || propsBaseUrl;
    if (!rawBaseUrl) {
        const searched = propertiesSearchPath(cwd).join('\n  ');
        throw new SonarConfigError(
            'SonarQube base URL could not be resolved.\n' +
                'Set SONAR_BASE_URL or add `sonar.host.url=...` to sonar-project.properties.\n' +
                'Searched for sonar-project.properties in:\n  ' +
                searched,
        );
    }
    const baseUrl = stripTrailingSlash(rawBaseUrl);

    const flagKey = options.projectFlag?.trim();
    const propsKey = props?.values['sonar.projectKey']?.trim();
    const projectKey = flagKey || propsKey;
    if (!projectKey) {
        const searched = propertiesSearchPath(cwd).join('\n  ');
        throw new SonarConfigError(
            'SonarQube project key could not be resolved.\n' +
                'Pass --project <key> or add `sonar.projectKey=...` to sonar-project.properties.\n' +
                'Searched for sonar-project.properties in:\n  ' +
                searched,
        );
    }

    return {
        baseUrl,
        projectKey,
        token,
        propertiesPath: props?.path ?? null,
    };
}
