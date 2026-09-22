# Show review state and merge signals in `af bb pr mine` and `af bb pr list`

## Why

`af bb pr mine` answers "which PRs do I have open?" but not "which of them need me?". Neither it nor `pr list` shows whether a PR has approvals, has changes requested, or is held up by builds, conflicts, or open tasks. That information exists today only one PR at a time, through `pr get`, `pr reviewers`, and `pr status`.

The gap is in the data as well as the display. Bitbucket Cloud's pull-request list endpoints deliberately omit `participants` and `reviewers`, so the list formatters have nothing to render. Bitbucket documents a partial-response parameter, `fields=+values.participants,+values.reviewers` (with each `+` sent URL-encoded), that adds them back to the same list call. So review state costs no extra requests.

Bitbucket Cloud has no public API that reports whether a PR meets its merge checks:

- BCLOUD-22014 is still "Gathering Interest".
- The branch-restriction rules can only be read with repository admin, and rules set at project level are not exposed at all.

This change therefore shows the **public signals** that merge checks are built from and does not claim a pass/fail verdict.

## What Changes

- **Review state is always shown, at no extra request cost.**
    - `pr mine` and `pr list` request `participants` and `reviewers` on their existing list calls, using the `fields` partial-response parameter.
    - Both tables gain a **Review** column showing:
        - approvals (`✓`), excluding the author's own approval;
        - changes requested (`✗`);
        - reviewers who have not yet responded (`○`).
    - Both tables gain a **Tasks** column showing the open-task count from `task_count`, which the list response already returns.
- **Merge signals are opt-in with `--checks`** on `pr mine` and `pr list`.
    - For each listed **open** PR, the command also fetches:
        - its build statuses (`GET …/pullrequests/{id}/statuses`), summarized for the PR's head commit only;
        - its conflicts (`GET …/pullrequests/{id}/conflicts`).
    - They are shown as **Builds** and **Conflicts** columns.
    - Merged, declined and superseded rows show `—` and cost no requests.
    - These requests are made only when `--checks` is given, with bounded concurrency.
- **`--checks` only adds information; it never changes the outcome.**
    - The exit code is unaffected by any signal.
    - A signal that cannot be fetched renders as `?` with a warning on stderr, and the command still exits `0`.
- **`--json` output stays raw.**
    - Raw PR objects now also carry `participants` and `reviewers`.
    - Computed signals are not injected into JSON output. `--checks` combined with `--json` makes no extra requests and prints a notice on stderr.
- Help text (`af bb --help`, `af help bitbucket`) and the Bitbucket section of `CLAUDE.md` document the columns and `--checks`.

Explicitly **not** part of this change:

- No new subcommand.
- No merge verdict and no "blocked" state.
- No non-zero exit based on PR state.
- No use of Bitbucket's undocumented internal merge-restrictions endpoint.
- No reading of branch restrictions.

## Capabilities

### New Capabilities

<!-- None: the behaviour extends the existing bitbucket-command capability. -->

### Modified Capabilities

- `bitbucket-command`: adds requirements for review state in the `pr list` / `pr mine` tables and for opt-in, non-fatal merge signals via `--checks`. Existing listing requirements remain valid as written: JSON stays an array of raw PR objects, and the added columns sit alongside the existing ones.

## Impact

- **Code:**
    - `bitbucket/lib/request.ts`: an optional `mapNext` hook on `bbPaginate`, so `fields` is re-applied to every `next` URL.
    - `bitbucket/lib/client.ts`: the `fields` parameter on `listPullRequests` and `listWorkspacePullRequestsForUser`; a per-PR merge-signal fetcher (open PRs only, statuses and conflicts, bounded concurrency, errors captured per signal).
    - `bitbucket/lib/signals.ts` (new): pure summarizers for the review, builds and conflicts cells, and grouping of failures into warnings.
    - `bitbucket/lib/types.ts`: `task_count`, `links.self`, a conflict-entry type, and the signal result types.
    - `bitbucket/lib/formatters.ts`: the Review, Tasks, Builds and Conflicts cells in `formatPullRequestList` and `formatMyPullRequestList`.
    - `commands/bitbucket.ts`: the `--checks` flag, applying it after the `--mine` filter, stderr warnings, and help text.
    - `commands/help.ts`, `CLAUDE.md`.
- **APIs:**
    - Existing list endpoints now carry `fields=+values.participants,+values.reviewers`, URL-encoded.
    - With `--checks` only: `GET /2.0/repositories/{ws}/{repo}/pullrequests/{id}/statuses` and `GET /2.0/repositories/{ws}/{repo}/pullrequests/{id}/conflicts`, which redirects to `…/file-conflicts/…`. Every request is a GET.
- **Auth:** no new scopes. Everything above needs pull-request read, which `pr mine` / `pr list` already require.
- **Rate limits:** the default output adds no requests. `--checks` adds about three requests per listed open PR (statuses, plus conflicts and its redirect), and more when a PR has many build statuses. That counts against the 1,000 requests per hour a personal token gets.
- **Behaviour change:** the table output of `pr list` and `pr mine` gains columns, and `--json` objects gain the `participants` and `reviewers` keys. Both changes are additive.
- **Tests:**
    - `bitbucket/lib/client.test.ts`
    - `bitbucket/lib/formatters.test.ts`
    - new `bitbucket/lib/signals.test.ts`
    - new `bitbucket/lib/request.test.ts`
    - `commands/bitbucket.test.ts`, whose client mock factory must include the new client function, and which also needs a `request.ts` mock for `pr list --mine`.
