# Add Bitbucket Cloud Support

## Why

Artifex covers Jira and Confluence but stops short of the third leg of our Atlassian-shaped workflow: Bitbucket. Today, the only step a coding agent (or developer) can't drive from `af` is the part between "code committed" and "ticket closed" — opening a PR, leaving review comments, managing tasks, and watching pipelines. Adding Bitbucket Cloud closes that loop and makes the existing `start-work` / `commit-work` / `complete-work` skills genuinely end-to-end.

## What Changes

- Add a new `af bitbucket` command (with `af bb` alias) that targets Bitbucket Cloud's `api.bitbucket.org/2.0/` API.
- Add new `BITBUCKET_USERNAME` and `BITBUCKET_API_TOKEN` env vars. Bitbucket Cloud rejects Atlassian-scoped API tokens (verified during discovery), so a separate workspace API token or app password is required. `BITBUCKET_USERNAME` falls back to `ATLASSIAN_EMAIL` / `JIRA_EMAIL` since email is commonly accepted as the username for app passwords. `BITBUCKET_APP_PASSWORD` is supported as a legacy alias for `BITBUCKET_API_TOKEN`.
- Add a `requestText()` sibling helper in `atlassian/lib/request.ts` for endpoints that return `text/plain` (pipeline logs, PR diffs).
- Add a pagination helper for Bitbucket's `{values, next}` pattern.
- Workspace/repo resolution layered as: `--workspace`/`--repo` flags → `af.json` (`bitbucket.workspace`, `bitbucket.repo`) → parsed from `git remote get-url origin` if it points at bitbucket.org → error.
- PR subcommands: `list`, `get`, `create`, `update`, `approve`, `unapprove`, `request-changes`, `merge`, `decline`, `diff`.
- PR comment subcommands (`af bitbucket pr comment …`): `list`, `get`, `add`, `update`, `delete`. The `add` form supports general, inline (`--file`/`--line`), and reply (`--reply-to`) shapes.
- PR task subcommands (`af bitbucket pr task …`): `list`, `add`, `update`, `delete`, with resolve/unresolve via `--resolved`/`--unresolved`. Supports both standalone tasks and tasks attached to a comment (`--on-comment`).
- Pipeline subcommands: `list`, `get`, `trigger`, `stop`, `steps`, `logs` (one-shot and `--follow` streaming).
- Reviewer arguments accept account IDs only, with a helper `af bitbucket members` subcommand to look up account IDs by query when needed.
- All subcommands support `--json` for machine-readable output, matching the `af jira` pattern.

## Capabilities

### New Capabilities
- `bitbucket-command`: The `af bitbucket` (alias `af bb`) command surface — pull request CRUD, PR review comments CRUD with general/inline/reply variants, PR task CRUD with resolve/unresolve, and pipeline list/get/trigger/stop/steps/logs operations, plus workspace/repo resolution and `--json` output mode.

### Modified Capabilities
- `atlassian-shared-config`: Adds a `requestText()` helper alongside `request<T>()` for endpoints that return non-JSON content types (pipeline logs, PR diffs), and adds a paginator helper that walks Bitbucket Cloud's `{values, next}` cursor pattern.

## Impact

- New code: `bitbucket/lib/{client,formatters,types,config}.ts`, `commands/bitbucket.ts`, plus tests.
- Modified code: `atlassian/lib/request.ts` (add `requestText` and a `paginate` helper), `router.ts` (route `bitbucket` and `bb`), `commands/help.ts` (document the new command).
- Configuration: `af.json` gains an optional `bitbucket` section with `workspace` and `repo` keys.
- Credentials: new `BITBUCKET_USERNAME` and `BITBUCKET_API_TOKEN` env vars (with `BITBUCKET_APP_PASSWORD` as legacy alias). The Atlassian API token used for Jira/Confluence does not authenticate against Bitbucket Cloud; this was confirmed via `GET /2.0/user` returning 401 during the discovery phase. Users create a workspace API token in Bitbucket settings; the helper error message links to the right page when credentials are missing.
- No breaking changes to existing commands.
