# Add `af bb pr mine`: list my authored pull requests across all workspaces

## Why

There is no way to see "all of my open PRs" in one place. `af bb pr list --mine` is bound to a single resolved repository, fails outside a Bitbucket checkout, and downloads every PR in the repo before filtering client-side. Bitbucket removed the cross-workspace `GET /2.0/pullrequests/{selected_user}` endpoint on 2025-02-20; its replacement, `GET /2.0/workspaces/{workspace}/pullrequests/{selected_user}`, returns a user's authored PRs across every repository in a workspace, which makes a repo-independent view cheap (one call per workspace).

While investigating, `pr list --state ALL` was found to omit the `state` query parameter entirely. Bitbucket defaults to `OPEN` when `state` is absent, so `--state ALL` most likely returns only open PRs, contradicting the existing spec.

## What Changes

- New subcommand `af bb pr mine [--state OPEN|MERGED|DECLINED|SUPERSEDED|ALL] [--workspace W] [--limit N] [--json]`:
    - Lists pull requests **authored** by the authenticated account.
    - Searches **every workspace** the caller belongs to (`GET /user/workspaces`). Only an explicit `--workspace` narrows the search; `af.json` and the git origin remote are deliberately ignored, and no repository is required.
    - Merges results across workspaces, newest-updated first, and renders a table with a **Repo** column so ids are unambiguous.
    - A workspace that returns 403/404 is skipped with a warning on stderr naming it; the remaining results are still shown and the exit code stays `0`.
    - `--limit N` caps the merged result set and stops pagination early; by default all pages are drained.
    - Read-only (GET only); `--json` emits a flat array of the raw PR objects.
- Fix `pr list --state ALL` so it requests every state explicitly (repeated `state=` parameters). The same state-parameter builder is shared by `pr list` and `pr mine`.
- Help text (`af bb --help`, `af help bitbucket`) and the Bitbucket section of `CLAUDE.md` document the new subcommand.

## Capabilities

### New Capabilities

<!-- None: the new subcommand belongs to the existing bitbucket-command capability. -->

### Modified Capabilities

- `bitbucket-command`: adds a requirement for listing the authenticated user's authored pull requests across workspaces (`pr mine`); tightens the existing "Pull request listing" requirement so `--state ALL` explicitly requests every state.

## Impact

- **Code**: `bitbucket/lib/client.ts` (state-param builder, `listUserWorkspaces`, `listWorkspacePullRequestsForUser`, cross-workspace aggregation), `bitbucket/lib/types.ts` (workspace access type), `bitbucket/lib/formatters.ts` (repo-qualified PR table), `commands/bitbucket.ts` (`pr mine` routing before repo resolution, help), `commands/help.ts`, `CLAUDE.md`.
- **APIs**: `GET /2.0/user`, `GET /2.0/user/workspaces`, `GET /2.0/workspaces/{workspace}/pullrequests/{selected_user}`. The removed `GET /2.0/pullrequests/{selected_user}` is not used.
- **Auth**: requires the token's Account read scope (already needed by `whoami`) plus pull-request read. If the token is a workspace/repository access token (a bot identity), "mine" resolves to the bot account.
- **Behaviour change**: `pr list --state ALL` now returns merged/declined/superseded PRs as the spec always stated; scripts that relied on it returning only open PRs will see more results.
- **Tests**: unit tests in `bitbucket/lib/client.test.ts`, `bitbucket/lib/formatters.test.ts`, `commands/bitbucket.test.ts`.
