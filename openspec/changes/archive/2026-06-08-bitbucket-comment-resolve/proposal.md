# Resolve and reopen Bitbucket pull request comment threads

## Why

Bitbucket Cloud lets reviewers mark PR comment threads as **resolved** to track which review conversations are settled, but `af bb` has no way to see or change that state. Today `af bb pr comment list/get` silently drops the resolution status, and there is no verb to resolve or reopen a thread — so anyone driving a review from the CLI still has to open the browser to close the loop on feedback. This is the one gap between CLI-driven and UI-driven review for comments (tasks already support `--resolved`/`--unresolved`).

## What Changes

- **Read** — surface comment-thread resolution state in `af bb pr comment list` and `af bb pr comment get` (e.g. a resolved/open marker per thread), including who resolved it and when, when the API provides it.
- **Set** — add two verbs to toggle resolution on a comment thread:
    - `af bb pr comment resolve <pr-id> <comment-id>`
    - `af bb pr comment reopen <pr-id> <comment-id>`
- Extend the Bitbucket API client with `resolveComment` / `reopenComment` calls and add a `resolution` field to the comment type.
- Both verbs support `--json` for raw API output, consistent with every other `af bb` subcommand.
- No breaking changes — purely additive to existing comment read/write surface.

## Capabilities

### New Capabilities

<!-- None — this extends the existing bitbucket-command capability. -->

### Modified Capabilities

- `bitbucket-command`: add requirements for (1) displaying pull request comment resolution state in list/get output, and (2) resolving and reopening a comment thread by id.

## Impact

- **Code**
    - `bitbucket/lib/types.ts` — add a `resolution` shape to `BitbucketComment`.
    - `bitbucket/lib/client.ts` — add `resolveComment` / `reopenComment` client functions.
    - `commands/bitbucket.ts` — route the new `comment resolve` / `comment reopen` subcommands; update help text.
    - `bitbucket/lib/formatters.ts` — render resolution state in `formatCommentList` / comment rendering.
- **API** — depends on Bitbucket Cloud's comment-resolution endpoints and `resolution` field. The exact request/response shape MUST be verified against the live API before implementation, consistent with the existing "verified against the live API" convention documented in `client.ts`. Design will capture the verification recipe.
- **Auth / config** — none; reuses the existing `BITBUCKET_*` credentials and workspace/repo resolution.
- **Docs** — update the `af bb` command reference in `CLAUDE.md`.
