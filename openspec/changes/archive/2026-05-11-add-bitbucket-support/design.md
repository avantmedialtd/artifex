# Design: Bitbucket Cloud Support

## Context

Artifex already supports two Atlassian products (Jira, Confluence) through a shared infrastructure layer at `atlassian/lib/` (config, request helper, ADF converters). Adding Bitbucket Cloud is the obvious next step: it's the same vendor, the same credential scheme, and it closes the loop on the agent-driven workflow that `start-work` / `commit-work` / `complete-work` already implement for everything except the PR step.

The scope was explicitly bounded by the user during exploration: Cloud only (not Server/DC), high-value workflow surface (PRs, comments, tasks, pipelines), reuse the existing API token, mirror the Jira command pattern. Skill integration (e.g., auto-PR from `complete-work`) is out of scope for this change.

Two API details that aren't fully documented in Atlassian's developer docs need a quick verification step during implementation:
1. The PUT body shape for resolving/unresolving a PR task (state field name and value).
2. The POST body field name for linking a new task to a specific comment.

Both can be settled with two `curl` calls against the sandbox repo.

## Goals / Non-Goals

**Goals:**
- A `bitbucket-command` capability that's at parity with `jira-command` for its scope: full CRUD on PRs, comments, tasks, pipelines, with `--json` mode and consistent terminal output.
- Zero new credentials — reuse `ATLASSIAN_API_TOKEN` / `ATLASSIAN_EMAIL` (or `JIRA_*` legacy fallback) for Bitbucket Cloud Basic auth.
- Workspace/repo resolution that "just works" inside any Bitbucket-hosted repo checkout, while still being explicit when needed.
- Pagination and text-response handling pulled into the shared layer so they can serve future commands too.
- Reviewer assignment by account ID (sufficient for agent use), with a lookup helper for humans.

**Non-Goals:**
- Bitbucket Server / Data Center support. Different API, different auth, EOL'd in 2024.
- Repo, branch, workspace, webhook, deploy-key, SSH-key CRUD. Rare operations, the UI is fine.
- Default-task management. No public API exists.
- Skill integration (`complete-work` auto-PR, etc.). Tracked separately.
- Reviewer username → account ID auto-resolution. Account IDs only for now; the `members` subcommand is the escape hatch.
- Streaming pipeline log support beyond a simple `--follow` poll loop. Bitbucket has no SSE/websocket log API.

## Decisions

### Separate `BITBUCKET_USERNAME` + `BITBUCKET_API_TOKEN` env vars

The original plan was to reuse `ATLASSIAN_API_TOKEN` and `getAuthHeader()` from `atlassian/lib/`. Discovery (task 1.1) showed this fails: Atlassian API tokens scoped for Jira/Confluence return `401 — Token is invalid, expired, or not supported for this endpoint` against `api.bitbucket.org/2.0/user`. The same token continues to work for Jira (200), so this is a Bitbucket-side scope/product split, not a token problem.

**Decision:** introduce dedicated env vars and a Bitbucket-specific auth helper.

```
BITBUCKET_USERNAME    bitbucket username or workspace token label
                      (falls back to ATLASSIAN_EMAIL / JIRA_EMAIL)
BITBUCKET_API_TOKEN   workspace API token / app password
                      (BITBUCKET_APP_PASSWORD also accepted as alias)
```

The auth header is computed in `bitbucket/lib/request.ts` and applied by thin wrappers (`bbRequest`, `bbRequestText`, `bbPaginate`) that delegate the actual HTTP work to `atlassian/lib/request.ts` but override the `Authorization` header. This keeps shared error parsing, content-type handling, and pagination semantics intact while letting Bitbucket carry its own credentials.

**Alternative considered:** patch `atlassian/lib/request.ts` to accept a per-call auth override. Rejected — invasive change for a single caller; the override-via-options-headers route is simpler and Atlassian's own helpers stay focused on Atlassian-token semantics.

**Alternative considered:** require users to upgrade their Atlassian API token to a scoped token with Bitbucket scopes. Rejected — depends on org policy, often a multi-step migration, and doesn't help users on app passwords. Workspace API tokens are the documented path for automation.

### Add `requestText()` and `paginate()` to the shared layer

Bitbucket Cloud has two patterns the existing helpers don't cover:
- **Text responses**: pipeline logs (`/pipelines/{u}/steps/{s}/log`) and PR diffs (`/pullrequests/{id}/diff`) return `text/plain`. The current `request<T>(): Promise<T>` always parses JSON.
- **Cursor pagination**: list endpoints return `{values, next, page, size}` with `next` being a fully-qualified URL to the next page.

**Decision:** add both as siblings in `atlassian/lib/request.ts` rather than Bitbucket-specific modules.
- `export async function requestText(url, options): Promise<string>` — same auth and error handling as `request`, but returns the raw body.
- `export async function* paginate<T>(url): AsyncIterable<T>` — yields each `value`, follows `next` automatically, stops when `next` is undefined.

**Alternative considered:** put them in `bitbucket/lib/`. Rejected — both are general HTTP utilities; the cursor pattern in particular shows up across Atlassian APIs. Co-locating with the auth + request helpers keeps the layer cohesive. This requires modifying the `atlassian-shared-config` capability spec (see specs delta).

### Mirror the Jira module structure

```
bitbucket/
└── lib/
    ├── client.ts        # API surface: prs, comments, tasks, pipelines, members
    ├── formatters.ts    # Render PRs, comments, tasks, pipelines for terminal
    ├── types.ts         # API response shapes
    └── config.ts        # Workspace/repo resolution
commands/
└── bitbucket.ts         # argv parsing, --json mode, command routing
```

Same shape as `jira/lib/`, same call conventions, same `--json` flag, same error-handling pattern. Predictable for anyone who's read the Jira code.

### Workspace/repo resolution: 3-layer

```
1. --workspace / --repo flags
2. af.json: bitbucket.workspace / bitbucket.repo
3. git remote get-url origin → parse if hostname matches bitbucket.org
4. error with help text
```

Layer 3 is the ergonomic win. Inside any Bitbucket-hosted checkout, `af bb pr list` works without arguments. Implementation: shell out to `git remote get-url origin`, regex-match `bitbucket.org[:/](workspace)/(repo)(\.git)?`. If it doesn't match, fall through to error.

**Alternative considered:** make layer 3 opt-in via a flag. Rejected — silent inference is the right default for a dev tool; an explicit flag on every invocation defeats the point.

### Comment shape determined by request body, not URL

Bitbucket Cloud uses one POST endpoint (`/pullrequests/{id}/comments`) and three orthogonal body shapes:
- General: `{content: {raw}}`
- Inline: add `inline: {path, to}` (or `from`)
- Reply: add `parent: {id}`

**Decision:** the `add` subcommand exposes flags that map directly to body keys: `--body`, `--file`/`--line`, `--reply-to`. The handler builds the body from whichever flags are present. No subcommand split (`comment add` vs `comment reply` vs `comment inline`) — the flag set is small and the orthogonality is real.

### Reviewer arguments accept account IDs only

Cloud's PR create body wants `reviewers: [{account_id: "..."}]`, not usernames. Resolving usernames → account IDs requires a per-call lookup (`/workspaces/{ws}/members?q=…`).

**Decision:** for now, `--reviewers` takes a comma-separated list of account IDs. A separate `af bitbucket members [--query Q]` subcommand returns the lookup table. The user's stated reasoning: agent use is the primary case, and agents work fine with IDs.

**Future:** if humans use this enough to be annoyed, the `--reviewers` parser can be extended to attempt a lookup when an argument doesn't match the account-ID format. Not now.

### Pipeline logs: both one-shot and streaming

`af bb pipeline logs <uuid> <step-uuid>` fetches the log once. `--follow` poll-loops the same endpoint with byte-range or content-length tracking, sleeping ~2 seconds between polls. Stop when the step's status is terminal (`SUCCESSFUL`, `FAILED`, `STOPPED`, `ERROR`).

**Alternative considered:** Bitbucket Pipelines has no SSE or websocket log API; this is the only mechanism. We just need the polling to be reasonable.

### `--json` mode mirrors Jira

Every subcommand that produces structured output supports `--json`, emitting the raw API response (post-pagination). For `list` operations, this means a JSON array of all values across all pages. For `get`-like operations, the single object. Errors still go to stderr with non-zero exit; nothing is mixed into stdout.

### Naming: `af bitbucket` with `bb` alias

Full name for discoverability and consistency with `jira` / `confluence`; alias for ergonomics. Implemented in `router.ts` as a single dispatch (both names go to the same handler).

## Risks / Trade-offs

- **Auth assumption** → Mitigation: smoke-check the sandbox in task 1, before any other implementation work. If the token doesn't work, we either pivot to app-password env vars or escalate back to design.
- **Two undocumented body shapes (task resolve, task↔comment link)** → Mitigation: tasks.md includes an explicit "discover via curl" task before implementing the relevant code. Document the discovered shapes inline with a citation comment.
- **Reply comments are "underdocumented"** → Mitigation: code comment citing the community thread, plus an integration test against the sandbox that creates a reply and reads it back.
- **Pipeline log polling could miss a brief log burst** → Acceptable. The log endpoint returns the full log; we re-fetch and slice to new bytes.
- **Git-remote auto-detection only matches `bitbucket.org` hostnames** → Self-hosted/proxy setups will need explicit `--workspace`/`--repo` or `af.json`. That's fine; we're not supporting Server/DC anyway.
- **Pagination helper hides the cursor** → Some callers may want the page-size or total. We can add `paginatePages<T>()` later if a caller needs it. Keep YAGNI for now.

## Migration Plan

No migration. New command, no breaking changes to existing surface.

Order of implementation:
1. Auth smoke test (manual curl against sandbox). Block everything else on it passing.
2. Discover the two unknown body shapes (task resolve, task↔comment link) via curl.
3. `atlassian/lib/request.ts` additions (`requestText`, `paginate`) + tests.
4. `bitbucket/lib/{types,client,config}.ts` (read-side first: PR list/get, comment list, task list, pipeline list/get).
5. `commands/bitbucket.ts` argv parsing + read-side handlers.
6. Write-side: PR create/update/merge/decline, comment add/update/delete, task add/update/delete, pipeline trigger/stop, member lookup.
7. Pipeline log streaming (`--follow`).
8. Help docs in `commands/help.ts`.
9. CLAUDE.md section under "Atlassian Configuration".

## Open Questions

These don't block design; they get answered during step 1–2 of implementation.

- **Q1**: ~~Does Atlassian API token work for Bitbucket Cloud Basic auth in this account?~~ **Resolved (no).** During discovery the call returned 401 with "Token is invalid, expired, or not supported for this endpoint." Pivoted to dedicated `BITBUCKET_USERNAME` + `BITBUCKET_API_TOKEN` env vars (see Decisions).
- **Q2**: What's the exact PUT body for resolving a task?
  - Hypothesis: `{state: "RESOLVED" | "UNRESOLVED"}` based on the python lib's state constants.
  - Resolution: create a task in the sandbox, PUT with hypothesized body, observe.
- **Q3**: How is a task linked to a specific comment in the create body?
  - Hypothesis: `{content: {raw}, comment: {id}}` based on Atlassian's resource-linking convention (mirroring `parent: {id}` for replies).
  - Resolution: create via UI, GET the resulting task, inspect the response shape, then mirror it on POST.
