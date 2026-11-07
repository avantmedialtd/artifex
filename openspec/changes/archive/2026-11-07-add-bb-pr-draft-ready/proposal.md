# Mark Bitbucket pull requests ready for review, or back to draft

## Why

`af bb pr create --draft` opens a draft pull request, but nothing else in af can change one. `pr update` rejects `--draft`, nothing marks a draft ready, and `pr list` / `pr mine` show drafts as plain `OPEN`. The usual draft workflow has three steps: open the PR as a draft with reviewers attached, keep working on it, then mark it ready so the reviewers are emailed. The last step currently has to be done in the Bitbucket UI.

Bitbucket Cloud has no ready or draft endpoint. `draft` is a field on the pull request, and it is changed through the pull request PUT. That PUT is also where `pr update` rests on an unverified assumption:

- Community reports say Bitbucket rejects a PUT that has no `title`, and clears any reviewers a PUT does not send.
- Today's `pr update` sends only the fields that change, and the spec says the rest are preserved.
- Nothing has checked this. The original Bitbucket change verified the task PUT bodies in the sandbox repository, but not the pull request PUT, and `updatePullRequest` has no client test.

Marking a draft ready is the worst place for this to be wrong. If the reviewers are dropped, the PR becomes ready, nobody is notified, and nothing reports an error.

## What Changes

- **Verify first.** Before any code changes, a spike against the `avantmedialtd/sandbox` repository records how Bitbucket actually treats the pull request PUT:
    - a PUT without `title`;
    - a PUT without `reviewers`, and without `description`;
    - `draft: false` on a draft, and `draft: true` on an open PR;
    - whether draft PRs appear in list results, with the `draft` field and the `q` filter.

    The spike's results decide which unchanged fields a PUT must resend.
- **Draft state on `pr update`.**
    - `af bb pr update <id> --ready` marks a draft ready for review.
    - `af bb pr update <id> --draft` moves an open PR back to draft.
    - The two flags cannot be combined, and they can be used together with `--title`, `--description` / `--description-file` and `--reviewers`, all in one request.
    - `draft` is sent only when it changes the PR's draft state. Asking for the state the PR is already in prints a notice, sends no PUT and exits `0`.
- **Aliases.** `af bb pr ready <id>` and `af bb pr draft <id>` do the same as `pr update <id> --ready` and `--draft`. They accept only the PR id and the global options (`--json`, `--workspace`, `--repo`), so an option such as `--title` is an error rather than being silently ignored.
- **`pr update` reads before it writes, for every flag.**
    - It fetches the pull request first.
    - A PR that is not `OPEN` is reported as an error, and no PUT is sent.
    - Title, description and reviewers that the user did not change are preserved. The PUT carries their current values whenever the spike shows Bitbucket would otherwise reject the request or clear them.
    - `pr update <id>` with no change flag is an error, and sends no request.
- **Drafts are visible in lists.** The State cell of `pr list` and `pr mine` reads `OPEN (draft)` for a draft, the same wording `pr get` already uses.
- **Draft filter.**
    - `--draft` and `--ready` on `pr list` and `pr mine` keep only drafts, or only PRs that are not drafts. The two flags cannot be combined.
    - The filter is sent to Bitbucket as `q` (`draft = true` / `draft = false`), so `--limit`, `--mine`, `--checks` and `--json` all see the filtered set.
    - `q` is set again on every `next` page URL, as `fields` already is.
- **Merge hint.** When `pr merge` fails and the PR turns out to be a draft, the error says so and names `af bb pr ready <id>`. The extra GET is made only after a failed merge.
- Help text (`af bb --help`, `af help bitbucket`) and the Bitbucket section of `CLAUDE.md` document the new flags, the aliases, and how drafts behave: reviewers on a draft are not notified until it is marked ready, and a draft cannot be merged.

Explicitly **not** part of this change:

- Bitbucket's mergeability-checks API (`GET …/pullrequests/{id}/mergeability/checks`). It now appears in Atlassian's OpenAPI spec, so the `CLAUDE.md` note that there is no public merge-check API is out of date. Using it, and fixing that note, is a separate follow-up.
- Hiding drafts from the default `pr list` output, as Bitbucket's UI does. af keeps listing them, marked.
- `--state DRAFT`. A draft is an `OPEN` pull request with a flag, not a Bitbucket state.
- Adding or removing single reviewers. `--reviewers` still replaces the whole list.

## Capabilities

### New Capabilities

<!-- None: the behaviour extends the existing bitbucket-command capability. -->

### Modified Capabilities

- `bitbucket-command`:
    - **Pull request update** gains `--ready` / `--draft`, reads before it writes, preserves the fields the user did not change, and rejects a PR that is not open or a call with no change flag.
    - New requirements cover:
        - the draft lifecycle (`pr ready` and `pr draft`);
        - draft state in the `pr list` / `pr mine` tables, and the `--draft` / `--ready` filter;
        - merging a draft.
    - **Strict option checking** now also covers `pr ready` and `pr draft`. Its example of a rejected option, `pr update 42 --draft`, becomes valid and is replaced.

## Impact

- **Code:**
    - `commands/bitbucket.ts`:
        - the `--ready` flag; strict rules for `pr update`, `pr ready` and `pr draft`;
        - the routing of `pr ready` / `pr draft`;
        - the read-before-write update flow, with its no-op, not-open and no-change-flag checks;
        - the `--draft` / `--ready` list filters, built into `q`;
        - the merge hint;
        - the help text.
    - `bitbucket/lib/update.ts` (new):
        - a pure function that builds the update body from the fetched PR and the requested changes, or reports a no-op;
        - a code comment recording the PUT shapes the spike verified.

        It is kept out of `client.ts`, which the command tests mock wholesale.
    - `bitbucket/lib/filters.ts`: a pure helper that builds the `q` clause from `--author` and `--draft` / `--ready`.
    - `bitbucket/lib/client.ts`:
        - `updatePullRequest` sends the body it is given, with `draft` support;
        - `q` support in `listWorkspacePullRequestsForUser`;
        - `q` re-applied to `next` page URLs alongside `fields`.
    - `bitbucket/lib/types.ts`: `draft` on `BitbucketUpdatePullRequestRequest`.
    - `bitbucket/lib/formatters.ts`: one State-cell helper, shared by `pr get`, `pr list` and `pr mine`.
    - `CLAUDE.md`.
- **APIs:**
    - `GET /2.0/repositories/{ws}/{repo}/pullrequests/{id}` before every pull request PUT, and after a failed merge.
    - `q=draft = true|false` on `GET …/pullrequests` and `GET /2.0/workspaces/{ws}/pullrequests/{account}`.
    - No new endpoints.
- **Auth:** no new scopes. The GET needs pull-request read, which `pr update` already implies.
- **Rate limits:**
    - one extra GET per `pr update`, `pr ready` and `pr draft`;
    - one extra GET per failed `pr merge`;
    - the list filters add no requests.
- **Behaviour change:**
    - `pr update` makes a GET before its PUT, and fails before writing anything when the PR is not open.
    - `pr update <id>` with no change flag, which used to send an empty PUT, is now an error.
    - Drafts show `OPEN (draft)` in list tables.
    - `--draft` on `pr list` / `pr mine` used to be accepted and ignored; it now filters.
    - `--json` output stays the raw API objects.
- **Tests:**
    - New `bitbucket/lib/update.test.ts` for the update-body builder.
    - `bitbucket/lib/filters.test.ts` for the `q` clause.
    - `bitbucket/lib/client.test.ts` gets its first `updatePullRequest` tests, plus tests for `q` on the workspace list and on `next` pages.
    - `bitbucket/lib/formatters.test.ts`.
    - `commands/bitbucket.test.ts`:
        - its client mock factory must include any new client function;
        - the tests that assert `pr update --draft` is rejected (around lines 872 and 1568) now expect it to be accepted.
- **Spike prerequisite:** Bitbucket credentials with write access to `avantmedialtd/sandbox`, the repository the original Bitbucket change used for its verification. The spike creates and declines a throwaway pull request there.
