## 1. Jenkins Config and Request Infrastructure

- [x] 1.1 Create `jenkins/lib/config.ts` — read `JENKINS_BASE_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN` env vars with validation and trailing slash normalization
- [x] 1.2 Create `jenkins/lib/request.ts` — generic `request<T>()` helper with Basic auth, `/api/json` URL construction, and error handling
- [x] 1.3 Create `jenkins/lib/types.ts` — TypeScript interfaces for Jenkins API responses (jobs, builds, queue, pipeline stages)

## 2. Jenkins Client

- [x] 2.1 Create `jenkins/lib/client.ts` — implement job path resolution (`/` → `/job/`) and build number resolution (`latest` → `lastBuild`)
- [x] 2.2 Implement `getJobs(folder?)` — list jobs with `tree` parameter for field selection
- [x] 2.3 Implement `getJob(name)` — job details with recent builds
- [x] 2.4 Implement `getBranches(pipeline)` — list multibranch pipeline branches with last build status
- [x] 2.5 Implement `getBuild(name, number?)` — build details (defaults to lastBuild)
- [x] 2.6 Implement `getConsoleOutput(name, number?)` — full console text
- [x] 2.7 Implement `getQueue()` — list queued items
- [x] 2.8 Implement `getStages(name, number?)` — pipeline stages via wfapi with 404 handling for missing plugin
- [x] 2.9 Implement `getStageLog(name, stage, number?)` — stage log with case-insensitive stage name matching

## 3. Jenkins Formatters

- [x] 3.1 Create `jenkins/lib/formatters.ts` — `output()` dispatcher, `jobLink()` helper
- [x] 3.2 Implement `formatJobs()` — markdown table of jobs with name, status, last build
- [x] 3.3 Implement `formatJob()` — job detail with metadata and recent builds table
- [x] 3.4 Implement `formatBranches()` — markdown table of branches with build status, duration, and timestamp
- [x] 3.5 Implement `formatBuild()` — single build detail with number, result, duration, timestamp, change sets
- [x] 3.6 Implement `formatStages()` — markdown table of pipeline stages with name, status, duration
- [x] 3.7 Implement `formatQueue()` — markdown table of queued items with job name, queue time, reason

## 4. Command Handler

- [x] 4.1 Create `commands/jenkins.ts` — `handleJenkins()` entry point, `parseArgs()`, `JenkinsOptions` interface, inline help text
- [x] 4.2 Implement subcommand routing switch: jobs, job, branches, build, log, queue, stages, stage-log

## 5. Routing and Help

- [x] 5.1 Add `jenkins` route to `router.ts`
- [x] 5.2 Add jenkins entry to `commands/help.ts` — description, usage, and examples

## 6. Tests

- [x] 6.1 Test job path resolution — simple name, nested path, multibranch
- [x] 6.2 Test build number resolution — omitted, `latest`, numeric
- [x] 6.3 Test config validation — missing vars, trailing slash normalization
- [x] 6.4 Test formatters — markdown table output for jobs, branches, builds, stages, queue
