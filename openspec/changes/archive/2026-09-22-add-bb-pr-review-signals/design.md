## Context

`af bb pr mine` and `af bb pr list` render PR tables through `formatMyPullRequestList` / `formatPullRequestList` in `bitbucket/lib/formatters.ts`. Neither shows review or merge state. Per-PR views already exist:

- `pr get` renders a Reviewers row, limited to `REVIEWER`-role participants.
- `pr reviewers` renders every participant's approval state.
- `pr status` renders build statuses grouped by commit.

All three read data that is only present on the single-PR resource.

Facts about Bitbucket Cloud that shape this design. They come from the published REST spec, Atlassian staff answers, and anonymous calls against a public repo during exploration.

| Fact | Consequence |
|---|---|
| PR **list** endpoints omit `participants` and `reviewers` "as it would impact performance too much". `fields=+values.participants,+values.reviewers` (URL-encoded) adds them back, and this was confirmed on both `/repositories/{ws}/{repo}/pullrequests` and `/workspaces/{ws}/pullrequests/{user}`. | Review state costs no extra requests. |
| An unencoded `+` in `fields` is decoded as a space and silently matches nothing. | The parameter must go through `URLSearchParams` (which encodes `+` as `%2B`), not be concatenated by hand. |
| Default list values already include `task_count` ("number of open tasks"), `links`, `source.commit`, and `destination.repository`. | Tasks column is free; per-PR URLs can be derived without extra lookups. |
| There is no public merge-check or mergeability endpoint (BCLOUD-22014 still "Gathering Interest"; BCLOUD-20734 was closed "Won't Fix"). `branch-restrictions` needs repository admin, and project-level rules are not exposed (BCLOUD-22732). | No honest pass/fail verdict is possible from public APIs. Show signals only. |
| `GET …/pullrequests/{id}/statuses` returns build statuses (`SUCCESSFUL`/`FAILED`/`INPROGRESS`/`STOPPED`), possibly for several commits. Bitbucket's builds check looks only at the **source head commit**, where any `FAILED` status blocks. | Summarize only head-commit statuses. |
| `diffstat` `merge conflict` detection died with the `merge=true` removal (2026-09-04). The replacement is the public `GET …/pullrequests/{id}/conflicts`, which 302-redirects to `…/file-conflicts/{spec}?from_pullrequest_id=N` and returns paginated `{path, scenario, message}`. Its redirect target originally rejected API tokens; Atlassian reported a fix on 2026-08-28. | Conflicts are fetchable per PR, but must degrade gracefully. |
| Personal API tokens get 1,000 requests/hour. | Per-PR fan-out must be opt-in. |

Code constraints:

- `bbPaginate` (`bitbucket/lib/request.ts`) follows the server's `next` URL verbatim.
- `mapWithConcurrency` (4 workers) already exists, private, in `client.ts`.
- `pr list --mine` filters client-side after fetching.
- `commands/bitbucket.test.ts` mocks the client module with an explicit function list.
- Stderr warnings use `console.error`, because `warn()` writes to stdout and would corrupt `--json`.

## Goals / Non-Goals

**Goals:**

- `pr mine` and `pr list` show, per PR:
    - approvals;
    - changes requested;
    - reviewers who have not yet responded;
    - open tasks.

    None of this costs any extra request.
- `--checks` adds each open PR's head-commit build state and conflicts. It is opt-in and bounded, and closed PRs are not fetched.
- Nothing about a PR's state ever changes the exit code. Signal fetch failures degrade to `?` with a stderr warning.
- `--json` stays an array of raw PR objects.

**Non-Goals:**

- A merge verdict ("mergeable" / "blocked"). This includes:
    - reading branch restrictions;
    - the undocumented `internal/…/merge-restrictions` endpoint;
    - Forge custom merge-check results.
- A new subcommand. No new per-PR command is added, and `pr get` / `pr reviewers` / `pr status` are left unchanged. Two known quirks stay as they are and could be revisited separately:
    - `pr get` shows only `REVIEWER`-role approvals;
    - `pr reviewers --pending` also lists participants who only commented, and people who requested changes.
- "Commits behind destination", draft state, or minimum-approval thresholds.
- `--limit` for `pr list`.

## Decisions

### D1. Review data via the `fields` partial response, not a per-PR GET

`listPullRequests` and `listWorkspacePullRequestsForUser` append `fields=+values.participants,+values.reviewers` through `URLSearchParams`, which emits `%2B`. This keeps review state at zero extra requests for both commands.

Rejected alternative: fetching each PR's full resource (N requests) to read `participants`. It spends the rate limit for data the list endpoint will return if asked.

Pagination does not rely on Bitbucket echoing `fields` in its `next` URLs.

- `bbPaginate` gains an optional `mapNext(next)` hook.
- Both list functions pass a hook that rewrites every `next` URL with `searchParams.set('fields', …)`.
- `set` replaces the parameter instead of adding a second one. So review data survives whether `next` drops `fields`, echoes it, or echoes it with a literal `+`.

Rejected alternatives:

- Trusting the server's `next`: this is unverified, and a failure would silently show `?` on page 2 onwards.
- A local pagination loop in `client.ts`: it duplicates `bbPaginate`, and the client tests already stub `bbPaginate`.

### D2. Review cell semantics

A pure `summarizeReview(pr)` computes three numbers:

- **Approvals `✓n`**: participants with `approved === true`, excluding the PR author. The author's own approval does not count toward Bitbucket's minimum-approvals check, so it is not shown as one.
- **Changes requested `✗n`**: participants with `state === 'changes_requested'`, excluding the author.
- **Pending `○n`**: accounts in `reviewers[]` with no participant entry that has approved or requested changes. Pending is based on `reviewers[]`, not on `participants[]` with `role === 'PARTICIPANT'`, so people who only commented are not counted as pending.

Rendering:

- Non-zero parts are joined in the order `✓ ✗ ○`, for example `✓2 ✗1 ○1`.
- If all three are zero, the cell is `—`.
- If `participants` is absent from the response, the cell is `?`. This keeps "unknown" distinct from "none".

Accounts are matched by `account_id`, falling back to `uuid`.

### D3. Tasks cell from `task_count`

`task_count` is already in every list value. A positive count renders as the number; `0` or an absent field renders as `—`.

### D4. Per-PR merge signals under `--checks`

A new client function, `listPullRequestSignals(prs)`, returns one entry per PR in input order.

- **Only OPEN PRs are checked.** A PR in any other state gets `null` and costs no request, and its Builds and Conflicts cells render `—` with no warning. Conflicts and head-commit builds of a merged or declined PR are history, not merge signals. Without this rule, `--state ALL --checks` would fan out over the whole PR history.
- **Result shape.** It is defined in `types.ts`, so `signals.ts` and `formatters.ts` never import the client:

  ```ts
  type SignalResult<T> = { value: T } | { error: { status?: number; message: string } };
  interface PullRequestSignals {
      builds: SignalResult<BitbucketCommitStatus[]>;
      conflicts: SignalResult<BitbucketPaginated<BitbucketConflict>>;
  }
  // listPullRequestSignals(prs): Promise<(PullRequestSignals | null)[]>
  ```

  The client returns raw data. The formatter calls `summarizeBuilds(value, pr.source.commit?.hash)` and `summarizeConflicts(value)`, and renders `?` for an `error` arm.

For each OPEN PR:

- **Base URL**:
    - Normally `pr.links.self.href`, the canonical API URL of the PR. It works for `pr mine` across repositories and for fork PRs.
    - Fallback: `repositories/{destination.repository.full_name}/pullrequests/{id}`.
    - If neither is available, both signals are recorded as errors.
- **Builds**: `GET {base}/statuses?pagelen=100`, with every page drained. The endpoint returns statuses for every commit on the PR, and the larger page size keeps most PRs to a single page.
    - If the head hash is unknown, all statuses are used.
    - Otherwise each status is judged on its own. It is kept if its commit hash prefix-matches the PR's `source.commit.hash`, or if it carries no commit. The list response has a short hash and statuses have the full one, so the shorter must be a prefix of the longer.
    - Precedence and rendering:

      | Condition | Cell |
      |---|---|
      | any `FAILED` | `✗ n failed` |
      | otherwise any `STOPPED` | `○ n stopped` |
      | otherwise any `INPROGRESS` | `⟳ n running` |
      | otherwise all `SUCCESSFUL` | `✓ n passed` |
      | no statuses | `—` |

      The symbols match the existing `statusState` formatter.
- **Conflicts**: `GET {base}/conflicts`, first page only; `fetch` follows the 302. That is one call but two HTTP round trips, and there is no pagination.
    - An empty `values` renders as `✓ none`.
    - Otherwise the cell is `✗ n`. `n` is `size` when present. When `size` is absent, `n` is `values.length`, with a `+` suffix if `next` exists.
- **Concurrency**: `mapWithConcurrency` with 4 PR workers. Each PR's two calls run in parallel, so at most 8 are in flight.
- **Failures are captured per signal** as `{ error: { status?, message } }` and are never thrown. See D5.

Rejected alternatives:

- `GET …/commit/{hash}/statuses`: for fork PRs the statuses live on the source repository. The PR endpoint resolves that for us.
- `diffstat` `merge conflict`: removed upstream.
- Internal `merge-restrictions`: the user chose public signals only.

### D5. Signals are informational and never fail the command

A PR's signals never change the exit code. A signal that cannot be fetched renders as `?`, whether it failed with an `AtlassianHttpError`, a network error, a 429, or a missing URL.

After output, the handler prints warnings to stderr, grouped by signal and cause so 50 identical failures produce one line. For example:

`Warning: conflicts unavailable for 12 pull requests (HTTP 401: …)`

Only failures of the list request itself keep their existing behaviour (exit 1). The per-workspace 403/404 skip in `pr mine` is unchanged.

Rationale: without the repository's rules, `af` cannot know whether a failed build or open task actually blocks a merge. Treating either as an error would overstate what it knows.

### D6. JSON output stays raw; `--checks` has no effect with `--json`

`--json` emits the raw PR array as before. The objects now also contain `participants` and `reviewers`, because the API returned them.

With `--checks --json`:

- no signal requests are made;
- a one-line notice goes to stderr;
- stdout is unchanged.

Rejected alternatives:

- Injecting a synthetic key such as `af_signals`: it breaks the "raw pull request objects" contract of both commands.
- Rejecting the flag combination with exit 1: it adds a failure path for a harmless combination.

Scripts can already get build data per PR through `pr status <id> --json`.

### D7. Table layout

Existing columns stay in place.

- **Review** and **Tasks** are inserted before **Updated** in both tables:
    - `pr list`: `| ID | State | Title | Author | Branches | Review | Tasks | Updated |`
    - `pr mine`: `| Repo | ID | State | Title | Branches | Review | Tasks | Updated |`
- `--checks` inserts **Builds** and **Conflicts** after **Tasks**.

The formatters take an optional `signals` array aligned by index with `prs`. The Builds and Conflicts columns appear only when it is supplied.

Rejected alternative: dropping Branches or State to save width. It changes output the user did not ask to change.

### D8. Where `--checks` applies in `pr list`

Signals are fetched only for the rows that are shown:

- In `pr list`, after the client-side `--mine` filter, so hidden PRs cost nothing. `--author` is already applied server-side.
- In `pr mine`, after the merge, sort, and `--limit` truncation.

Of those rows, only the OPEN ones are fetched (D4).

### D9. Module placement

The pure summarizers go in a new `bitbucket/lib/signals.ts`, mirroring the pure-logic `filters.ts`:

- `summarizeReview`
- `summarizeBuilds`
- `summarizeConflicts`

The signal result types go in `types.ts`, and grouping failures into warnings (`groupSignalFailures`) goes in `signals.ts`. Formatters only lay out cells, and `client.ts` only fetches. `bitbucket/**/*.ts` is already in the `package.json` `files` allowlist, so no packaging change is needed.

## Risks / Trade-offs

- **[`next` URLs mishandle `fields`]** Bitbucket might drop `fields` from `next`, or echo it with a literal `+`. → Always handled by the `mapNext` rewrite (D1), which is unit-tested for both cases.
- **[Conflicts endpoint is new, and its redirect target once rejected API tokens]** → Degrades to `?` plus a grouped warning (D5); covered by the smoke test.
- **[Authorization header lost on redirect]** `fetch` strips `Authorization` on cross-origin redirects. The redirect is expected to stay on `api.bitbucket.org`. → Smoke test. If it goes cross-origin, the fallback cannot use `bbRequest`, because the shared `request()` throws `AtlassianHttpError` on any 3xx. Instead:
    - use raw `fetch` with `redirect: 'manual'`;
    - resolve the target with `new URL(location, requestUrl)`;
    - re-send Bitbucket auth only when the target is https on `api.bitbucket.org` or `bitbucket.org`;
    - for any other target, record the conflicts signal as an error without forwarding credentials.
- **[Build semantics drift]** Bitbucket's builds check could differ from "any FAILED on head" in edge cases, such as re-runs under different keys. → The column shows state, not a verdict, and `pr status <id>` gives the full per-commit breakdown.
- **[Rate limits on large lists]** `pr list --checks` on a repository with many open PRs could issue hundreds of requests. `pr list` has no `--limit`. Mitigations:
    - `--checks` is opt-in;
    - only OPEN rows are fetched, and closed PRs cost nothing;
    - `pagelen=100` keeps statuses to one page;
    - concurrency is bounded;
    - 429s degrade to `?`;
    - help text states the real cost: about three requests per listed open PR (statuses, plus conflicts and its redirect), more when a PR has many build statuses.
- **[Table width]** Two to four extra columns make rows long in narrow terminals. → Accepted; cells are compact (`✓2 ✗1`, `⟳ 1 running`).
- **[Semantics of `task_count`]** Documented as open tasks; not yet confirmed live. → Smoke test compares it with `pr task list <id> --unresolved`.

## Migration Plan

Additive only. Table output gains columns and JSON objects gain two keys. No configuration or data migration. Rollback is a revert.

## Open Questions

- Does the `conflicts` redirect keep authentication with an API token? The smoke test answers this, and the fallback is defined in Risks.
- Does `…/statuses` accept `pagelen=100`? The smoke test answers this. If the API rejects it, drop the parameter and use the default page size.
