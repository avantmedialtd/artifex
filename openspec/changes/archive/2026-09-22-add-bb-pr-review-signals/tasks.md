## 1. Types

- [x] 1.1 In `bitbucket/lib/types.ts`, extend `BitbucketPullRequest` with `task_count?: number` and `links.self?: { href: string }`, and add `BitbucketConflict` (`path: string`, `scenario?: string`, `message?: string`). `source.commit.hash` and `destination.repository.full_name` already exist.
- [x] 1.2 In `bitbucket/lib/types.ts`, add the signal result types from design D4. `signals.ts` and `formatters.ts` import them from here, never from the client:
    - `SignalResult<T> = { value: T } | { error: { status?: number; message: string } }`
    - `PullRequestSignals { builds: SignalResult<BitbucketCommitStatus[]>; conflicts: SignalResult<BitbucketPaginated<BitbucketConflict>> }`

## 2. Review data on the list requests

- [x] 2.1 In `bitbucket/lib/request.ts`, give `bbPaginate` an optional second argument `{ mapNext?: (next: string) => string }`, applied to every `next` URL before it is followed. Existing callers are unchanged.
- [x] 2.2 In `bitbucket/lib/client.ts`, add a `REVIEW_FIELDS = '+values.participants,+values.reviewers'` constant and a helper that sets it with `searchParams.set('fields', REVIEW_FIELDS)`.
    - Apply the helper to the first URL of `listPullRequests` and of `listWorkspacePullRequestsForUser`.
    - Also pass it as `mapNext`, so every `next` URL carries the parameter exactly once, encoded as `%2B`.
    - Never build the query string by hand.
- [x] 2.3 Add `bitbucket/lib/request.test.ts`, stubbing `fetch`, with two cases:
    - `bbPaginate` requests page 2 at the URL returned by `mapNext`;
    - without `mapNext`, it follows `next` verbatim.
- [x] 2.4 Add client tests:
    - both list functions request a first URL whose `searchParams.get('fields')` is `'+values.participants,+values.reviewers'`, and whose raw form contains `%2B`, not a literal `+`;
    - the `mapNext` they pass to the mocked `bbPaginate` adds `fields` when `next` lacks it;
    - it replaces a `fields` echoed with a literal `+` (one parameter, correct decoded value);
    - the existing `state`/`q`/`sort` assertions still pass.

## 3. Pure signal summarizers

- [x] 3.1 Create `bitbucket/lib/signals.ts` with `summarizeReview(pr)`. It returns `{ approvals, changesRequested, pending }`, or `null` when `participants` is absent.
    - `approvals`: participants with `approved === true`, excluding the author.
    - `changesRequested`: participants with `state === 'changes_requested'`, excluding the author.
    - `pending`: accounts in `reviewers[]` without an approved or changes-requested participant entry.
    - Accounts are matched by `account_id`, falling back to `uuid`.
- [x] 3.2 Add `summarizeBuilds(statuses, headHash)`.
    - If `headHash` is unknown, use all statuses.
    - Otherwise judge each status on its own: keep it if its commit hash prefix-matches `headHash` (the shorter hash must be a prefix of the longer), or if it carries no commit.
    - Return `{ state: 'failed' | 'stopped' | 'running' | 'passed' | 'none', count }`, using the precedence FAILED > STOPPED > INPROGRESS > all SUCCESSFUL.
- [x] 3.3 Add `summarizeConflicts(page)` returning `{ count, more }`. `count` is `size` when present, else `values.length`; `more` is true when `next` exists without `size`.
- [x] 3.4 Add `groupSignalFailures(signals: (PullRequestSignals | null)[])`.
    - It returns one warning line per (signal, HTTP status or error kind), each with the number of affected pull requests and a sample message.
    - `null` entries (closed PRs) are ignored.
- [x] 3.5 Add `bitbucket/lib/signals.test.ts` covering every spec scenario for the review, builds and conflicts cells. Include:
    - author exclusion;
    - participants who only commented not counted as pending;
    - missing `participants`;
    - a short-versus-full hash prefix match;
    - head known, with a `FAILED` status on an older commit and a `SUCCESSFUL` status with no commit, gives `passed`/1;
    - the `more` rule;
    - failure grouping, including ignoring `null`.

## 4. Client: per-PR merge signals

- [x] 4.1 Add a PR base-URL resolver.
    - Use `pr.links.self.href` when present.
    - Otherwise use `${API_BASE}/repositories/{destination.repository.full_name}/pullrequests/{id}`, with each path segment encoded.
    - Otherwise return `null`.
- [x] 4.2 Add `listPullRequestSignals(prs): Promise<(PullRequestSignals | null)[]>`, using the existing `mapWithConcurrency` with a `PR_SIGNAL_CONCURRENCY = 4` constant.
    - A PR whose `state` is not `OPEN` yields `null`, with no request.
    - For each OPEN PR, run two requests in parallel:
        - `{base}/statuses?pagelen=100`, with every page drained through `paginate`;
        - `{base}/conflicts`, first page only through `request`, with the redirect followed.
    - Return raw results as `{ value }`. Capture each signal's failure as `{ error: { status?, message } }`, with the status taken from `AtlassianHttpError`. A `null` base URL is also an error.
    - Keep input order, and never reject.
- [x] 4.3 Add client tests:
    - URLs come from `links.self`, with the `full_name` fallback and the no-URL case;
    - non-OPEN PRs yield `null` and trigger no request;
    - statuses paginate with `pagelen=100`; conflicts request only one page;
    - a 403 on conflicts is captured while statuses still resolve;
    - network errors are captured;
    - output order matches input order;
    - at most 4 PRs are in flight, checked with a per-PR in-flight counter in the mocked request;
    - only GET requests are issued.

## 5. Formatters

- [x] 5.1 Update `formatPullRequestList(prs, signals?)` and `formatMyPullRequestList(prs, signals?)` in `bitbucket/lib/formatters.ts`.
    - Insert Review and Tasks before Updated.
    - When `signals` is supplied, insert Builds and Conflicts after Tasks.
    - Review cell, from `summarizeReview`: `✓n ✗n ○n`, showing non-zero parts only; `—` when all are zero; `?` when it returns `null`.
    - Tasks cell: the count, or `—`.
    - For each signal:
        - a `null` entry renders `—` in both cells;
        - an `error` arm renders `?`;
        - otherwise call `summarizeBuilds(value, pr.source.commit?.hash)` and `summarizeConflicts(value)`.
    - Builds cell: `✗ n failed` / `○ n stopped` / `⟳ n running` / `✓ n passed` / `—`.
    - Conflicts cell: `✗ n` (`n+` when `more`) or `✓ none`.
- [x] 5.2 Update the existing header assertions in `bitbucket/lib/formatters.test.ts`, and add tests for:
    - headers with and without signals;
    - each cell variant, including `null` giving `—` and error giving `?`;
    - escaping still applied to titles.

## 6. Command wiring

- [x] 6.1 In `commands/bitbucket.ts`, add `checks?: boolean` to `BitbucketOptions` and `--checks` to `BOOLEAN_FLAGS`.
- [x] 6.2 In `pr list` and `handlePrMine`, keep the existing fetch, filter and limit steps, then:
    - With `--checks --json`: print a stderr notice that `--checks` has no effect with `--json`, make no signal requests, and output the raw array.
    - With `--checks` and no `--json`:
        - call `client.listPullRequestSignals` with exactly the displayed PRs, which means after the `--mine` filter in `pr list` and the array returned by `listMyPullRequests` in `pr mine`;
        - render with the signals;
        - print each `groupSignalFailures` line to stderr with `console.error`, not `warn()`.
    - Return 0 regardless of signal content.
- [x] 6.3 In `commands/bitbucket.test.ts`:
    - Add `listPullRequestSignals` to the `vi.mock` client factory.
    - Add `vi.mock('../bitbucket/lib/request.ts', () => ({ bbRequest: vi.fn() }))`, because `pr list --mine` resolves `/user` through `bbRequest` directly, not through the client.
    - Reset `listPullRequestSignals` (and `bbRequest`) in each new describe's `beforeEach`, following the file's existing per-describe pattern; vitest does not auto-reset mocks.

  Command tests:
    - without `--checks`, the function is not called;
    - `pr list --mine --checks`, with `bbRequest` resolving `/user` to `{ account_id: 'acc-1' }` and `listPullRequests` returning PRs by `acc-1` and another author, calls it with only the `acc-1` PRs;
    - `pr mine --limit 5 --checks` calls it with exactly the array `listMyPullRequests` resolved (the client tests cover truncation itself);
    - `--checks --json` does not call it, puts the notice on stderr, prints one parseable array to stdout, and exits 0;
    - a grouped failure prints a single stderr line and exits 0;
    - adverse signals still exit 0;
    - a failing list request with `--checks` exits 1 without calling it.

## 7. Documentation

- [x] 7.1 In `showHelp()`:
    - add `[--checks]` to the `pr list` and `pr mine` lines;
    - add a note that tables show Review (✓ approvals, ✗ changes requested, ○ pending reviewers) and Tasks;
    - add a note that `--checks` adds Builds and Conflicts for open PRs at about three requests per listed open PR (more when a PR has many build statuses), is informational only, and never changes the exit code;
    - add an `af bb pr mine --checks` example.
- [x] 7.2 Add an `af bb pr mine --checks` example to the bitbucket entry in `commands/help.ts`.
- [x] 7.3 Update the Bitbucket section of `CLAUDE.md`. Cover:
    - the Review and Tasks columns, and that they cost no extra requests via `fields` (re-applied to every page);
    - `--checks` on `pr list` and `pr mine`: open PRs only, head-commit builds, conflicts, bounded concurrency, and its request cost;
    - `?` for signals that could not be fetched, with grouped warnings on stderr;
    - raw `--json` output unchanged;
    - that no merge verdict is shown, because Bitbucket Cloud has no public merge-check API.
- [x] 7.4 Add any new words flagged by `bun run spell:check` to `.cspell.json`.

## 8. Verification

- [x] 8.1 Run `bun run test` (not `bun test`) and fix failures.
- [x] 8.2 Run `bun run lint`, `bun run format:check`, and `bun run spell:check`.
- [x] 8.3 Run `openspec validate add-bb-pr-review-signals --strict`.
- [ ] 8.4 Run a live smoke test with real Bitbucket credentials:
    - `af bb pr mine` and `af bb pr list` show Review and Tasks cells that match the Bitbucket UI, including rows beyond the first API page, e.g. `af bb pr mine --state ALL --limit 30`.
    - `af bb pr mine --checks` shows Builds and Conflicts that match the UI, and closed rows show `—` with `--state ALL`.
    - `…/statuses` accepts `pagelen=100`; if not, drop it (design Open Questions).
    - The conflicts call keeps auth across its redirect; if not, implement the raw-`fetch` redirect fallback in design Risks.
    - `task_count` matches `af bb pr task list <id> --unresolved`.
    - `af bb pr mine --checks --json | jq length` works, with the notice on stderr only.
