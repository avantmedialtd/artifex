# Add Jenkins Command

## Why

The CLI supports Jira and Confluence for Atlassian workflows, but has no visibility into Jenkins CI/CD. Developers need to check build statuses across branches and read build output without leaving the terminal.

## What Changes

- Add `af jenkins` command with read-only subcommands for jobs, builds, pipelines, and queue
- Add `jenkins/lib/` module with its own config, request helper, client, types, and formatters (separate from `atlassian/lib/`)
- Add Jenkins-specific environment variable configuration (`JENKINS_BASE_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN`)
- Add routing and help entries for the jenkins command

## Capabilities

### New Capabilities

- `jenkins-command`: CLI command for read-only Jenkins operations — jobs, builds, branches, console output, pipeline stages, and queue
- `jenkins-config`: Jenkins authentication and configuration via environment variables, separate from Atlassian config

### Modified Capabilities

- `cli-help-system`: Add jenkins command to help output

## Impact

- New files: `commands/jenkins.ts`, `jenkins/lib/client.ts`, `jenkins/lib/config.ts`, `jenkins/lib/request.ts`, `jenkins/lib/types.ts`, `jenkins/lib/formatters.ts`
- Modified files: `router.ts`, `commands/help.ts`
- New environment variables: `JENKINS_BASE_URL`, `JENKINS_USER`, `JENKINS_API_TOKEN`
- No changes to existing Atlassian infrastructure
