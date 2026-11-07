## Context

**Current state.**

- `pr create --draft` sends `draft: true`.
- Nothing else can change a pull request's draft state:
    - `pr update`'s strict rule does not list `--draft`, and the spec uses `pr update 42 --draft` as its example of a rejected option;
    - `UpdatePullRequestOptions` and `BitbucketUpdatePullRequestRequest` have no `draft` field.
- `pr get` renders `OPEN (draft)` (`formatPullRequest`), but the `pr list` and `pr mine` tables print the bare `state`, so a draft cannot be told apart from any other open pull request.

**Bitbucket's model.**

- A pull request has a `state` (`OPEN`, `MERGED`, `DECLINED`, `SUPERSEDED`) and a separate `draft` boolean.
- There is no ready or draft endpoint. `PUT /2.0/repositories/{ws}/{repo}/pullrequests/{id}` accepts the whole `pullrequest` schema, `draft` included, and its documentation says only "Mutates the specified pull request … Only open pull requests can be mutated."
- Atlassian's draft documentation adds:
    - any open pull request can be moved back to draft;
    - reviewers on a draft are not notified until it is marked ready, and are emailed when it is;
    - a draft cannot be merged, manually or automatically;
    - reviewer statuses carry over when a draft is marked ready.

**What is known about the PUT**, none of it verified by us:

| Claim | Source | Confidence |
|---|---|---|
| A PUT without `title` is rejected with 400 | The release notes of one MCP server, and the source of a second CLI, which both resend the title for this reason | Medium: two independent tools |
| A PUT without `reviewers` clears the reviewers | An Atlassian community thread with exactly that title. A search summary says Atlassian staff called it expected; the page itself did not load | Low to medium |
| Resending a reviewer list that contains an inactive user fails with "Malformed reviewers list" | BCLOUD-23093 | Medium |
| `GET …/pullrequests?state=OPEN` left drafts out | BCLOUD-23659, closed as fixed in April 2025. Its workaround shows `q` accepts `draft=true` | Fixed; still worth confirming |

`pr update` sends only the flags it was given, and the spec says the other fields are preserved. The original Bitbucket change verified the *task* PUT bodies against `avantmedialtd/sandbox` (its tasks 1.2 to 1.5) and recorded them in a comment in `client.ts`. The pull request PUT was never verified that way, and `client.test.ts` has no `updatePullRequest` test.

## Goals / Non-Goals

**Goals:**

- Mark a draft ready, and move an open pull request back to draft, from the CLI.
- Never drop reviewers, the title or the description as a side effect of any `pr update`. This matters most when marking a draft ready, because a dropped reviewer list means nobody is notified.
- Make drafts visible and filterable in `pr list` and `pr mine`.
- Explain a failed merge of a draft.
- Decide each PUT body shape from observed Bitbucket behaviour, recorded in the code, and not from assumption.

**Non-Goals:**

- The mergeability-checks API, and correcting the `CLAUDE.md` note that says no merge-check API exists. Both are a follow-up.
- Hiding drafts from the default list, as Bitbucket's UI does.
- `--state DRAFT`.
- Adding or removing single reviewers.
- Guarding against concurrent edits beyond keeping the GET-to-PUT window short (see Risks).

## Decisions

### D1. A sandbox spike runs before any code and decides the PUT body

The first task runs the pull request PUT against a throwaway pull request in `avantmedialtd/sandbox`. It answers these questions, and each answer changes something:

| Question | What the answer decides |
|---|---|
| Does a PUT without `title` fail? | Whether the current title is resent (D3) |
| Does a PUT without `reviewers` clear them? | Whether the current reviewers are resent (D3) |
| Does a PUT without `description` clear it? | Whether the current description is resent (D3) |
| Does `draft: false` on a draft mark it ready, and `draft: true` on an open PR move it back? | Confirms the core mechanism |
| What does the activity feed show after marking ready? Are the reviewers emailed? | Documentation only |
| Does sending `draft: false` to a PR that is already ready create a new activity entry or notification? | Only informational, because D6 never sends it |
| Do list responses include `draft`, does `state=OPEN` include drafts, and does `q=draft=true` filter both list endpoints? | D9 and D10; the fallback is adding `+values.draft` to `fields` |
| Does a `next` URL keep `q`? | Informational only, because D10 sets `q` again either way |
| What does Bitbucket return when a draft is merged? | The test fixture for D11 |

The results are recorded in a comment in `bitbucket/lib/update.ts`, next to the resend set it justifies (D4), citing the date of the spike and the sandbox pull request, as the original change did for tasks. They are also recorded in this file under Open Questions.

**Alternative considered:** trust the reports and always resend everything. That would be safe against data loss, but resending fields that need not be sent has its own costs (D3). The spike costs one session. If the spike cannot run, the fallback in Risks applies.

### D2. `pr update` always reads before it writes

Every `pr update`, `pr ready` and `pr draft` fetches the pull request first:

```
parse + strict check ── mutex / no-change-flag errors (no request)
        │
read --description-file / stdin  (before any request, as today)
        │
GET …/pullrequests/{id}
        ├─ state ≠ OPEN ───────────────► error, no PUT, exit 1
        ├─ only --ready/--draft, already
        │  in that state ──────────────► notice, no PUT, exit 0
        ▼
build body (D3, D6) ──► PUT ──► print the updated PR
```

The GET is useful whatever the spike finds:

- it gives the draft no-op check (D6);
- it gives a clear error for a pull request that is not open, before anything is written (D7);
- it provides the current fields for the resend set (D3).

One GET per update is nothing against the 1,000 requests per hour a personal token gets, and updates are made one at a time by a person or an agent.

**Alternative considered:** fetch only when the spike says fields must be resent. That leaves two code paths, and the draft no-op check needs the GET anyway.

### D3. Resend only the unchanged fields the spike proves necessary

The PUT body contains:

- the changed fields;
- `draft` when it changes (D6);
- each unchanged field among title, description and reviewers that Bitbucket would otherwise reject or clear.

An unchanged field that Bitbucket keeps on its own is left out. Leaving it out narrows what a concurrent edit can lose, and avoids the inactive-reviewer 400, which can only happen when reviewers are resent. Resent reviewers are sent as `{account_id}`: every user object carries `account_id`, while `uuid` is optional in our type, and it is the form `--reviewers` already sends.

**Alternative considered:** always resend title, description and reviewers. This is the fallback if the spike cannot run (see Risks).

### D4. Pure body builder in its own module, orchestration in the command

- A new pure module, `bitbucket/lib/update.ts`, takes the fetched pull request and the requested changes. It returns either the PUT body or a no-op, and the no-op says which state already holds. Which unchanged fields are resent is decided here, in one place, next to the comment that cites the spike.
- `updatePullRequest` in `client.ts` sends the body it is given, and gains `draft` in its request type.
- The `update` case in `commands/bitbucket.ts` runs the D2 flow and owns every user-facing message. `pr ready` and `pr draft` run the same flow.
- The `q` clause for the list filters (D10) is built by a pure helper in `bitbucket/lib/filters.ts`.

The builder gets its own module, rather than living in `client.ts`, because `commands/bitbucket.test.ts` replaces `client.ts` with an explicit mock factory. A builder inside it would be mocked away in every command test. `filters.ts` and `signals.ts` already follow this pattern: pure helpers in their own modules, imported directly by the command.

**Alternative considered:** fetch inside `updatePullRequest`. The client cannot print notices, and the command needs the fetched pull request to print it as JSON on a no-op (D6). Keeping the builder pure also makes it testable without mocking `fetch`.

### D5. Command shape: flags on `pr update`, with two strict aliases

- `pr update <id> [--ready | --draft]` is the mechanism. It mirrors `task update --resolved | --unresolved`, and it composes: `pr update 42 --description-file final.md --ready` finishes a draft in one request.
- `pr ready <id>` and `pr draft <id>` are aliases that route into the same flow with the flag already set. They match `gh pr ready`, which people and agents type first. Their strict rules accept only the global options, with at most two positional arguments (the action and the id), so `pr ready 42 --title X` fails and is not silently ignored.
- `--draft` is already a boolean flag. `--ready` is added to `BOOLEAN_FLAGS`. As with `--resolved`, the subcommand gives the flag its meaning:

    | Subcommand | `--draft` | `--ready` |
    |---|---|---|
    | `pr create` | create as a draft | — |
    | `pr update` | move to draft | mark ready |
    | `pr list`, `pr mine` | only drafts | only ready |

**Alternatives considered:**

- Verbs only. Finishing a draft would then take two commands.
- Flags only. Less discoverable for anyone coming from `gh`.
- Aliases that accept every update flag. That blurs the aliases, and `pr update` already covers the combination.

### D6. `draft` is sent only when it changes; asking for the current state does nothing

- When `--ready` or `--draft` matches the current state, `draft` is left out of the body.
- If it was the only change flag, no PUT is sent. A notice is printed ("pull request 42 is already ready for review" or "is already a draft") and the exit code is `0`. That makes `pr ready` safe to repeat in scripts.
- With `--json`, the fetched pull request goes to stdout and the notice to stderr. `--checks --json` sets the precedent for a stderr notice.
- Because nothing is sent when nothing changes, a repeated `pr ready` cannot email the reviewers a second time, whatever the spike finds on that point.

### D7. A pull request that is not open fails before the write

Bitbucket only mutates open pull requests. Since D2 already has the state, `pr update` and its aliases report, for example, "pull request 42 is MERGED; only open pull requests can be updated" and exit `1` without sending the PUT. Without this check the user would see Bitbucket's own rejection of the PUT.

### D8. `pr update` with no change flag is an error

Today `pr update 42` sends an empty PUT. Given the reviewer reports, that request could clear the reviewers. With D2 it would also cost a pointless GET. It now fails at argument-checking time, before any request, and the error lists the change flags.

### D9. Drafts read `OPEN (draft)` in every table

One State-cell helper (`state` plus ` (draft)` when `draft` is true) replaces the inline expression in `formatPullRequest` and the bare `pr.state` in `formatPullRequestList` and `formatMyPullRequestList`.

The list responses already carry `draft`: BCLOUD-23659 quotes list values with `"draft": false`. If the spike shows otherwise, `+values.draft` is added to the `fields` value, which is a one-line change.

**Alternative considered:** `DRAFT`, which is shorter, matches Bitbucket's UI label, and is the word the mergeability API uses for draft state. It was rejected because the State column would then show a value that `--state` does not accept, and it would hide that the pull request is `OPEN`. `OPEN` is what `--state` filters on and what `--checks` uses to decide which rows get signals.

### D10. The filter runs on the server through `q`, set again on every page

- `--draft` and `--ready` add `draft=true` or `draft=false` to `q`. On `pr list` the clause is joined to the `--author` clause with ` AND `, giving for example `author.nickname="alice" AND draft=true`. `listWorkspacePullRequestsForUser` gains a `q` option for `pr mine`.
- The filter runs on the server because `pr mine --limit N` stops paging early. A filter applied on the client would count pull requests it later throws away, or would have to keep paging. Filtering on the server leaves `--limit`, `--mine`, `--checks` and `--json` unchanged.
- The `mapNext` hook that already sets `fields` again on every `next` URL now sets `q` again as well, for the same reason the review-signals change gave (its D1): we do not rely on Bitbucket echoing parameters into `next`. `searchParams.set` makes this a no-op when `next` does keep `q`. The existing `--author` filter benefits too.
- `--ready` as a filter is the counterpart of `--draft`, like `--resolved | --unresolved` on `comment list` and `task list`. It gives the view a reviewer wants, only the pull requests that are ready, and costs nothing.
- `q` is combined with the `state` parameters on the server. `--state MERGED --draft` simply returns nothing, because a draft cannot be merged.

### D11. The merge hint costs a request only after a failed merge

The `merge` case catches the `AtlassianHttpError` from the merge POST and fetches the pull request:

- If it is a draft, the command prints Bitbucket's message, then an error naming the draft and suggesting `af bb pr ready <id>`, and exits `1`.
- If it is not a draft, or the GET fails, the original error is rethrown, so the output is exactly as today.

**Alternatives considered:**

- Fetch before every merge. That adds a request to every successful merge to improve one failure message.
- Match the error text. Bitbucket's wording is unknown and can change, while the `draft` field is authoritative.
- The mergeability-checks API would make this check cheaper and richer, but it belongs to the follow-up.

### D12. Documentation

- The help text adds `pr ready` and `pr draft`, `[--ready | --draft]` on `pr update`, and `[--draft | --ready]` on `pr list` and `pr mine`. It also adds one note: reviewers on a draft are not notified until it is marked ready, and a draft cannot be merged.
- The Bitbucket section of `CLAUDE.md` gets the same usage lines, a short paragraph on the draft lifecycle and the read-before-write `pr update`, and `pr ready` / `pr draft` in its list of strict commands.

## Risks / Trade-offs

- **[A concurrent edit made between the GET and the PUT is overwritten by a resent field]** → Only the fields the spike proves necessary are resent (D3), and the window is a single round trip. This is documented in the comment next to the body builder.
- **[A resent reviewer list containing an inactive user fails with "Malformed reviewers list"]** → Reviewers are resent only if the spike requires it. On a 400 whose message mentions reviewers, a hint is printed: pass `--reviewers` explicitly, or remove the inactive reviewer in Bitbucket.
- **[The spike cannot run because no credentials can write to the sandbox]** → It is the first task and it blocks the rest, so the implementer stops and asks. Only with the user's explicit agreement does the fallback apply: always resend title, description and reviewers. That is safe against data loss and accepts the two risks above.
- **[Bitbucket later changes how the PUT behaves]** → The resend set lives in one builder, next to a comment that dates the spike, and client tests pin the body.
- **[`--draft` on `pr list` / `pr mine` used to be ignored and now filters]** → This is called out as a behaviour change. Passing a flag that did nothing is unlikely to be relied on.
- **[Marking ready through the API might notify reviewers differently from the UI]** → The spike records what happens. Notifications are Bitbucket's behaviour, so af only documents them.

## Migration Plan

None. The change is additive CLI behaviour with no configuration, data or dependency changes, and rolling back means reverting the commit.

## Open Questions

These are answered by the spike (task group 1), whose answers are recorded here and in the `update.ts` comment:

1. Which unchanged fields (title, reviewers, description) must a PUT resend?
2. Do list responses include `draft` by default, and does `state=OPEN` return drafts?
3. Does `q=draft=true` filter both the repository and the workspace list endpoints?
4. Does a `next` URL keep `q`? (Informational.)
5. What does Bitbucket return when a draft is merged? (Test fixture.)
6. Does marking ready through the API notify reviewers, and what activity entry does it create? (Documentation.)

**Status on 2026-11-07.** The spike did not run, because no Bitbucket credentials exist in this environment.

- Q1 is answered by the user's decision on 2026-11-07, not by verification. The user chose the fallback in Risks: every PUT resends the title, the description and the reviewers (`buildPullRequestUpdate` in `bitbucket/lib/update.ts`). A later spike may narrow this set.
- Q2 to Q6 remain unverified. A later spike, or the live smoke test (task 8.4), settles them. Until then:
    - list values are assumed to carry `draft`, so task 3.4 is not applied (Q2);
    - `q` is set again on every page whatever the answer to Q4, as D10 already does;
    - the merge-hint tests use a synthetic `AtlassianHttpError` in place of the fixture from task 1.5 (Q5);
    - the help text and `CLAUDE.md` take the notification behaviour from Atlassian's draft documentation (Q6).
