# Add Jenkins Command — Design

## Context

Artifex has `af jira` and `af confluence` commands that follow a consistent pattern: command handler with `parseArgs()` + switch-based subcommand routing, a `lib/` directory with client, types, and formatters, and shared Atlassian infrastructure for auth and config. Jenkins is a separate system (not Atlassian Cloud) with its own REST API and auth model. The command is read-only — no triggering builds, no modifying config.

## Goals / Non-Goals

**Goals:**

- Read-only visibility into Jenkins jobs, builds, branches, pipeline stages, queue
- Follow the same command handler pattern as jira/confluence (parseArgs, switch routing, lazy loading, exit codes)
- Self-contained `jenkins/lib/` with its own config, request helper, client, types, formatters
- `/` separator for job paths, mapping to Jenkins `/job/x/job/y/` URL structure
- `latest` keyword (and default) for build number, mapping to `/lastBuild/`

**Non-Goals:**

- Triggering builds or any write operations
- Node/agent management
- Shared infrastructure with `atlassian/lib/` — keep fully separate
- CSRF crumb handling (not needed for read-only GET requests with Basic auth)
- Streaming/progressive log output — always return full console text

## Decisions

### Job path resolution

Job paths use `/` as separator: `my-pipeline/feature/auth` resolves to `/job/my-pipeline/job/feature/job/auth/`. Split on `/`, join with `/job/`. This handles folders, multibranch branches, and nested structures uniformly.

**Alternative considered:** Separate `--folder` flag. Rejected because the `/` convention is more ergonomic and matches how Jenkins displays full names.

### Build number resolution

Build number is always the last positional arg where applicable. When omitted or set to `latest`, resolve to `lastBuild` in the API URL. When numeric, use the number directly.

```
af jenkins log my-app/main           → /job/my-app/job/main/lastBuild/consoleText
af jenkins log my-app/main latest    → /job/my-app/job/main/lastBuild/consoleText
af jenkins log my-app/main 142       → /job/my-app/job/main/142/consoleText
```

**Alternative considered:** Named `--build` flag. Rejected to stay consistent with positional args used in jira (e.g., `af jira get PROJ-123`).

### Separate request helper (not reusing atlassian/lib)

Jenkins auth uses `username:apiToken` Basic auth (similar to Atlassian's `email:apiToken`), but the URL construction is completely different — Jenkins uses path-based `/api/json` suffix rather than versioned REST endpoints. Keeping `jenkins/lib/request.ts` separate avoids coupling to Atlassian patterns and keeps each module self-contained.

### Use `tree` parameter for field selection

Jenkins API responses can be large. Use the `tree` query parameter on list/summary endpoints to request only the fields we need. For detail endpoints (single build, console output), fetch the full response.

```
# List jobs — only fetch what we display
?tree=jobs[name,color,url,lastBuild[number,result,timestamp,duration]]

# Job detail — fetch recent builds
?tree=name,fullName,description,buildable,lastBuild[...],builds[number,result,timestamp,duration]{0,10}
```

### Console output as plain text

`/consoleText` returns the full build log as plain text. No transformation needed — output it directly. The user can pipe through `grep`, `tail`, etc. No truncation.

### Stage log via wfapi

Pipeline stage information uses the `/wfapi/describe` endpoint which returns stage names, statuses, and durations. Stage logs use `/wfapi/log` on individual node IDs. The `stage-log` subcommand finds the matching stage by name (case-insensitive) and fetches its log.

### Config pattern

Three environment variables with no legacy fallback (unlike Atlassian's `JIRA_*` fallback):

```
JENKINS_BASE_URL=https://jenkins.example.com
JENKINS_USER=username
JENKINS_API_TOKEN=api-token
```

Validation follows the same pattern as `atlassian/lib/config.ts` — fail fast with a helpful error message listing what's missing.

### Formatters

Follow the same pattern as jira/confluence formatters:

- `output(data, asJson)` — JSON or markdown dispatcher
- `formatJob()` — job detail with recent builds table
- `formatJobs()` — job list as markdown table
- `formatBranches()` — branch statuses as markdown table
- `formatBuild()` — single build detail
- `formatStages()` — pipeline stages as markdown table
- `formatQueue()` — queue items as markdown table
- `jobLink()` — markdown link to Jenkins web UI

Build status mapping for display:

| Jenkins result | Display |
|---------------|---------|
| `SUCCESS` | SUCCESS |
| `FAILURE` | FAILURE |
| `UNSTABLE` | UNSTABLE |
| `ABORTED` | ABORTED |
| `NOT_BUILT` | NOT_BUILT |
| `null` (building=true) | RUNNING |

## Risks / Trade-offs

**[Jenkins API inconsistency]** → The wfapi endpoints for pipeline stages are not part of Jenkins core — they come from the Pipeline Stage View plugin. If it's not installed, `stages` and `stage-log` will fail. Mitigation: catch the 404 and show a clear error message suggesting the plugin may not be installed.

**[Large console output]** → Build logs can be tens of megabytes. Outputting everything is the right default (user can pipe), but it could be slow over the network. Mitigation: none needed — this matches the user's explicit requirement. The user handles truncation.

**[Folder depth ambiguity]** → A path like `a/b/c` could be folder `a` → folder `b` → job `c`, or multibranch pipeline `a/b` → branch `c`. Jenkins resolves this the same way (path segments = `/job/` segments), so there's no ambiguity in the API — only in the user's mental model. Mitigation: the `job` subcommand shows the job type (`_class`) which clarifies what kind of item it is.
