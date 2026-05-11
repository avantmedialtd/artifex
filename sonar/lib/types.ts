/**
 * SonarQube REST API response types.
 *
 * Only the fields used by the CLI are typed. Fields present in actual responses
 * but unused are intentionally omitted to keep the types minimal.
 *
 * References:
 *   - GET /api/qualitygates/project_status
 *   - GET /api/issues/search
 *   - GET /api/measures/component
 *   - GET /api/project_pull_requests/list
 */

export type SonarGateStatus = 'OK' | 'WARN' | 'ERROR' | 'NONE';

export interface SonarQualityGateCondition {
    status: 'OK' | 'WARN' | 'ERROR' | 'NO_VALUE';
    metricKey: string;
    comparator: string;
    /** Threshold (e.g. error threshold) the condition compares against. */
    errorThreshold?: string;
    /** Actual measured value. May be absent when status is NO_VALUE. */
    actualValue?: string;
}

export interface SonarQualityGateResponse {
    projectStatus: {
        status: SonarGateStatus;
        conditions: SonarQualityGateCondition[];
    };
}

export type SonarIssueType = 'BUG' | 'VULNERABILITY' | 'CODE_SMELL';
export type SonarIssueSeverity = 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';

export interface SonarIssue {
    key: string;
    rule: string;
    severity: SonarIssueSeverity;
    type: SonarIssueType;
    component: string;
    project: string;
    line?: number;
    message: string;
    status: string;
    resolution?: string;
    creationDate: string;
    updateDate?: string;
}

export interface SonarIssuesResponse {
    total: number;
    p: number;
    ps: number;
    paging?: {
        pageIndex: number;
        pageSize: number;
        total: number;
    };
    issues: SonarIssue[];
}

export interface SonarMeasure {
    metric: string;
    value?: string;
    bestValue?: boolean;
}

export interface SonarMeasuresResponse {
    component: {
        key: string;
        name: string;
        measures: SonarMeasure[];
    };
}

export interface SonarPullRequest {
    key: string;
    title: string;
    branch: string;
    base?: string;
    status?: {
        qualityGateStatus: SonarGateStatus;
        bugs?: number;
        vulnerabilities?: number;
        codeSmells?: number;
    };
    analysisDate?: string;
    url?: string;
    target?: string;
}

export interface SonarPullRequestsResponse {
    pullRequests: SonarPullRequest[];
}
