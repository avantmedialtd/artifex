/**
 * Human-readable rendering of SonarQube API responses.
 *
 * Returns formatted strings (pure functions) rather than printing to stdout —
 * keeps formatters testable in isolation and lets the command layer decide
 * whether to print, suppress (--json), or compose.
 */

import chalk from 'chalk';
import type {
    SonarIssue,
    SonarIssueSeverity,
    SonarIssuesResponse,
    SonarMeasure,
    SonarMeasuresResponse,
    SonarPullRequest,
    SonarPullRequestsResponse,
    SonarQualityGateCondition,
    SonarQualityGateResponse,
} from './types.ts';

const SEVERITY_RANK: Record<SonarIssueSeverity, number> = {
    BLOCKER: 0,
    CRITICAL: 1,
    MAJOR: 2,
    MINOR: 3,
    INFO: 4,
};

const METRIC_LABELS: Record<string, string> = {
    new_coverage: 'Coverage on New Code',
    new_duplicated_lines_density: 'Duplicated Lines on New Code',
    new_bugs: 'New Bugs',
    new_vulnerabilities: 'New Vulnerabilities',
    new_code_smells: 'New Code Smells',
    new_maintainability_rating: 'Maintainability Rating',
    new_reliability_rating: 'Reliability Rating',
    new_security_rating: 'Security Rating',
    coverage: 'Coverage',
    duplicated_lines_density: 'Duplicated Lines',
    bugs: 'Bugs',
    vulnerabilities: 'Vulnerabilities',
    code_smells: 'Code Smells',
};

const RATING_LABELS: Record<string, string> = {
    '1.0': 'A',
    '2.0': 'B',
    '3.0': 'C',
    '4.0': 'D',
    '5.0': 'E',
};

function labelFor(metricKey: string): string {
    return METRIC_LABELS[metricKey] ?? metricKey;
}

function formatMetricValue(metricKey: string, value: string | undefined): string {
    if (value === undefined) return '—';
    if (metricKey.endsWith('_rating') || metricKey === 'sqale_rating') {
        return RATING_LABELS[value] ?? value;
    }
    if (
        metricKey.includes('coverage') ||
        metricKey.includes('density') ||
        metricKey.includes('duplicated')
    ) {
        const num = Number(value);
        if (Number.isFinite(num)) return `${num.toFixed(1)}%`;
    }
    return value;
}

function formatComparator(condition: SonarQualityGateCondition): string {
    const comparator = condition.comparator;
    const threshold = condition.errorThreshold;
    if (!threshold) return '';
    const map: Record<string, string> = {
        GT: '>',
        LT: '<',
        GE: '>=',
        LE: '<=',
        EQ: '=',
        NE: '!=',
    };
    const op = map[comparator] ?? comparator;
    const value = formatMetricValue(condition.metricKey, threshold);
    return `${op} ${value}`;
}

export function formatGateSummary(
    gate: SonarQualityGateResponse,
    context: { projectKey: string; pullRequest?: string },
): string {
    const status = gate.projectStatus.status;
    const scope = context.pullRequest
        ? `project: ${context.projectKey}, PR: ${context.pullRequest}`
        : `project: ${context.projectKey}`;

    const lines: string[] = [];
    if (status === 'OK') {
        lines.push(`${chalk.green('✓')} Quality Gate: ${chalk.green('PASSED')}   (${scope})`);
    } else if (status === 'NONE') {
        lines.push(`${chalk.gray('○')} Quality Gate: ${chalk.gray('NONE')}   (${scope})`);
    } else {
        const label = status === 'WARN' ? 'WARN' : 'FAILED';
        lines.push(`${chalk.red('✗')} Quality Gate: ${chalk.red(label)}   (${scope})`);
    }

    const failing = gate.projectStatus.conditions.filter(c => c.status !== 'OK');
    const passing = gate.projectStatus.conditions.filter(c => c.status === 'OK');

    if (failing.length > 0) {
        lines.push('');
        lines.push('  Failed conditions:');
        for (const c of failing) {
            const actual = formatMetricValue(c.metricKey, c.actualValue);
            const cmp = formatComparator(c);
            const tail = cmp ? `  ${cmp}` : '';
            lines.push(
                `    ${chalk.red('✗')} ${labelFor(c.metricKey).padEnd(28)} ${actual.padStart(8)}${tail}`,
            );
        }
    }
    if (passing.length > 0) {
        lines.push('');
        lines.push('  Passing conditions:');
        for (const c of passing) {
            const actual = formatMetricValue(c.metricKey, c.actualValue);
            lines.push(
                `    ${chalk.green('✓')} ${labelFor(c.metricKey).padEnd(28)} ${actual.padStart(8)}`,
            );
        }
    }

    return lines.join('\n');
}

export function sortIssuesBySeverity(issues: SonarIssue[]): SonarIssue[] {
    return [...issues].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

function shortenComponent(component: string): string {
    // Components look like "myorg_artifex:src/foo/bar.ts" — keep the path.
    const colon = component.indexOf(':');
    return colon === -1 ? component : component.slice(colon + 1);
}

function issueTypeLabel(type: SonarIssue['type']): string {
    switch (type) {
        case 'BUG':
            return 'bug';
        case 'VULNERABILITY':
            return 'vulnerability';
        case 'CODE_SMELL':
            return 'code smell';
    }
}

function severityColor(severity: SonarIssueSeverity, text: string): string {
    switch (severity) {
        case 'BLOCKER':
        case 'CRITICAL':
            return chalk.red(text);
        case 'MAJOR':
            return chalk.yellow(text);
        case 'MINOR':
        case 'INFO':
            return chalk.gray(text);
    }
}

export interface IssuesSummary {
    bugs: number;
    vulnerabilities: number;
    codeSmells: number;
    total: number;
}

export function summarizeIssues(issues: SonarIssue[]): IssuesSummary {
    let bugs = 0;
    let vulns = 0;
    let smells = 0;
    for (const i of issues) {
        if (i.type === 'BUG') bugs++;
        else if (i.type === 'VULNERABILITY') vulns++;
        else if (i.type === 'CODE_SMELL') smells++;
    }
    return { bugs, vulnerabilities: vulns, codeSmells: smells, total: issues.length };
}

export function formatIssueLine(issue: SonarIssue): string {
    const type = issueTypeLabel(issue.type).padEnd(13);
    const severity = severityColor(issue.severity, issue.severity.padEnd(8));
    const location = issue.line
        ? `${shortenComponent(issue.component)}:${issue.line}`
        : shortenComponent(issue.component);
    return `    ${type} ${severity} ${location}   ${issue.message}`;
}

export function formatTopIssues(issues: SonarIssue[], limit: number, totalKnown?: number): string {
    const sorted = sortIssuesBySeverity(issues);
    const shown = sorted.slice(0, limit);
    const lines = shown.map(formatIssueLine);
    const total = totalKnown ?? issues.length;
    if (total > limit) {
        const more = total - limit;
        lines.push(`    ${chalk.gray(`... ${more} more (run with --issues for full list)`)}`);
    }
    return lines.join('\n');
}

export function formatIssuesList(issues: SonarIssue[]): string {
    if (issues.length === 0) return '  (no new issues)';
    const sorted = sortIssuesBySeverity(issues);
    return sorted.map(formatIssueLine).join('\n');
}

export function formatIssuesHeading(summary: IssuesSummary): string {
    if (summary.total === 0) return '  New issues: 0';
    const parts: string[] = [];
    if (summary.bugs > 0) parts.push(`${summary.bugs} bug${summary.bugs === 1 ? '' : 's'}`);
    if (summary.vulnerabilities > 0)
        parts.push(
            `${summary.vulnerabilities} vulnerabilit${summary.vulnerabilities === 1 ? 'y' : 'ies'}`,
        );
    if (summary.codeSmells > 0)
        parts.push(`${summary.codeSmells} code smell${summary.codeSmells === 1 ? '' : 's'}`);
    const breakdown = parts.length > 0 ? `  (${parts.join(' · ')})` : '';
    return `  New issues: ${summary.total}${breakdown}`;
}

export function formatMeasures(measures: SonarMeasuresResponse): string {
    const items = measures.component.measures;
    if (items.length === 0) return '';
    const ordered = orderMeasures(items);
    const lines: string[] = [];
    for (const m of ordered) {
        const label = labelFor(m.metric).padEnd(28);
        const value = formatMetricValue(m.metric, m.value).padStart(8);
        lines.push(`    ${label} ${value}`);
    }
    return lines.join('\n');
}

function orderMeasures(items: SonarMeasure[]): SonarMeasure[] {
    const known = Object.keys(METRIC_LABELS);
    return [...items].sort((a, b) => {
        const ai = known.indexOf(a.metric);
        const bi = known.indexOf(b.metric);
        if (ai === -1 && bi === -1) return a.metric.localeCompare(b.metric);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

export function formatPrList(prs: SonarPullRequestsResponse): string {
    if (prs.pullRequests.length === 0) return '  (no pull requests analyzed)';
    const rows = prs.pullRequests.map(pr => formatPrRow(pr));
    const header = `  ${'PR'.padEnd(8)} ${'Gate'.padEnd(8)} ${'Branch'.padEnd(30)} ${'Updated'.padEnd(20)} Title`;
    return [header, ...rows].join('\n');
}

function formatPrRow(pr: SonarPullRequest): string {
    const id = pr.key.padEnd(8);
    const gateRaw = pr.status?.qualityGateStatus ?? 'NONE';
    const gate =
        gateRaw === 'OK'
            ? chalk.green('PASS'.padEnd(8))
            : gateRaw === 'ERROR' || gateRaw === 'WARN'
              ? chalk.red('FAIL'.padEnd(8))
              : chalk.gray(gateRaw.padEnd(8));
    const branch = (pr.branch ?? '').slice(0, 30).padEnd(30);
    const updated = (pr.analysisDate ?? '').slice(0, 19).padEnd(20);
    return `  ${id} ${gate} ${branch} ${updated} ${pr.title}`;
}

/** Pulls headline counts from a SonarIssuesResponse, useful for `--json`. */
export function totalFromIssuesResponse(response: SonarIssuesResponse): number {
    return response.paging?.total ?? response.total ?? response.issues.length;
}
