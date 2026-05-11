/**
 * SonarQube API client.
 *
 * Thin wrappers around `request()` for the four endpoints the CLI needs.
 * All operations are read-only.
 */

import type { SonarConfig } from './config.ts';
import { request } from './request.ts';
import type {
    SonarIssuesResponse,
    SonarMeasuresResponse,
    SonarPullRequestsResponse,
    SonarQualityGateResponse,
} from './types.ts';

export interface GateOptions {
    /** PR id to scope the gate query to. Omit for main-branch gate. */
    pullRequest?: string;
}

export async function getQualityGate(
    config: SonarConfig,
    opts: GateOptions = {},
): Promise<SonarQualityGateResponse> {
    return request<SonarQualityGateResponse>(
        config,
        '/api/qualitygates/project_status',
        {
            projectKey: config.projectKey,
            pullRequest: opts.pullRequest,
        },
        {
            projectKey: config.projectKey,
            pullRequest: opts.pullRequest,
            notFoundMeansPRNotAnalyzed: Boolean(opts.pullRequest),
        },
    );
}

export interface IssuesOptions {
    pullRequest?: string;
    page?: number;
    pageSize?: number;
    /** Filter to issues in unresolved status. Defaults to true (open issues only). */
    onlyOpen?: boolean;
}

export async function getIssues(
    config: SonarConfig,
    opts: IssuesOptions = {},
): Promise<SonarIssuesResponse> {
    return request<SonarIssuesResponse>(
        config,
        '/api/issues/search',
        {
            componentKeys: config.projectKey,
            pullRequest: opts.pullRequest,
            p: opts.page,
            ps: opts.pageSize,
            resolved: opts.onlyOpen === false ? undefined : 'false',
        },
        { projectKey: config.projectKey, pullRequest: opts.pullRequest },
    );
}

export interface MeasuresOptions {
    pullRequest?: string;
    metricKeys: string[];
}

/** Default metrics shown in the `af sonar pr` combined view. */
export const DEFAULT_PR_METRICS = [
    'new_coverage',
    'new_duplicated_lines_density',
    'new_bugs',
    'new_vulnerabilities',
    'new_code_smells',
];

export async function getMeasures(
    config: SonarConfig,
    opts: MeasuresOptions,
): Promise<SonarMeasuresResponse> {
    return request<SonarMeasuresResponse>(
        config,
        '/api/measures/component',
        {
            component: config.projectKey,
            pullRequest: opts.pullRequest,
            metricKeys: opts.metricKeys.join(','),
        },
        {
            projectKey: config.projectKey,
            pullRequest: opts.pullRequest,
            notFoundMeansPRNotAnalyzed: Boolean(opts.pullRequest),
        },
    );
}

export async function listPullRequests(config: SonarConfig): Promise<SonarPullRequestsResponse> {
    return request<SonarPullRequestsResponse>(
        config,
        '/api/project_pull_requests/list',
        { project: config.projectKey },
        { projectKey: config.projectKey },
    );
}

/**
 * Build a deep link to the SonarQube web UI for a project or PR.
 */
export function buildDashboardUrl(
    baseUrl: string,
    projectKey: string,
    pullRequest?: string,
): string {
    const usp = new URLSearchParams({ id: projectKey });
    if (pullRequest) usp.set('pullRequest', pullRequest);
    return `${baseUrl}/dashboard?${usp.toString()}`;
}
