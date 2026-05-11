import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    buildDashboardUrl,
    DEFAULT_PR_METRICS,
    getIssues,
    getMeasures,
    getQualityGate,
    listPullRequests,
} from './client.ts';
import type { SonarConfig } from './config.ts';

const config: SonarConfig = {
    baseUrl: 'https://sonar.example.com',
    projectKey: 'myorg_artifex',
    token: 'tok',
    propertiesPath: null,
};

function captureFetchUrl(): { spy: ReturnType<typeof vi.fn>; getUrl: () => string } {
    const spy = vi.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
            text: () => Promise.resolve('{}'),
        } as unknown as Response),
    );
    globalThis.fetch = spy;
    return { spy, getUrl: () => spy.mock.calls[0][0] as string };
}

describe('sonar client', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe('getQualityGate', () => {
        it('queries qualitygates/project_status with projectKey', async () => {
            const { getUrl } = captureFetchUrl();
            await getQualityGate(config);
            const url = getUrl();
            expect(url).toContain('/api/qualitygates/project_status');
            expect(url).toContain('projectKey=myorg_artifex');
            expect(url).not.toContain('pullRequest=');
        });

        it('includes pullRequest when provided', async () => {
            const { getUrl } = captureFetchUrl();
            await getQualityGate(config, { pullRequest: '42' });
            expect(getUrl()).toContain('pullRequest=42');
        });
    });

    describe('getIssues', () => {
        it('queries issues/search with componentKeys and resolved=false by default', async () => {
            const { getUrl } = captureFetchUrl();
            await getIssues(config, { pullRequest: '42' });
            const url = getUrl();
            expect(url).toContain('/api/issues/search');
            expect(url).toContain('componentKeys=myorg_artifex');
            expect(url).toContain('pullRequest=42');
            expect(url).toContain('resolved=false');
        });

        it('forwards page and pageSize', async () => {
            const { getUrl } = captureFetchUrl();
            await getIssues(config, { pullRequest: '42', page: 2, pageSize: 50 });
            const url = getUrl();
            expect(url).toContain('p=2');
            expect(url).toContain('ps=50');
        });
    });

    describe('getMeasures', () => {
        it('queries measures/component with metric keys joined by comma', async () => {
            const { getUrl } = captureFetchUrl();
            await getMeasures(config, {
                pullRequest: '42',
                metricKeys: DEFAULT_PR_METRICS,
            });
            const url = getUrl();
            expect(url).toContain('/api/measures/component');
            expect(url).toContain('component=myorg_artifex');
            expect(url).toContain('pullRequest=42');
            expect(decodeURIComponent(url)).toContain(DEFAULT_PR_METRICS.join(','));
        });
    });

    describe('listPullRequests', () => {
        it('queries project_pull_requests/list with project param', async () => {
            const { getUrl } = captureFetchUrl();
            await listPullRequests(config);
            const url = getUrl();
            expect(url).toContain('/api/project_pull_requests/list');
            expect(url).toContain('project=myorg_artifex');
        });
    });
});

describe('buildDashboardUrl', () => {
    it('builds a project dashboard URL', () => {
        expect(buildDashboardUrl('https://sonar.example.com', 'K')).toBe(
            'https://sonar.example.com/dashboard?id=K',
        );
    });

    it('appends pullRequest param when provided', () => {
        expect(buildDashboardUrl('https://sonar.example.com', 'K', '42')).toBe(
            'https://sonar.example.com/dashboard?id=K&pullRequest=42',
        );
    });
});
