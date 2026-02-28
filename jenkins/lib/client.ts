/**
 * Jenkins API client.
 * All read-only operations for jobs, builds, pipelines, and queue.
 */

import { request, requestText, resolveJobPath, resolveBuildNumber } from './request.ts';
import type {
    JenkinsJob,
    JenkinsJobsResponse,
    JenkinsBuild,
    JenkinsQueue,
    JenkinsPipelineRun,
    JenkinsStageLog,
} from './types.ts';

// Re-export path/build resolution for use in tests
export { resolveJobPath, resolveBuildNumber } from './request.ts';

const JOBS_TREE = 'jobs[name,color,url,lastBuild[number,result,timestamp,duration,building]]';
const JOB_TREE =
    'name,fullName,description,buildable,color,url,' +
    'lastBuild[number,result,timestamp,duration,building],' +
    'lastSuccessfulBuild[number,result,timestamp],' +
    'lastFailedBuild[number,result,timestamp],' +
    'builds[number,result,timestamp,duration,building]{0,10},' +
    'jobs[name,color,url,lastBuild[number,result,timestamp,duration,building]]';

export async function getJobs(folder?: string): Promise<JenkinsJobsResponse> {
    const path = folder ? resolveJobPath(folder) : '';
    return request<JenkinsJobsResponse>(`${path}/api/json?tree=${JOBS_TREE}`);
}

export async function getJob(name: string): Promise<JenkinsJob> {
    const path = resolveJobPath(name);
    return request<JenkinsJob>(`${path}/api/json?tree=${JOB_TREE}`);
}

export async function getBranches(pipeline: string): Promise<JenkinsJob> {
    const path = resolveJobPath(pipeline);
    return request<JenkinsJob>(`${path}/api/json?tree=${JOB_TREE}`);
}

export async function getBuild(name: string, buildNumber?: string): Promise<JenkinsBuild> {
    const path = resolveJobPath(name);
    const build = resolveBuildNumber(buildNumber);
    return request<JenkinsBuild>(`${path}/${build}/api/json`);
}

export async function getConsoleOutput(name: string, buildNumber?: string): Promise<string> {
    const path = resolveJobPath(name);
    const build = resolveBuildNumber(buildNumber);
    return requestText(`${path}/${build}/consoleText`);
}

export async function getQueue(): Promise<JenkinsQueue> {
    return request<JenkinsQueue>('/queue/api/json');
}

export async function getStages(name: string, buildNumber?: string): Promise<JenkinsPipelineRun> {
    const path = resolveJobPath(name);
    const build = resolveBuildNumber(buildNumber);
    try {
        return await request<JenkinsPipelineRun>(`${path}/${build}/wfapi/describe`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('404')) {
            throw new Error(
                'Pipeline stages not available. ' +
                    'The Pipeline Stage View plugin may not be installed, ' +
                    'or this job may not be a pipeline.',
            );
        }
        throw err;
    }
}

export async function getStageLog(
    name: string,
    stageName: string,
    buildNumber?: string,
): Promise<JenkinsStageLog> {
    const run = await getStages(name, buildNumber);
    const stage = run.stages.find(s => s.name.toLowerCase() === stageName.toLowerCase());
    if (!stage) {
        const available = run.stages.map(s => s.name).join(', ');
        throw new Error(`Stage "${stageName}" not found. Available stages: ${available}`);
    }
    const path = resolveJobPath(name);
    const build = resolveBuildNumber(buildNumber);
    return request<JenkinsStageLog>(`${path}/${build}/execution/node/${stage.id}/wfapi/log`);
}
