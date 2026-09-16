## 1. Status-bearing HTTP errors

- [x] 1.1 In `atlassian/lib/request.ts`, add an exported `AtlassianHttpError extends Error` with a `status: number` field, and throw it from `request` and `requestText` on non-OK responses with the message unchanged
- [x] 1.2 Add tests in `atlassian/lib/request.test.ts` asserting the thrown error is an `AtlassianHttpError`, carries the HTTP status, and keeps the existing parsed message (Bitbucket envelope and fallback cases)
- [x] 1.3 Run the existing Jira/Confluence/Bitbucket test suites to confirm no regressions from the error type change

## 2. Explicit state parameters (fixes `pr list --state ALL`)

- [x] 2.1 Add a state helper in `bitbucket/lib/client.ts` that maps `undefined` → `['OPEN']`, a single state → `[state]`, and `'ALL'` → `['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED']`, and appends each as a repeated `state` parameter
- [x] 2.2 Update `listPullRequests` to use the helper (keeping `q` support) so every request carries explicit `state` parameters
- [x] 2.3 Add tests in `bitbucket/lib/client.test.ts`: `ALL` sends all four `state` params; `MERGED` sends one; default sends `OPEN`; `q` is still forwarded
- [x] 2.4 Share the valid-state set between `pr list` and `pr mine` in `commands/bitbucket.ts` and accept `SUPERSEDED` in help text

## 3. Client: workspaces and authored PRs

- [x] 3.1 Add `BitbucketWorkspaceAccess` (`administrator?`, `workspace: { slug, name?, uuid? }`) to `bitbucket/lib/types.ts`
- [x] 3.2 Add `listUserWorkspaces()` paginating `GET /user/workspaces`
- [x] 3.3 Add `listWorkspacePullRequestsForUser(workspace, user, { state, limit })` calling `GET /workspaces/{ws}/pullrequests/{user}` with repeated `state` params and `sort=-updated_on`, URL-encoding the curly-braced UUID, and stopping pagination once `limit` items are collected
- [x] 3.4 Generalize the `getCurrentUser` scope-error prefix so it reads correctly for commands other than `whoami` (keep the Account read scope hint)
- [x] 3.5 Add a local bounded-concurrency helper (4 workers) for per-workspace requests
- [x] 3.6 Add `listMyPullRequests({ workspace?, state, limit })`: resolve the account (uuid, fallback account_id); use `[workspace]` when given, else `listUserWorkspaces()`; fetch each workspace concurrently; record 403/404 `AtlassianHttpError`s in `skipped` and rethrow anything else; merge, sort by `updated_on` descending, truncate to `limit`; return `{ pullRequests, skipped }`
- [x] 3.7 Add client tests: workspaces discovered and all queried; explicit workspace skips `/user/workspaces`; results merged newest first; global `--limit` returns the true top-N across workspaces and stops pagination early; 403 and 404 are skipped and reported; 500 and 401 propagate; the removed `/2.0/pullrequests/{user}` URL is never requested

## 4. Formatter

- [x] 4.1 Add `formatMyPullRequestList(prs)` to `bitbucket/lib/formatters.ts` rendering `| Repo | ID | State | Title | Branches | Updated |` from `destination.repository.full_name` (fallback `—`), reusing `prLink`, `escapePipe`, `formatDate`; empty list renders `_No pull requests._`
- [x] 4.2 Add formatter tests in `bitbucket/lib/formatters.test.ts` covering the repo column, missing repository fallback, pipe escaping, and the empty state

## 5. Command wiring

- [x] 5.1 In `handlePr` (`commands/bitbucket.ts`), route `mine` before `ensureTarget()`: validate `--state` (default `OPEN`) and `checkLimit()` before any request, call `client.listMyPullRequests` with `options.workspace` (not the pre-resolved `ws`), print one warning per skipped workspace to stderr via `console.error` (not `warn()`, which writes to stdout and would corrupt `--json`), and output JSON or the formatted table; exit 0
- [x] 5.2 Add `pr mine [--state OPEN|MERGED|DECLINED|SUPERSEDED|ALL] [--workspace W] [--limit N]` to `showHelp()`, noting that it searches all workspaces and suggesting `--limit` with `--state ALL`
- [x] 5.3 Add command tests in `commands/bitbucket.test.ts`: works with no resolvable repo; `af.json` workspace does not narrow; `--workspace` narrows; invalid `--state` and `--limit 0` exit 1 without requests; skipped-workspace warning goes to stderr with exit 0; `--json` stdout is a single parseable array with no warning text; unexpected errors exit 1

## 6. Documentation

- [x] 6.1 Add a `pr mine` example to the bitbucket entry in `commands/help.ts`
- [x] 6.2 Document `af bb pr mine` in the Bitbucket section of `CLAUDE.md` (all-workspaces scope, `--workspace` narrowing, skip-on-403/404, bot-identity caveat for access tokens) and update the `pr list --state` line to include `SUPERSEDED`
- [x] 6.3 Add any new words to `.cspell.json` if spell check flags them

## 7. Verification

- [x] 7.1 Run `bun run test` (not `bun test`) and fix failures
- [x] 7.2 Run `bun run lint`, `bun run format:check`, and `bun run spell:check`
- [x] 7.3 Run `openspec validate add-bb-pr-mine --strict`
- [ ] 7.4 Live smoke test with real Bitbucket credentials: `af bb whoami`, `af bb pr mine`, `af bb pr mine --state ALL --limit 5`, `af bb pr mine --json | jq length`, and `af bb pr list --state ALL --workspace W --repo R` shows merged PRs; confirm whether the workspace endpoint honours `sort=-updated_on` and, if not, drain all pages before truncating when `--limit` is set (design Risks)
