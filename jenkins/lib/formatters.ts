// cspell:words Millis
/**
 * Jenkins output formatters.
 * Converts API responses to markdown tables or JSON.
 */

import type {
    JenkinsJob,
    JenkinsJobRef,
    JenkinsBuild,
    JenkinsBuildRef,
    JenkinsQueue,
    JenkinsPipelineRun,
    BuildResult,
} from './types.ts';
import { link } from '../../utils/output.ts';

function getBaseUrl(): string {
    return process.env.JENKINS_BASE_URL?.replace(/\/$/, '') ?? '';
}

export function jobLink(name: string, url?: string): string {
    const base = getBaseUrl();
    if (!base && !url) return name;
    const target = url ?? `${base}/job/${name.split('/').join('/job/')}`;
    return link(name, target);
}

// Output helper
export function output(data: unknown, asJson: boolean): void {
    if (asJson) {
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log(data);
    }
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatStatus(result: BuildResult, building: boolean): string {
    if (building) return 'RUNNING';
    return result ?? 'UNKNOWN';
}

function formatBuildRef(build: JenkinsBuildRef | null | undefined): string {
    if (!build) return '-';
    return `#${build.number} ${formatStatus(build.result, build.building)}`;
}

export function formatJobs(jobs: JenkinsJobRef[]): string {
    const lines: string[] = [];
    lines.push('| Name | Status | Last Build |');
    lines.push('|------|--------|------------|');
    for (const job of jobs) {
        const status = job.color?.replace(/_anime$/, ' (building)') ?? '-';
        const lastBuild = formatBuildRef(job.lastBuild);
        lines.push(`| ${jobLink(job.name, job.url)} | ${status} | ${lastBuild} |`);
    }
    return lines.join('\n');
}

export function formatJob(job: JenkinsJob): string {
    const lines: string[] = [];

    lines.push(`# ${jobLink(job.fullName || job.name, job.url)}`);
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    if (job.description) {
        lines.push(`| Description | ${job.description} |`);
    }
    lines.push(`| Buildable | ${job.buildable} |`);
    lines.push(`| Status | ${job.color?.replace(/_anime$/, ' (building)') ?? '-'} |`);
    if (job.lastBuild) {
        lines.push(`| Last Build | ${formatBuildRef(job.lastBuild)} |`);
    }
    if (job.lastSuccessfulBuild) {
        lines.push(`| Last Success | #${job.lastSuccessfulBuild.number} |`);
    }
    if (job.lastFailedBuild) {
        lines.push(`| Last Failure | #${job.lastFailedBuild.number} |`);
    }

    if (job.builds?.length) {
        lines.push('');
        lines.push('## Recent Builds');
        lines.push('');
        lines.push('| Build | Status | Duration | When |');
        lines.push('|-------|--------|----------|------|');
        for (const build of job.builds) {
            lines.push(
                `| #${build.number} | ${formatStatus(build.result, build.building)} | ${formatDuration(build.duration)} | ${formatTimestamp(build.timestamp)} |`,
            );
        }
    }

    if (job.jobs?.length) {
        lines.push('');
        lines.push('## Branches');
        lines.push('');
        lines.push(formatBranches(job.jobs));
    }

    return lines.join('\n');
}

export function formatBranches(jobs: JenkinsJobRef[]): string {
    const lines: string[] = [];
    lines.push('| Branch | Last Build | Status | Duration | When |');
    lines.push('|--------|------------|--------|----------|------|');
    for (const job of jobs) {
        const build = job.lastBuild;
        if (build) {
            lines.push(
                `| ${jobLink(job.name, job.url)} | #${build.number} | ${formatStatus(build.result, build.building)} | ${formatDuration(build.duration)} | ${formatTimestamp(build.timestamp)} |`,
            );
        } else {
            lines.push(`| ${jobLink(job.name, job.url)} | - | - | - | - |`);
        }
    }
    return lines.join('\n');
}

export function formatBuild(build: JenkinsBuild): string {
    const lines: string[] = [];

    lines.push(`# Build #${build.number}`);
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    lines.push(`| Status | ${formatStatus(build.result, build.building)} |`);
    lines.push(`| Duration | ${formatDuration(build.duration)} |`);
    lines.push(`| When | ${formatTimestamp(build.timestamp)} |`);
    if (build.description) {
        lines.push(`| Description | ${build.description} |`);
    }

    if (build.changeSets?.length) {
        for (const changeSet of build.changeSets) {
            if (changeSet.items.length > 0) {
                lines.push('');
                lines.push('## Changes');
                lines.push('');
                for (const item of changeSet.items) {
                    lines.push(`- ${item.msg} (${item.author.fullName})`);
                }
            }
        }
    }

    return lines.join('\n');
}

export function formatStages(run: JenkinsPipelineRun): string {
    const lines: string[] = [];
    lines.push('| Stage | Status | Duration |');
    lines.push('|-------|--------|----------|');
    for (const stage of run.stages) {
        lines.push(`| ${stage.name} | ${stage.status} | ${formatDuration(stage.durationMillis)} |`);
    }
    return lines.join('\n');
}

export function formatQueue(queue: JenkinsQueue): string {
    if (queue.items.length === 0) {
        return 'Build queue is empty.';
    }
    const lines: string[] = [];
    lines.push('| Job | Queued Since | Reason |');
    lines.push('|-----|-------------|--------|');
    for (const item of queue.items) {
        const reason = item.why ?? (item.stuck ? 'Stuck' : '-');
        lines.push(
            `| ${jobLink(item.task.name, item.task.url)} | ${formatTimestamp(item.inQueueSince)} | ${reason} |`,
        );
    }
    return lines.join('\n');
}
