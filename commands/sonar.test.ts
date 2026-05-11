import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
    SonarIssuesResponse,
    SonarMeasuresResponse,
    SonarPullRequestsResponse,
    SonarQualityGateResponse,
} from '../sonar/lib/types.ts';
import type { SonarConfig } from '../sonar/lib/config.ts';

const stubConfig: SonarConfig = {
    baseUrl: 'https://sonar.example.com',
    projectKey: 'myorg_artifex',
    token: 'tok',
    propertiesPath: null,
};

const okGate: SonarQualityGateResponse = {
    projectStatus: { status: 'OK', conditions: [] },
};

const errorGate: SonarQualityGateResponse = {
    projectStatus: {
        status: 'ERROR',
        conditions: [
            {
                status: 'ERROR',
                metricKey: 'new_coverage',
                comparator: 'LT',
                errorThreshold: '80',
                actualValue: '50',
            },
        ],
    },
};

const emptyIssues: SonarIssuesResponse = { total: 0, p: 1, ps: 100, issues: [] };
const emptyMeasures: SonarMeasuresResponse = {
    component: { key: 'K', name: 'K', measures: [] },
};

vi.mock('../sonar/lib/config.ts', async () => {
    const actual =
        await vi.importActual<typeof import('../sonar/lib/config.ts')>('../sonar/lib/config.ts');
    return {
        ...actual,
        getSonarConfig: vi.fn(() => stubConfig),
    };
});

vi.mock('../sonar/lib/client.ts', () => ({
    getQualityGate: vi.fn(),
    getIssues: vi.fn(),
    getMeasures: vi.fn(),
    listPullRequests: vi.fn(),
    buildDashboardUrl: (base: string, key: string, pr?: string) =>
        pr ? `${base}/dashboard?id=${key}&pullRequest=${pr}` : `${base}/dashboard?id=${key}`,
    DEFAULT_PR_METRICS: ['new_coverage'],
}));

vi.mock('../sonar/lib/pr-detect.ts', () => ({
    detectPullRequestForCurrentBranch: vi.fn(),
    explainDetectFailure: (r: { kind: string }) => `explained:${r.kind}`,
}));

import { handleSonar } from './sonar.ts';
import * as client from '../sonar/lib/client.ts';
import * as prDetect from '../sonar/lib/pr-detect.ts';
import * as config from '../sonar/lib/config.ts';

const mockedClient = vi.mocked(client);
const mockedDetect = vi.mocked(prDetect);
const mockedConfig = vi.mocked(config);

describe('handleSonar', () => {
    let logs: string[];
    let errors: string[];
    let originalLog: typeof console.log;
    let originalError: typeof console.error;

    beforeEach(() => {
        logs = [];
        errors = [];
        originalLog = console.log;
        originalError = console.error;
        console.log = (...a: unknown[]) => {
            logs.push(a.map(String).join(' '));
        };
        console.error = (...a: unknown[]) => {
            errors.push(a.map(String).join(' '));
        };
        mockedConfig.getSonarConfig.mockReturnValue(stubConfig);
        mockedClient.getQualityGate.mockReset();
        mockedClient.getIssues.mockReset();
        mockedClient.getMeasures.mockReset();
        mockedClient.listPullRequests.mockReset();
        mockedDetect.detectPullRequestForCurrentBranch.mockReset();
    });

    afterEach(() => {
        console.log = originalLog;
        console.error = originalError;
    });

    it('shows help with no args', async () => {
        const exit = await handleSonar([]);
        expect(exit).toBe(0);
        expect(logs.join('\n')).toContain('USAGE');
    });

    it('shows help with --help', async () => {
        const exit = await handleSonar(['--help']);
        expect(exit).toBe(0);
        expect(logs.join('\n')).toContain('USAGE');
    });

    it('errors on unknown subcommand', async () => {
        const exit = await handleSonar(['nope']);
        expect(exit).toBe(1);
        expect(errors.join('\n')).toContain('Unknown sonar subcommand');
    });

    it('errors on unknown option', async () => {
        const exit = await handleSonar(['pr', '42', '--bogus']);
        expect(exit).toBe(1);
        expect(errors.join('\n')).toContain('Unknown option');
    });

    it('pr with explicit id calls gate/issues/measures with that PR', async () => {
        mockedClient.getQualityGate.mockResolvedValue(okGate);
        mockedClient.getIssues.mockResolvedValue(emptyIssues);
        mockedClient.getMeasures.mockResolvedValue(emptyMeasures);

        const exit = await handleSonar(['pr', '42']);
        expect(exit).toBe(0);
        expect(mockedClient.getQualityGate).toHaveBeenCalledWith(stubConfig, {
            pullRequest: '42',
        });
        expect(mockedClient.getIssues).toHaveBeenCalledWith(
            stubConfig,
            expect.objectContaining({ pullRequest: '42' }),
        );
        expect(mockedClient.getMeasures).toHaveBeenCalledWith(
            stubConfig,
            expect.objectContaining({ pullRequest: '42' }),
        );
        expect(mockedDetect.detectPullRequestForCurrentBranch).not.toHaveBeenCalled();
    });

    it('pr without id auto-detects via Bitbucket', async () => {
        mockedDetect.detectPullRequestForCurrentBranch.mockResolvedValue({
            kind: 'single',
            id: 99,
            title: 't',
            branch: 'b',
        });
        mockedClient.getQualityGate.mockResolvedValue(okGate);
        mockedClient.getIssues.mockResolvedValue(emptyIssues);
        mockedClient.getMeasures.mockResolvedValue(emptyMeasures);

        const exit = await handleSonar(['pr']);
        expect(exit).toBe(0);
        expect(mockedClient.getQualityGate).toHaveBeenCalledWith(stubConfig, {
            pullRequest: '99',
        });
    });

    it('pr without id and auto-detect failure exits non-zero with explanation', async () => {
        mockedDetect.detectPullRequestForCurrentBranch.mockResolvedValue({
            kind: 'none',
            branch: 'b',
        });

        const exit = await handleSonar(['pr']);
        expect(exit).toBe(1);
        expect(errors.join('\n')).toContain('explained:none');
        expect(mockedClient.getQualityGate).not.toHaveBeenCalled();
    });

    it('pr returns non-zero exit when gate is ERROR', async () => {
        mockedClient.getQualityGate.mockResolvedValue(errorGate);
        mockedClient.getIssues.mockResolvedValue(emptyIssues);
        mockedClient.getMeasures.mockResolvedValue(emptyMeasures);

        const exit = await handleSonar(['pr', '42']);
        expect(exit).toBe(1);
    });

    it('pr --json emits a JSON payload aggregating responses', async () => {
        mockedClient.getQualityGate.mockResolvedValue(okGate);
        mockedClient.getIssues.mockResolvedValue(emptyIssues);
        mockedClient.getMeasures.mockResolvedValue(emptyMeasures);

        await handleSonar(['pr', '42', '--json']);

        // First (and only) stdout line should be valid JSON
        const stdout = logs.join('\n');
        const parsed = JSON.parse(stdout);
        expect(parsed.pullRequest).toBe('42');
        expect(parsed.project).toBe('myorg_artifex');
        expect(parsed.gate).toEqual(okGate);
        expect(parsed.issues).toEqual(emptyIssues);
        expect(parsed.measures).toEqual(emptyMeasures);
    });

    it('gate calls getQualityGate without pullRequest', async () => {
        mockedClient.getQualityGate.mockResolvedValue(okGate);
        const exit = await handleSonar(['gate']);
        expect(exit).toBe(0);
        expect(mockedClient.getQualityGate).toHaveBeenCalledWith(stubConfig);
    });

    it('gate returns non-zero when ERROR', async () => {
        mockedClient.getQualityGate.mockResolvedValue(errorGate);
        const exit = await handleSonar(['gate']);
        expect(exit).toBe(1);
    });

    it('gate --json emits raw response', async () => {
        mockedClient.getQualityGate.mockResolvedValue(okGate);
        await handleSonar(['gate', '--json']);
        const parsed = JSON.parse(logs.join('\n'));
        expect(parsed).toEqual(okGate);
    });

    it('prs calls listPullRequests and renders a table', async () => {
        const prs: SonarPullRequestsResponse = {
            pullRequests: [
                {
                    key: '1',
                    title: 'X',
                    branch: 'b',
                    status: { qualityGateStatus: 'OK' },
                    analysisDate: '2026-05-11T10:00:00+0000',
                },
            ],
        };
        mockedClient.listPullRequests.mockResolvedValue(prs);
        const exit = await handleSonar(['prs']);
        expect(exit).toBe(0);
        expect(logs.join('\n')).toContain('X');
    });

    it('prs --json emits raw response', async () => {
        const prs: SonarPullRequestsResponse = { pullRequests: [] };
        mockedClient.listPullRequests.mockResolvedValue(prs);
        await handleSonar(['prs', '--json']);
        const parsed = JSON.parse(logs.join('\n'));
        expect(parsed).toEqual(prs);
    });

    it('--project flag overrides project key', async () => {
        mockedClient.getQualityGate.mockResolvedValue(okGate);
        await handleSonar(['gate', '--project', 'override_key']);
        expect(mockedConfig.getSonarConfig).toHaveBeenCalledWith({ projectFlag: 'override_key' });
    });

    it('config errors are reported and exit 1', async () => {
        mockedConfig.getSonarConfig.mockImplementation(() => {
            throw new (require('../sonar/lib/config.ts').SonarConfigError)(
                'SONAR_TOKEN is not set',
            );
        });
        const exit = await handleSonar(['gate']);
        expect(exit).toBe(1);
        expect(errors.join('\n')).toContain('SONAR_TOKEN');
    });
});
