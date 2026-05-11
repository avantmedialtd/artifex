# Add SonarQube Support

## Why

Developers reviewing Bitbucket pull requests currently have no CLI-level visibility into SonarQube quality gate status — they must context-switch to the Sonar web UI to find out whether a PR passed analysis and what new issues it introduced. A read-only `af sonar` command brings PR quality-gate checks into the same terminal workflow as `af bb pr`, removing the round-trip and enabling quick "is this mergeable?" checks alongside existing PR inspection.

## What Changes

- New `af sonar` command group with read-only subcommands targeting a self-hosted SonarQube instance:
    - `af sonar pr [pr-id]` — quality gate status, top new issues, key measures for a PR. Auto-detects PR id from the current branch's open Bitbucket PR when omitted.
    - `af sonar pr [pr-id] --issues` — full list of new issues on the PR
    - `af sonar gate` — quality gate status for the main branch (no PR scope)
    - `af sonar prs` — list PRs SonarQube knows about for the current project
- Bearer-token authentication via `SONAR_TOKEN` env var
- Base URL resolution: `SONAR_BASE_URL` env var → `sonar.host.url` from `sonar-project.properties`
- Project key resolution: `--project` flag → `sonar.projectKey` from `sonar-project.properties` (walking up from cwd)
- `--json` flag on all subcommands to emit raw API responses
- New top-level directory `sonar/` added to `package.json` `files` allowlist so the published tarball includes it

Not in scope: write operations (issue assign/transition/comment), hotspots, scanner invocation, inline Sonar status in `af bb pr` output, `af.json` config block.

## Capabilities

### New Capabilities

- `sonarqube-command`: Read-only CLI for inspecting SonarQube quality gates, issues, measures, and pull requests on a self-hosted SonarQube instance. Includes env-var + `sonar-project.properties` configuration resolution and Bitbucket-PR auto-detection for the current git branch.

### Modified Capabilities

<!-- None: no existing spec requirements change. The bb pr summary is not modified
     in this scope; cross-integration is deferred. -->

## Impact

- **New code**:
    - `commands/sonar.ts` — argument parsing, subcommand dispatch
    - `sonar/lib/config.ts` — env var + properties file resolution
    - `sonar/lib/properties.ts` — `sonar-project.properties` walk-up parser
    - `sonar/lib/request.ts` — bearer-auth HTTP helper
    - `sonar/lib/client.ts` — typed wrappers for `qualitygates/project_status`, `issues/search`, `measures/component`, `project_pull_requests/list`
    - `sonar/lib/formatters.ts` — human-readable output
    - `sonar/lib/types.ts` — API response types
- **Code reuse**: `af sonar pr` (without id) calls into existing `bitbucket/lib/` to resolve the current branch's open PR. No duplication of Bitbucket logic.
- **Router**: `router.ts` dispatches `sonar` to `commands/sonar.ts`
- **Help**: `commands/help.ts` updated with `sonar` entry
- **Packaging**: `package.json` `files` array gains `sonar/**/*.ts` — required per CLAUDE.md publishing guardrail; without it the published package will fail at runtime
- **New env vars**: `SONAR_BASE_URL` (optional), `SONAR_TOKEN` (required). No Atlassian or Bitbucket variables are reused — SonarQube tokens are distinct credentials
- **Dependencies**: none new — uses `fetch` and existing utilities
