// cspell:words notbuilt Millis
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    formatJobs,
    formatJob,
    formatBranches,
    formatBuild,
    formatStages,
    formatQueue,
} from './formatters.ts';
import type {
    JenkinsJobRef,
    JenkinsJob,
    JenkinsBuild,
    JenkinsPipelineRun,
    JenkinsQueue,
} from './types.ts';

const originalEnv = process.env;

beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.JENKINS_BASE_URL;
});

afterEach(() => {
    process.env = originalEnv;
});

describe('formatJobs', () => {
    it('should format a list of jobs as a markdown table', () => {
        const jobs: JenkinsJobRef[] = [
            {
                _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
                name: 'my-app',
                url: 'https://jenkins.example.com/job/my-app/',
                color: 'blue',
                lastBuild: {
                    _class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
                    number: 42,
                    url: 'https://jenkins.example.com/job/my-app/42/',
                    result: 'SUCCESS',
                    timestamp: 1700000000000,
                    duration: 120000,
                    building: false,
                },
            },
        ];

        const result = formatJobs(jobs);

        expect(result).toContain('| Name | Status | Last Build |');
        expect(result).toContain('my-app');
        expect(result).toContain('blue');
        expect(result).toContain('#42 SUCCESS');
    });

    it('should show building status', () => {
        const jobs: JenkinsJobRef[] = [
            {
                _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
                name: 'building-job',
                url: 'https://jenkins.example.com/job/building-job/',
                color: 'blue_anime',
                lastBuild: {
                    _class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
                    number: 5,
                    url: '',
                    result: null,
                    timestamp: 1700000000000,
                    duration: 0,
                    building: true,
                },
            },
        ];

        const result = formatJobs(jobs);

        expect(result).toContain('blue (building)');
        expect(result).toContain('#5 RUNNING');
    });
});

describe('formatBranches', () => {
    it('should format branches as a markdown table', () => {
        const branches: JenkinsJobRef[] = [
            {
                _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
                name: 'main',
                url: 'https://jenkins.example.com/job/my-app/job/main/',
                color: 'blue',
                lastBuild: {
                    _class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
                    number: 100,
                    url: '',
                    result: 'SUCCESS',
                    timestamp: 1700000000000,
                    duration: 154000,
                    building: false,
                },
            },
            {
                _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
                name: 'feature/auth',
                url: 'https://jenkins.example.com/job/my-app/job/feature%2Fauth/',
                color: 'red',
                lastBuild: {
                    _class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
                    number: 28,
                    url: '',
                    result: 'FAILURE',
                    timestamp: 1700000000000,
                    duration: 72000,
                    building: false,
                },
            },
        ];

        const result = formatBranches(branches);

        expect(result).toContain('| Branch | Last Build | Status | Duration | When |');
        expect(result).toContain('main');
        expect(result).toContain('#100');
        expect(result).toContain('SUCCESS');
        expect(result).toContain('feature/auth');
        expect(result).toContain('#28');
        expect(result).toContain('FAILURE');
    });

    it('should handle branches with no builds', () => {
        const branches: JenkinsJobRef[] = [
            {
                _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
                name: 'empty-branch',
                url: '',
                color: 'notbuilt',
                lastBuild: null,
            },
        ];

        const result = formatBranches(branches);

        expect(result).toContain('empty-branch');
        expect(result).toContain('| - | - | - | - |');
    });
});

describe('formatBuild', () => {
    it('should format a single build', () => {
        const build: JenkinsBuild = {
            _class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
            number: 42,
            url: 'https://jenkins.example.com/job/my-app/42/',
            result: 'SUCCESS',
            timestamp: 1700000000000,
            duration: 154000,
            building: false,
            displayName: '#42',
            fullDisplayName: 'my-app #42',
            changeSets: [
                {
                    _class: 'hudson.plugins.git.GitChangeSetList',
                    items: [
                        {
                            msg: 'Fix login bug',
                            author: { fullName: 'Alice' },
                        },
                    ],
                },
            ],
        };

        const result = formatBuild(build);

        expect(result).toContain('# Build #42');
        expect(result).toContain('SUCCESS');
        expect(result).toContain('2m 34s');
        expect(result).toContain('## Changes');
        expect(result).toContain('Fix login bug');
        expect(result).toContain('Alice');
    });
});

describe('formatStages', () => {
    it('should format pipeline stages as a markdown table', () => {
        const run: JenkinsPipelineRun = {
            id: '42',
            name: '#42',
            status: 'FAILURE',
            startTimeMillis: 1700000000000,
            durationMillis: 154000,
            stages: [
                {
                    id: '1',
                    name: 'Checkout',
                    status: 'SUCCESS',
                    startTimeMillis: 1700000000000,
                    durationMillis: 4000,
                },
                {
                    id: '2',
                    name: 'Test',
                    status: 'FAILURE',
                    startTimeMillis: 1700000004000,
                    durationMillis: 72000,
                },
            ],
        };

        const result = formatStages(run);

        expect(result).toContain('| Stage | Status | Duration |');
        expect(result).toContain('Checkout');
        expect(result).toContain('SUCCESS');
        expect(result).toContain('Test');
        expect(result).toContain('FAILURE');
    });
});

describe('formatQueue', () => {
    it('should show empty queue message', () => {
        const queue: JenkinsQueue = { items: [] };
        const result = formatQueue(queue);
        expect(result).toBe('Build queue is empty.');
    });

    it('should format queue items as a table', () => {
        const queue: JenkinsQueue = {
            items: [
                {
                    _class: 'hudson.model.Queue$BlockedItem',
                    id: 123,
                    inQueueSince: 1700000000000,
                    stuck: false,
                    why: 'Waiting for available executor',
                    task: {
                        name: 'my-app',
                        url: 'https://jenkins.example.com/job/my-app/',
                    },
                },
            ],
        };

        const result = formatQueue(queue);

        expect(result).toContain('| Job | Queued Since | Reason |');
        expect(result).toContain('my-app');
        expect(result).toContain('Waiting for available executor');
    });
});

describe('formatJob', () => {
    it('should format job details with recent builds', () => {
        const job: JenkinsJob = {
            _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
            name: 'my-app',
            fullName: 'my-app',
            url: 'https://jenkins.example.com/job/my-app/',
            description: 'Main application',
            buildable: true,
            color: 'blue',
            lastBuild: {
                _class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
                number: 42,
                url: '',
                result: 'SUCCESS',
                timestamp: 1700000000000,
                duration: 120000,
                building: false,
            },
            builds: [
                {
                    _class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
                    number: 42,
                    url: '',
                    result: 'SUCCESS',
                    timestamp: 1700000000000,
                    duration: 120000,
                    building: false,
                },
            ],
        };

        const result = formatJob(job);

        expect(result).toContain('my-app');
        expect(result).toContain('Main application');
        expect(result).toContain('## Recent Builds');
        expect(result).toContain('#42');
    });
});
