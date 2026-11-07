## 1. Spike: verify the pull request PUT in the sandbox (blocks every later group)

> Skipped: no Bitbucket credentials exist in this environment. On 2026-11-07 the user chose the design's Risks fallback instead, so every pull request PUT resends the title, description and reviewers. Tasks 1.1 to 1.7 were not performed.

- [ ] 1.1 Confirm the prerequisites. If any is missing, stop and ask the user. Do not fall back to "resend everything" (design Risks) without the user's explicit agreement.
    - Bitbucket credentials that can write to `avantmedialtd/sandbox`. Check with `af bb whoami` and `af bb repo get --workspace avantmedialtd --repo sandbox`.
    - At least one workspace member other than the authenticated account, to act as a reviewer. Find one with `af bb members --workspace avantmedialtd --query …`; two members are better.
    - A throwaway branch in the sandbox with at least one commit ahead of the main branch. Use an existing branch, or push one for the spike.
- [ ] 1.2 Create a draft pull request with a description and the reviewer(s): `af bb pr create --workspace avantmedialtd --repo sandbox --from <branch> --title "spike: draft lifecycle" --description "spike body" --reviewers <id>[,<id>] --draft --json`. Record `draft`, `reviewers` and `description` from the response.
- [ ] 1.3 Send raw PUTs to `…/pullrequests/{id}` with the same credentials as af, for example `curl -u "$BITBUCKET_USERNAME:$BITBUCKET_API_TOKEN"`. Keep any scratch script outside the repository. After each PUT, `GET` the pull request and record the HTTP status and the resulting `title`, `description`, `reviewers` and `draft`:
    - a. `{"draft": false}`, with no title;
    - b. `{"title": "<current>", "draft": false}`. Also note the new entry in `af bb pr activity <id>`, and, if a reviewer's inbox can be checked, whether a "ready for review" email arrived;
    - c. `{"title": "<current>", "draft": true}`, to see whether an open pull request moves back to draft;
    - d. `{"title": "renamed"}`, today's `pr update --title`;
    - e. `{"description": "changed"}`, today's `pr update --description-file`;
    - f. with the pull request ready, `{"title": "<current>", "draft": false}` sent twice, to see whether the second PUT adds an activity entry.
- [ ] 1.4 Check the list endpoints, using the same `fields` value af sends:
    - Does `GET …/pullrequests?state=OPEN` return the draft, and does each value carry `draft`?
    - Do `q=draft=true` and `q=draft=false` filter both `GET …/pullrequests` and `GET /workspaces/avantmedialtd/pullrequests/{account}`?
    - With `pagelen=1` and two matching pull requests, does the `next` URL keep `q`?
- [ ] 1.5 With the pull request in draft, run `af bb pr merge <id>` and record the HTTP status and the error body. This is the fixture for the merge-hint tests.
- [ ] 1.6 Record the results:
    - Decide the resend set (design D3): which of title, description and reviewers an unchanged-field PUT must carry.
    - Answer each item under Open Questions in `design.md`, citing the date and the sandbox pull request number.
    - If 1.4 shows list values lack `draft`, note that task 3.4 applies.
- [ ] 1.7 Clean up: decline the sandbox pull request (`af bb pr decline <id> --workspace avantmedialtd --repo sandbox`), and delete the throwaway branch if the spike pushed it.

## 2. Types, update builder and client

- [x] 2.1 In `bitbucket/lib/types.ts`, add `draft?: boolean` to `BitbucketUpdatePullRequestRequest`.
- [x] 2.2 Create `bitbucket/lib/update.ts` (design D4) with a pure `buildPullRequestUpdate(current, changes)`:
    - `changes` holds the optional `title`, `description`, `reviewerAccountIds` and `draft` (a boolean).
    - It returns `{ kind: 'put', body }`, or `{ kind: 'noop', state: 'ready' | 'draft' }` when `draft` is the only change and `current` is already in that state.
    - The body always carries the changed fields. An empty `description` is kept, because it clears the description.
    - The body carries `draft` only when it differs from `Boolean(current.draft)`.
    - It sends the current values of the unchanged fields chosen in 1.6, with reviewers as `{ account_id }`.
    - Put a comment above the function that records the spike date, the sandbox pull request, and the verified behaviour behind the resend set.
- [x] 2.3 Add `bitbucket/lib/update.test.ts`. Cover:
    - a title-only change, a description-only change and a reviewers-only change, each preserving the unchanged fields per the resend set;
    - `--reviewers` replacing the list;
    - `description: ''` kept in the body;
    - `draft` sent as `false` from a draft and as `true` from a ready PR;
    - `draft` left out when it is unchanged and another change exists;
    - both no-op states.
- [x] 2.4 In `bitbucket/lib/client.ts`, have `updatePullRequest(workspace, repo, id, body)` PUT exactly the body it is given, and remove `UpdatePullRequestOptions`, or reduce it to the new `changes` type if that type is shared.
- [x] 2.5 In `bitbucket/lib/client.ts`:
    - give `listWorkspacePullRequestsForUser` an optional `q`, sent on its first URL;
    - make the `mapNext` hook used by both list functions set `q` again with `searchParams.set`, whenever the call has one, alongside `fields`;
    - never build query strings by hand.
- [x] 2.6 Add the first `updatePullRequest` tests to `bitbucket/lib/client.test.ts`: the method is PUT, the URL is the pull request's, and the body is serialized unchanged. Also cover:
    - the workspace list sends `q`;
    - `mapNext` adds `q` to a `next` URL that lacks it, and replaces one that echoes it, leaving exactly one `q` with the right decoded value;
    - the existing `fields`, `state` and `sort` assertions still pass.

## 3. List filter clause and formatters

- [x] 3.1 In `bitbucket/lib/filters.ts`, add a pure helper that builds `q` from an optional author and an optional draft filter. It returns:
    - `author.nickname="<author>"` for an author alone;
    - `draft=true` or `draft=false` for a draft filter alone;
    - the two joined with ` AND ` when both are given;
    - `undefined` when neither is given.
- [x] 3.2 Add the helper's cases to `bitbucket/lib/filters.test.ts`.
- [x] 3.3 In `bitbucket/lib/formatters.ts`, add one State-cell helper (`state`, plus ` (draft)` when `draft` is true). Use it in `formatPullRequest`, replacing the inline expression, and in `formatPullRequestList` and `formatMyPullRequestList`.
- [ ] 3.4 Only if 1.4 showed that list values lack `draft`: add `+values.draft` to `REVIEW_FIELDS` in `client.ts`, and update the `fields` assertions in the client tests and the spec.
    - Not applied, pending verification: 1.4 did not run. The 8.4 smoke test will show whether list rows carry `draft`.
- [x] 3.5 In `bitbucket/lib/formatters.test.ts`:
    - a draft row renders `OPEN (draft)` in both list tables;
    - a non-draft row renders `OPEN`;
    - `formatPullRequest` output is unchanged for drafts and non-drafts.

## 4. Command: flags, strict rules and argument errors

- [x] 4.1 In `commands/bitbucket.ts`, add `ready?: boolean` to `BitbucketOptions` and `'--ready'` to `BOOLEAN_FLAGS`.
- [x] 4.2 In `STRICT_RULES`:
    - add `'--ready'` and `'--draft'` to the options of `pr update`;
    - add `prRule('ready', [], 2)` and `prRule('draft', [], 2)`.
- [x] 4.3 Add the argument errors. Both run before any file or standard input is read and before any request is sent:
    - `--ready` together with `--draft` on `pr update`, `pr list` and `pr mine` prints `Error: --ready and --draft are mutually exclusive` and exits 1;
    - `pr update <id>` without any of `--title`, `--description`, `--description-file`, `--reviewers`, `--ready` and `--draft` prints an error listing them and exits 1.
- [x] 4.4 Update `commands/bitbucket.test.ts`:
    - the tests that expect `pr update --draft` to be rejected (around lines 872 and 1568) now expect it to be accepted;
    - the "option the action does not accept" case uses `pr update 42 --close-source`;
    - new cases: `pr ready 42 --title "New title"` is rejected, naming `--title` and `pr ready`; `--ready=true` is rejected as a boolean option given a value; both mutually-exclusive errors; the no-change-flag error;
    - every error case asserts that no client function was called.

## 5. Command: update flow and the draft aliases

- [x] 5.1 Rewrite the `update` case as the D2 flow:
    1. argument errors (4.3);
    2. read the description (`readProse`);
    3. `client.getPullRequest`;
    4. if the state is not `OPEN`, print an error naming the state and exit 1 without a PUT;
    5. `buildPullRequestUpdate`;
    6. on a no-op, print the notice ("pull request 42 is already ready for review" or "… is already a draft") and exit 0. With `--json`, print the fetched pull request as JSON on stdout and the notice on stderr;
    7. otherwise call `client.updatePullRequest` and print the result as today.
- [x] 5.2 Route `pr ready <id>` and `pr draft <id>` into the same flow with `ready` or `draft` preset. Use `requireIdArg` for the id.
- [x] 5.3 Only if 1.6 decided that reviewers are resent: on a 400 `AtlassianHttpError` from the PUT whose message mentions reviewers, add a hint to pass `--reviewers` explicitly or to remove the inactive reviewer in Bitbucket (design Risks).
    - Applies: the user's fallback decision of 2026-11-07 stands in for 1.6, so reviewers are always resent.
- [x] 5.4 Add command tests. Cover:
    - `getPullRequest` is called before `updatePullRequest`;
    - a `MERGED` pull request prints the error and sends no PUT;
    - both no-op notices exit 0 with no PUT, and the `--json` variant splits stdout and stderr;
    - `--description-file final.md --ready` sends one PUT carrying both;
    - `pr ready` and `pr draft` send the expected `draft` value;
    - `pr ready` with no id prints the id error and makes no request.

    Add `getPullRequest` to the client mock factory if it is missing, and update the existing `updatePullRequest` call assertions to the new body form.

## 6. Command: list filters and the merge hint

- [x] 6.1 `pr list` builds `q` with the 3.1 helper from `--author` and `--draft` / `--ready`. `pr mine` passes the draft clause as `q` to `listWorkspacePullRequestsForUser`.
- [x] 6.2 In the `merge` case (design D11), catch the `AtlassianHttpError` from `mergePullRequest` and call `getPullRequest`:
    - if the pull request is a draft, print Bitbucket's message, then `Error: PR #<id> is a draft and cannot be merged. Mark it ready first: af bb pr ready <id>`, and exit 1;
    - otherwise, or if the GET fails, rethrow the original error.
- [x] 6.3 Add command tests. Cover:
    - the decoded `q` for `pr list --draft`, `pr list --author alice --draft` and `pr mine --ready`;
    - a draft merge failure prints both messages and exits 1;
    - a non-draft merge failure prints only Bitbucket's message;
    - a successful merge calls only `mergePullRequest`.
    - The merge errors in these tests are synthetic, pending the 1.5 fixture; the hint depends only on the follow-up GET's `draft`.

## 7. Documentation

- [x] 7.1 In `showBitbucketHelp()`:
    - `pr update` gains `[--ready | --draft]`;
    - add `pr ready <id>` and `pr draft <id>` with one-line descriptions;
    - `pr list` and `pr mine` gain `[--draft | --ready]`;
    - add a note that reviewers on a draft are not notified until it is marked ready, and that a draft cannot be merged;
    - add the example `af bb pr update 42 --description-file final.md --ready`.
- [x] 7.2 Update the Bitbucket section of `CLAUDE.md`. Leave the mergeability note for the follow-up. Cover:
    - the usage block: the new flags, `pr ready` and `pr draft`, and the list filters;
    - a short paragraph: the draft lifecycle; `pr update` fetching the pull request before it writes and preserving unchanged fields (the resend set from 1.6); the no-op and not-open behaviour; filtering through `q`, set again on every page;
    - `pr ready` and `pr draft` added to the list of strict commands.
- [x] 7.3 Add any new words flagged by `bun run spell:check` to `.cspell.json`.

## 8. Verification

- [x] 8.1 Run `bun run test` (not `bun test`) and fix failures.
- [x] 8.2 Run `bun run lint`, `bun run format:check` and `bun run spell:check`.
- [x] 8.3 Run `openspec validate add-bb-pr-draft-ready --strict`.
- [ ] 8.4 Run a live smoke test in `avantmedialtd/sandbox`, then decline the pull request and delete its branch:
    - create a draft with a reviewer;
    - `af bb pr list` shows `OPEN (draft)`, `pr list --draft` lists it, and `pr list --ready` does not;
    - `af bb pr merge <id>` prints the draft hint;
    - `af bb pr update <id> --description-file - --ready`, fed a quoted heredoc, leaves the reviewer in place (`pr reviewers <id>`), updates the description and makes the pull request ready;
    - `af bb pr ready <id>` then prints the already-ready notice;
    - `af bb pr draft <id>` moves it back to draft;
    - `af bb pr mine --draft --limit 1` lists it.

## 9. Review follow-ups (2026-11-07)

Fixes from a code review of the implementation, applied with the user's agreement.

- [x] 9.1 An empty `--reviewers ""` clears the reviewers. `parseReviewers` returned `undefined` for it, so `pr update` passed the change-flag check and then resent the current reviewers, while `--reviewers ,` cleared them. Only an absent flag now means "no reviewer change"; `pr create --reviewers ""` still adds none.
- [x] 9.2 Bitbucket's per-field errors (`error.fields`) are appended to HTTP error messages as `field: detail` lines in the shared `atlassian/lib/request.ts`, unless the message already contains the line. The reviewers hint (5.3) then also appears when only the field errors mention reviewers.
