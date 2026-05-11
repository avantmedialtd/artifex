import { describe, it, expect } from 'vitest';
import {
    formatGateSummary,
    formatIssuesHeading,
    formatIssuesList,
    formatMeasures,
    formatPrList,
    formatTopIssues,
    sortIssuesBySeverity,
    summarizeIssues,
} from './formatters.ts';
import type {
    SonarIssue,
    SonarMeasuresResponse,
    SonarPullRequestsResponse,
    SonarQualityGateResponse,
} from './types.ts';

function issue(
    over: Partial<SonarIssue> & { severity: SonarIssue['severity']; type: SonarIssue['type'] },
): SonarIssue {
    return {
        key: 'k',
        rule: 'r',
        component: 'p:src/x.ts',
        project: 'p',
        line: 1,
        message: 'msg',
        status: 'OPEN',
        creationDate: '',
        ...over,
    };
}

describe('formatGateSummary', () => {
    it('renders PASSED for an OK gate', () => {
        const gate: SonarQualityGateResponse = {
            projectStatus: { status: 'OK', conditions: [] },
        };
        const out = formatGateSummary(gate, { projectKey: 'K', pullRequest: '42' });
        expect(out).toContain('PASSED');
        expect(out).toContain('project: K');
        expect(out).toContain('PR: 42');
    });

    it('renders FAILED for an ERROR gate and lists failing conditions', () => {
        const gate: SonarQualityGateResponse = {
            projectStatus: {
                status: 'ERROR',
                conditions: [
                    {
                        status: 'ERROR',
                        metricKey: 'new_coverage',
                        comparator: 'LT',
                        errorThreshold: '80',
                        actualValue: '52.3',
                    },
                    {
                        status: 'OK',
                        metricKey: 'new_reliability_rating',
                        comparator: 'GT',
                        errorThreshold: '1',
                        actualValue: '1.0',
                    },
                ],
            },
        };
        const out = formatGateSummary(gate, { projectKey: 'K' });
        expect(out).toContain('FAILED');
        expect(out).toContain('Coverage on New Code');
        expect(out).toContain('52.3%');
        expect(out).toContain('< 80.0%');
        expect(out).toContain('Reliability Rating');
        expect(out).toContain('A');
    });

    it('omits PR scope when no pullRequest provided', () => {
        const gate: SonarQualityGateResponse = {
            projectStatus: { status: 'OK', conditions: [] },
        };
        const out = formatGateSummary(gate, { projectKey: 'K' });
        expect(out).not.toContain('PR:');
    });
});

describe('sortIssuesBySeverity', () => {
    it('orders BLOCKER → CRITICAL → MAJOR → MINOR → INFO', () => {
        const sorted = sortIssuesBySeverity([
            issue({ severity: 'MINOR', type: 'CODE_SMELL' }),
            issue({ severity: 'BLOCKER', type: 'BUG' }),
            issue({ severity: 'MAJOR', type: 'BUG' }),
        ]);
        expect(sorted.map(i => i.severity)).toEqual(['BLOCKER', 'MAJOR', 'MINOR']);
    });
});

describe('summarizeIssues', () => {
    it('counts by type', () => {
        const s = summarizeIssues([
            issue({ severity: 'BLOCKER', type: 'BUG' }),
            issue({ severity: 'CRITICAL', type: 'BUG' }),
            issue({ severity: 'CRITICAL', type: 'VULNERABILITY' }),
            issue({ severity: 'MINOR', type: 'CODE_SMELL' }),
            issue({ severity: 'MINOR', type: 'CODE_SMELL' }),
            issue({ severity: 'MINOR', type: 'CODE_SMELL' }),
        ]);
        expect(s).toEqual({ bugs: 2, vulnerabilities: 1, codeSmells: 3, total: 6 });
    });
});

describe('formatTopIssues', () => {
    it('truncates to limit and shows "N more"', () => {
        const issues = [
            issue({ severity: 'BLOCKER', type: 'BUG', message: 'msg-a' }),
            issue({ severity: 'MAJOR', type: 'BUG', message: 'msg-b' }),
            issue({ severity: 'MINOR', type: 'CODE_SMELL', message: 'msg-c' }),
            issue({ severity: 'INFO', type: 'CODE_SMELL', message: 'msg-d' }),
            issue({ severity: 'INFO', type: 'CODE_SMELL', message: 'msg-e' }),
            issue({ severity: 'INFO', type: 'CODE_SMELL', message: 'msg-f' }),
        ];
        const out = formatTopIssues(issues, 4);
        expect(out).toContain('msg-a');
        expect(out).toContain('msg-b');
        expect(out).toContain('msg-c');
        expect(out).toContain('msg-d');
        expect(out).not.toContain('msg-e');
        expect(out).not.toContain('msg-f');
        expect(out).toContain('2 more');
    });

    it('does not show "N more" when total ≤ limit', () => {
        const issues = [
            issue({ severity: 'BLOCKER', type: 'BUG', message: 'msg-a' }),
            issue({ severity: 'MAJOR', type: 'BUG', message: 'msg-b' }),
        ];
        const out = formatTopIssues(issues, 4);
        expect(out).not.toContain(' more');
    });
});

describe('formatIssuesList', () => {
    it('renders all issues sorted by severity', () => {
        const issues = [
            issue({ severity: 'MAJOR', type: 'BUG', message: 'b-major' }),
            issue({ severity: 'BLOCKER', type: 'BUG', message: 'b-blocker' }),
        ];
        const out = formatIssuesList(issues);
        const blockerIdx = out.indexOf('b-blocker');
        const majorIdx = out.indexOf('b-major');
        expect(blockerIdx).toBeGreaterThanOrEqual(0);
        expect(majorIdx).toBeGreaterThan(blockerIdx);
    });

    it('renders a "no issues" placeholder for empty input', () => {
        const out = formatIssuesList([]);
        expect(out).toContain('no new issues');
    });
});

describe('formatIssuesHeading', () => {
    it('renders zero issues plainly', () => {
        const out = formatIssuesHeading({ bugs: 0, vulnerabilities: 0, codeSmells: 0, total: 0 });
        expect(out).toContain('0');
    });

    it('breaks down counts by type', () => {
        const out = formatIssuesHeading({ bugs: 2, vulnerabilities: 1, codeSmells: 4, total: 7 });
        expect(out).toContain('7');
        expect(out).toContain('2 bugs');
        expect(out).toContain('1 vulnerability');
        expect(out).toContain('4 code smells');
    });
});

describe('formatMeasures', () => {
    it('renders known metrics with formatted values', () => {
        const measures: SonarMeasuresResponse = {
            component: {
                key: 'K',
                name: 'K',
                measures: [
                    { metric: 'new_coverage', value: '52.3' },
                    { metric: 'new_duplicated_lines_density', value: '4.1' },
                ],
            },
        };
        const out = formatMeasures(measures);
        expect(out).toContain('Coverage on New Code');
        expect(out).toContain('52.3%');
        expect(out).toContain('4.1%');
    });

    it('returns empty string when no measures', () => {
        const measures: SonarMeasuresResponse = {
            component: { key: 'K', name: 'K', measures: [] },
        };
        expect(formatMeasures(measures)).toBe('');
    });
});

describe('formatPrList', () => {
    it('renders rows for each PR', () => {
        const prs: SonarPullRequestsResponse = {
            pullRequests: [
                {
                    key: '42',
                    title: 'Add feature x',
                    branch: 'feature/x',
                    status: { qualityGateStatus: 'OK' },
                    analysisDate: '2026-05-11T10:00:00+0000',
                },
                {
                    key: '43',
                    title: 'Fix bug y',
                    branch: 'fix/y',
                    status: { qualityGateStatus: 'ERROR' },
                    analysisDate: '2026-05-10T08:00:00+0000',
                },
            ],
        };
        const out = formatPrList(prs);
        expect(out).toContain('42');
        expect(out).toContain('43');
        expect(out).toContain('Add feature x');
        expect(out).toContain('PASS');
        expect(out).toContain('FAIL');
    });

    it('renders a placeholder when there are no PRs', () => {
        const out = formatPrList({ pullRequests: [] });
        expect(out).toContain('no pull requests analyzed');
    });
});
