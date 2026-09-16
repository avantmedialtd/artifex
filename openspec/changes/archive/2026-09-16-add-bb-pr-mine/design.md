## Context

`af bb pr list --mine` (`commands/bitbucket.ts`) resolves a workspace **and** repository up front, pulls every PR in that repo via `GET /repositories/{ws}/{repo}/pullrequests`, then filters by `author.account_id` client-side. There is no repo-independent view of "my PRs".

Bitbucket Cloud's API landscape (verified against `https://api.bitbucket.org/swagger.json`):

| Endpoint | Returns | Notes |
|---|---|---|
| `GET /2.0/pullrequests/{selected_user}` | authored PRs, all workspaces | **Removed 2025-02-20** — must not be used |
| `GET /2.0/workspaces/{workspace}/pullrequests/{selected_user}` | authored PRs, every repo in one workspace | `state` repeatable (`OPEN`/`MERGED`/`DECLINED`/`SUPERSEDED`); defaults to `OPEN` when absent; supports filtering/sorting; `selected_user` = username, `{uuid}`, or Atlassian account id; scope `pullrequest` |
| `GET /2.0/user/workspaces` | `workspace_access` objects (`values[].workspace.slug`, `administrator`) | paginated; scope `account` |

Constraints found in the code:

- `buildQuery(params: Record<string, …>)` in `bitbucket/lib/client.ts` cannot repeat a key. `listPullRequests` sends no `state` for `ALL`, so the API falls back to `OPEN` — the `--state ALL` bug.
- `handleBitbucket` resolves the target before dispatch, but errors are deferred via `ensureTarget()`; `handlePr` calls `ensureTarget()` only after routing `comment`/`task`, so `pr mine` can route before it and never need a repo.
- Errors from `atlassian/lib/request.ts` are plain `Error`s whose message is the parsed Bitbucket envelope (`error.message`), which frequently omits the HTTP status. `getCurrentUser` already works around this with message sniffing.
- There is no bounded-concurrency helper in `bitbucket/` or `atlassian/`.
- `checkLimit()` already validates `--limit`; `listCommits` shows the established "stop paginating once `limit` reached" pattern.

## Goals / Non-Goals

**Goals:**

- `af bb pr mine` lists the authenticated account's authored PRs across all its workspaces, from any directory.
- `--state`, `--workspace`, `--limit`, `--json` behave consistently with the rest of `af bb`.
- A single inaccessible workspace never hides results from the others.
- `pr list --state ALL` actually returns all states.

**Non-Goals:**

- PRs where the user is a **reviewer** or participant (no workspace-level endpoint; would require a per-repo fan-out). The command name and flags leave room for a future `--reviewing`.
- Listing another user's PRs across workspaces (`--author` on `pr mine`). Easy to add later since `selected_user` accepts any account, but not requested.
- Changing `pr list --mine` to use server-side filtering, or widening it beyond one repo.
- Honouring `af.json` / git-remote workspace for `pr mine`.

## Decisions

### D1. New `pr mine` subcommand rather than a flag on `pr list`

`pr list` is defined by repository resolution; bolting a workspace-wide mode onto it forks its semantics (and `--workspace-wide` is meaningless without `--mine`/`--author`). Auto-widening `pr list --mine` when no repo resolves was rejected because the result scope would silently depend on the current directory. A dedicated verb needs no repo, is discoverable in help, and is the natural home for a later review inbox.

### D2. Always search all workspaces; only `--workspace` narrows

"All of my PRs" means across workspaces. `af.json`/remote are repo-context signals and would make the result depend on the cwd (see D1). Implementation: when `options.workspace` is set, use `[options.workspace]` and skip `GET /user/workspaces`; otherwise paginate `GET /user/workspaces` and collect `workspace.slug`. `handlePr` reads `options.workspace` directly for `mine` — it does not use the pre-resolved `ws`.

### D3. Identify the user by UUID from `GET /user`

Reuse `client.getCurrentUser()` (it already rewrites scope errors into an actionable hint; generalize its "whoami failed" prefix to a neutral "Could not resolve the authenticated Bitbucket account"). Pass `account.uuid` (curly-braced, URL-encoded) as `selected_user`; fall back to `account_id` if `uuid` is absent. Usernames are avoided because they are no longer guaranteed to be set.

### D4. Explicit, repeated `state` parameters via a shared helper

Add a helper that maps a CLI state to a list of API states:

```
'ALL'      → ['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED']
'MERGED'   → ['MERGED']       (etc.)
undefined  → ['OPEN']
```

and appends each as `state=` on a `URLSearchParams` (the `listCommits` include/exclude pattern). Both `listPullRequests` and the new workspace call use it, fixing `--state ALL` for `pr list`. State validation stays in the command handler (existing `validStates` set, now shared by `list` and `mine`); invalid states fail before any request.

Alternative considered: teach `buildQuery` to accept `string[]` values. Viable, but it widens a helper used by many call sites for one parameter; a focused state helper is clearer and easier to test.

### D5. Client functions

In `bitbucket/lib/client.ts`:

- `listUserWorkspaces(): Promise<BitbucketWorkspaceAccess[]>` — paginates `/user/workspaces`.
- `listWorkspacePullRequestsForUser(workspace, user, { state, limit }): Promise<BitbucketPullRequest[]>` — `GET /workspaces/{ws}/pullrequests/{user}?state=…&sort=-updated_on`, paginated, stops once `limit` items are collected (no cap when `limit` is undefined).
- `listMyPullRequests({ workspace?, state, limit }): Promise<{ pullRequests; skipped: { workspace; status; message }[] }>` — orchestrates D2/D3/D6/D7 and returns the merged, sorted, truncated list plus skipped workspaces. Keeping orchestration in the client (not the handler) makes it unit-testable with a mocked `fetch`/`paginate`, and keeps the handler to validation + output.

`BitbucketWorkspaceAccess` (`{ administrator?: boolean; workspace: { slug: string; name?: string; uuid?: string } }`) is added to `bitbucket/lib/types.ts`.

### D6. Bounded concurrency across workspaces; correct global limit

Workspaces are fetched with a small worker pool (4 concurrent), implemented as a local helper in the client — typical accounts have a handful of workspaces, so a dependency is unwarranted, and 4 stays well inside Atlassian's rate guidance.

With `--limit N`, each workspace fetch stops after N items (requested with `sort=-updated_on`), then all results are merged, sorted by `updated_on` descending, and truncated to N. This is exact: the global top-N is always contained in the union of each workspace's top-N. Without `--limit`, every page is drained (open PR sets are naturally small; help text points at `--limit` for `--state ALL` history). Client-side re-sorting is always applied, so ordering never depends on the server; the exact-top-N guarantee under `--limit` does rely on the server honouring `sort` (see Risks).

### D7. Skip 403/404 workspaces; fail on anything else

`/user/workspaces` can list workspaces the token cannot read (e.g. an API token restricted to some workspaces). A 403/404 on a per-workspace PR request is recorded in `skipped` and the handler prints a `warn()` to stderr per skipped workspace (`Skipped workspace "W2": HTTP 403 …`); exit code stays `0`. Any other failure (401, 5xx, network, a failure of `/user` or `/user/workspaces` themselves) propagates and exits `1`.

To detect the status reliably, `atlassian/lib/request.ts` will throw an error that carries the HTTP status (e.g. `class AtlassianHttpError extends Error { status: number }`) with the **message unchanged**, so every existing caller and test keeps working. Message sniffing (the `getCurrentUser` approach) was rejected as too fragile for a control-flow decision, since Bitbucket's envelope message usually omits the status code.

### D8. Output

- Human: a new `formatMyPullRequestList(prs)` renders `| Repo | ID | State | Title | Branches | Updated |` using `destination.repository.full_name` (fallback `—`) and the existing `prLink`/`escapePipe`/`formatDate` helpers. The Author column is dropped (always the caller). Empty list → the existing `_No pull requests._`.
- JSON: the merged, sorted, truncated array of raw PR objects (same shape as `pr list --json`). Warnings never go to stdout.

### D9. Routing and help

In `handlePr`, route `action === 'mine'` before `ensureTarget()` (alongside `comment`/`task`). Validate `--state` and `checkLimit()` first. Add `pr mine` to `showHelp()` in `commands/bitbucket.ts`, an example to `commands/help.ts`, and a line to the Bitbucket section of `CLAUDE.md`.

## Risks / Trade-offs

- **[Bot identity]** A workspace/repository access token authenticates as a bot, so "mine" becomes the bot's PRs, and `/user/workspaces` may return only that workspace. → Document in help/CLAUDE.md; `whoami` shows which account is in use.
- **[Many workspaces / large history]** `--state ALL` without `--limit` can page through thousands of PRs. → Bounded concurrency, early pagination stop with `--limit`, help text recommends `--limit` for history.
- **[Shared error type change]** Touching `atlassian/lib/request.ts` affects Jira/Confluence. → Subclass `Error`, keep the message identical, add a unit test asserting both message and `status`.
- **[`pr list --state ALL` behaviour change]** Scripts that implicitly got only open PRs will now see all states. → This matches the documented spec; call it out in release notes.
- **[Endpoint `sort` support]** `sort=-updated_on` on the workspace endpoint is documented generically ("supports filtering and sorting") rather than per-field. → Client-side sort is authoritative; if the server ignores `sort`, `--limit` results could miss newer PRs beyond the first N fetched per workspace. Verify with a live smoke test (task) and, if unsupported, drain all pages before truncating.
- **[Rate limiting]** Bitbucket applies hourly per-user limits. → 4-way concurrency and early stop keep request counts low; 429s surface as normal errors (exit 1).

## Migration Plan

No data migration. Additive subcommand plus a bug fix; ships in the next minor release with a release-note line about `pr list --state ALL`. Rollback is a revert.

## Open Questions

- Does the workspace endpoint honour `sort=-updated_on`? Resolve during the live smoke test (see Risks); the fallback is defined.
