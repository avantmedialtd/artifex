// cspell:words Millis
// Jenkins API Types

export type BuildResult = 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'NOT_BUILT' | null;

export interface JenkinsBuildRef {
    _class: string;
    number: number;
    url: string;
    result: BuildResult;
    timestamp: number;
    duration: number;
    building: boolean;
}

export interface JenkinsChangeSetItem {
    msg: string;
    author: {
        fullName: string;
    };
    timestamp?: number;
}

export interface JenkinsChangeSet {
    _class: string;
    items: JenkinsChangeSetItem[];
}

export interface JenkinsBuild {
    _class: string;
    number: number;
    url: string;
    result: BuildResult;
    timestamp: number;
    duration: number;
    building: boolean;
    displayName: string;
    fullDisplayName: string;
    description?: string;
    changeSets?: JenkinsChangeSet[];
}

export interface JenkinsJobRef {
    _class: string;
    name: string;
    url: string;
    color?: string;
    lastBuild?: JenkinsBuildRef | null;
}

export interface JenkinsJob {
    _class: string;
    name: string;
    fullName: string;
    url: string;
    description?: string;
    buildable: boolean;
    color?: string;
    lastBuild?: JenkinsBuildRef | null;
    lastSuccessfulBuild?: JenkinsBuildRef | null;
    lastFailedBuild?: JenkinsBuildRef | null;
    builds?: JenkinsBuildRef[];
    jobs?: JenkinsJobRef[];
}

export interface JenkinsJobsResponse {
    _class: string;
    jobs: JenkinsJobRef[];
}

export interface JenkinsQueueItem {
    _class: string;
    id: number;
    inQueueSince: number;
    stuck: boolean;
    why?: string;
    task: {
        name: string;
        url: string;
    };
}

export interface JenkinsQueue {
    items: JenkinsQueueItem[];
}

export interface JenkinsPipelineStage {
    id: string;
    name: string;
    status: string;
    startTimeMillis: number;
    durationMillis: number;
    pauseDurationMillis?: number;
}

export interface JenkinsPipelineRun {
    _class?: string;
    id: string;
    name: string;
    status: string;
    startTimeMillis: number;
    durationMillis: number;
    stages: JenkinsPipelineStage[];
}

export interface JenkinsStageLog {
    nodeId: string;
    nodeStatus: string;
    length: number;
    hasMore: boolean;
    text: string;
}
