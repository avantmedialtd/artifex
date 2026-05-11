# Design: Add SonarQube Support

## Context

Artifex already integrates with Bitbucket Cloud (`af bb`) for PR inspection and Jenkins (`af jenkins`) for build visibility. Users currently lack a CLI path to check whether a Bitbucket PR passed SonarQube quality-gate analysis — they must switch to the Sonar web UI. The integration target is **self-hosted SonarQube** (not SonarCloud) using the standard REST API at `/api/*`.

The codebase has an established pattern for platform integrations: `commands/<name>.ts` for argument parsing and dispatch, plus `<name>/lib/` containing `config.ts`, `request.ts`, `client.ts`, `formatters.ts`, and `types.ts`. `jenkins/lib/` is the closest existing analogue — read-only, single-platform, bearer-style auth — and this design follows that shape.

The user's Sonar setup uses `sonar-project.properties` (the standard scanner config) — this is the natural source of truth for project key and base URL, mirroring what `sonar-scanner` itself reads.

## Goals / Non-Goals

**Goals:**

- Provide read-only CLI access to SonarQube quality gates, issues, measures, and PR list
- Make `af sonar pr` "just work" with zero per-invocation flags when run inside a repo configured for both Bitbucket and SonarQube
- Auto-detect the current branch's open Bitbucket PR id, so users don't have to look it up
- Auto-detect SonarQube project key + base URL from `sonar-project.properties`, walking up from cwd
- Keep auth scoped to its own env vars (`SONAR_TOKEN`, `SONAR_BASE_URL`) — Sonar credentials are not interchangeable with Atlassian or Bitbucket credentials
- Distinguish failure modes clearly: missing config, no open PR, multiple PRs, PR not yet analyzed by Sonar
- Support `--json` on all subcommands for scripting

**Non-Goals:**

- Mutating Sonar state (assign issues, mark hotspots reviewed, change quality gates)
- Wrapping `sonar-scanner` to trigger analyses
- SonarCloud support (different org-scoping model; can be added later)
- Inline Sonar gate status in `af bb pr` output (deferred; tight coupling deliberately avoided in this change)
- `af.json` config block for Sonar — env vars + properties file are sufficient
- Hotspots, security review workflow

## Decisions

### D1: PR id auto-detection via Bitbucket

When the user runs `af sonar pr` with no id, resolve it by:

1. Getting the current git branch (`git rev-parse --abbrev-ref HEAD`)
2. Calling the existing Bitbucket client to list open PRs filtered by `source.branch.name`
3. If exactly one match → use that id; if zero → error with clear message; if multiple → list them and require explicit id

**Why this approach:** The headline use case is "check the gate for the PR I'm currently working on." Forcing the user to look up the id defeats that. Reusing `bitbucket/lib/` avoids duplicating Bitbucket logic.

**Alternative considered:** Read PR id from a CI env var (e.g. `BITBUCKET_PR_ID`). Rejected because the user runs this locally, not from CI.

**Trade-off:** `af sonar pr` (without id) requires Bitbucket env vars to be present. With an explicit id, no Bitbucket setup is needed — the dependency is opt-in based on usage.

### D2: Project key + base URL resolution

Resolution order:

```
Base URL:    SONAR_BASE_URL env  →  sonar.host.url in sonar-project.properties
Project key: --project flag      →  sonar.projectKey in sonar-project.properties
Token:       SONAR_TOKEN env     →  (no fallback; secrets do not belong in properties files)
```

Properties file lookup walks up from cwd until it finds `sonar-project.properties` or reaches the filesystem root. Parsing is intentionally minimal: split each non-comment line on the first `=`, trim, no Java-properties escape-sequence handling.

**Why no `af.json` block:** The properties file is already the canonical place where Sonar config lives for scanner invocations. Adding `af.json` would create two sources of truth that could drift. Env vars cover the per-machine overrides.

**Alternative considered:** Full Java `.properties` parser (handle line continuations, unicode escapes, etc.). Rejected — `sonar-project.properties` files in practice are simple key=value lists; the complexity isn't justified.

### D3: Authentication via bearer token

`SONAR_TOKEN` is sent as `Authorization: Bearer <token>`. SonarQube also accepts the token as the basic-auth username with an empty password, but bearer is cleaner and is the modern recommendation.

**Why:** Simpler than Atlassian's email+token basic-auth scheme, fewer footguns, no escape-encoding required.

### D4: `af sonar pr` shows a combined view by default

The primary subcommand bundles three API calls in one render:

```
af sonar pr 42
├─ /api/qualitygates/project_status?projectKey=K&pullRequest=42   → headline pass/fail
├─ /api/issues/search?componentKeys=K&pullRequest=42&ps=20        → top issues
└─ /api/measures/component?component=K&pullRequest=42             → coverage, dup %
```

The three calls run in parallel. `--issues` switches to a full issues list (paginated as needed).

**Why combined:** This is what the user actually wants to know on one screen. Forcing three commands to assemble the picture would be friction.

**Alternative considered:** Lazy / on-demand fetching of issues only when the gate failed. Rejected — issues data is small (PRs rarely introduce hundreds of issues), the latency is dominated by the slowest of three parallel calls, and showing issues on a passing gate is still useful context.

### D5: File layout follows `jenkins/lib/` precedent

```
commands/sonar.ts          # arg parsing, subcommand dispatch, help text
sonar/lib/config.ts        # env vars + properties resolution
sonar/lib/properties.ts    # walk-up parser for sonar-project.properties
sonar/lib/request.ts       # bearer-auth fetch helper + error mapping
sonar/lib/client.ts        # gate(), issues(), measures(), prs()
sonar/lib/formatters.ts    # human-readable renderers + JSON passthrough
sonar/lib/types.ts         # response type definitions
```

**Why this split:** Same as `jenkins/` and consistent with the codebase. `properties.ts` is separated from `config.ts` because it's a generic parser unit and easier to test in isolation.

### D6: Error mapping at the request layer

`request.ts` maps HTTP errors to a small, named set:

- `401 / 403` → `SonarAuthError("token rejected — check SONAR_TOKEN")`
- `404` on `qualitygates/project_status` with `pullRequest` param → `SonarPRNotAnalyzedError(prId)` — Sonar hasn't seen this PR yet (scan didn't run, or PR id is wrong)
- `404` on project lookup → `SonarProjectNotFoundError(projectKey)`
- Other non-2xx → generic `SonarRequestError(status, body)`

This makes user-facing error messages actionable rather than dumping raw API responses.

### D7: Packaging — extend `files` allowlist

`package.json` `files` must gain `sonar/**/*.ts`. CLAUDE.md flags this explicitly as a publishing guardrail — without it the local code works but the npm tarball ships broken. This is part of the change itself, not a follow-up.

## Risks / Trade-offs

- **[Risk] `sonar-project.properties` missing or unreadable when the user expects auto-detection.** → Mitigation: clear error message naming the file searched for and the directories walked; explicit `--project` flag always available as override.

- **[Risk] PR analyzed but with a different PR id than Bitbucket's (e.g. scanner invoked with wrong `sonar.pullrequest.key`).** → Mitigation: `SonarPRNotAnalyzedError` includes the project key and PR id queried, plus a hint to check the scanner invocation in CI.

- **[Risk] `af sonar pr` (no id) silently falls back to confusing behavior when Bitbucket env vars are missing.** → Mitigation: distinct error: "PR id not provided and Bitbucket auto-detect failed: BITBUCKET_API_TOKEN not set. Pass the PR id explicitly or configure Bitbucket env vars."

- **[Risk] Multiple open PRs from one branch (rare — forks, reopened) cause auto-detect to fail at the moment the user most wants it to work.** → Mitigation: list the candidate PRs with titles + ids in the error and ask the user to pass one explicitly.

- **[Trade-off] Three parallel API calls on every `af sonar pr` invocation, even when the user only cares about the gate headline.** → Acceptable: latency is dominated by the slowest call regardless, total payload is small, and the combined view is the primary value proposition.

- **[Trade-off] No SonarCloud support in this change.** → Acceptable: keeps the surface area focused; SonarCloud can be layered on later by extending config resolution and threading `organization` through requests.

- **[Trade-off] No mutating operations.** → Acceptable: the MVP value is visibility. Mutations can be a follow-up if there's demand.

## Migration Plan

No migration needed — this is a new command. Deployment is the standard `npm publish` after merging. The only deployment-adjacent hazard is forgetting the `files` allowlist update (D7); the spec includes a scenario for it and `npm pack --dry-run` can verify pre-publish.

## Open Questions

None blocking. Resolved during exploration:

- ~~SonarQube vs SonarCloud~~ → self-hosted SonarQube only
- ~~`af.json` config block~~ → no, env + properties only
- ~~Auto-detect PR from branch~~ → yes
- ~~Cross-integration with `af bb pr`~~ → deferred to a follow-up change
