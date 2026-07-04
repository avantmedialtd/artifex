## Context

`af bb pr comment list` and `af bb pr task list` already fetch and render everything on a PR. Resolution is already exposed for comments (`formatCommentList` renders `✓ resolved by X (date)`) and for tasks (each task renders its `RESOLVED`/`UNRESOLVED` state). The missing piece is the ability to *filter* either list by resolution state.

Current shape:

- `BitbucketComment.resolution?: BitbucketCommentResolution | null` — present only on the **top-level** comment of a thread. Replies (`parent.id` set) never carry their own `resolution`.
- `BitbucketTask.state: 'RESOLVED' | 'UNRESOLVED'` — flat, per task.
- `listComments` / `listTasks` in `bitbucket/lib/client.ts` drain all pages and return a flat array.
- `formatCommentList` rebuilds the reply tree from the flat array via a `parent.id → children` map.
- `--resolved` / `--unresolved` already exist as parsed boolean flags (today only consumed by `pr task update`, where they *set* state).

## Goals / Non-Goals

**Goals:**

- Filter `pr comment list` by resolution state, operating on whole threads by their root so the reply tree stays intact.
- Filter `pr task list` by resolution state.
- Make the two flags mutually exclusive on both commands, consistent with the existing `pr task update` error.
- Apply filtering before rendering so `--json` returns the filtered set.
- Keep the thread-walk logic in a pure, unit-testable helper rather than inline in the command handler.

**Non-Goals:**

- No server-side (`q` BBQL) filtering — see Decisions.
- No new API endpoints or client functions.
- No change to how resolution is *displayed* (already implemented) or *mutated* (`comment resolve`/`reopen`, `task update`).
- No new parser flags.

## Decisions

### 1. Filter client-side, not via the Bitbucket `q` query param

The comments and tasks list endpoints are already fully drained page-by-page. Filtering the resulting array is trivial and gives full control over thread grouping. Server-side BBQL on `resolution.resolved_on` is fiddly and — decisively — cannot express "keep this resolved root *and its replies*", because replies have no `resolution` field to match. Client-side filtering is the only option that preserves thread integrity.

_Alternative considered:_ pass `q=resolution.resolved_on != null`. Rejected: drops replies, ties us to BBQL quirks, and buys nothing since we drain all pages anyway.

### 2. Comment filtering is thread-by-root via an ancestor walk

Resolution lives on the thread root. So the filter must: for each comment, find its top-level ancestor (walk `parent.id` up until a comment with no parent), read that ancestor's resolution, and keep the comment iff the ancestor matches the requested state. This keeps a resolved root together with all its replies (and drops the whole subtree when it doesn't match). A comment is "resolved" iff its root's `resolution` is a non-null object; otherwise "open".

_Alternative considered:_ flat per-comment filter (`keep iff comment.resolution matches`). Rejected in exploration — it orphans replies (which have no resolution) and breaks the rendered tree. The user explicitly chose thread-by-root.

Edge cases the walk handles uniformly:

- General (non-inline) vs inline threads — both filter by whatever `resolution` the root carries.
- A deleted root still carries whatever `resolution` the API returned, so it filters by that (and still renders with its `(deleted)` marker if kept).
- Defensive: if a `parent.id` points at a comment absent from the fetched set (shouldn't happen since we drain all pages), treat the nearest reachable ancestor as the root rather than crashing.

### 3. Task filtering is a flat state match

`BitbucketTask.state` is per-task with no nesting, so `--resolved` → `state === 'RESOLVED'`, `--unresolved` → `state === 'UNRESOLVED'`. No helper needed beyond an inline predicate, but the resolution-state concept is shared enough that a tiny shared enum/type (`ResolutionFilter = 'resolved' | 'unresolved' | undefined`) keeps the two call sites consistent.

### 4. Helper placement and shape

Add `filterCommentsByResolution(comments, filter)` as a pure function in `bitbucket/lib/` (alongside the formatter, or a small `filters.ts` — implementation detail for tasks.md). It takes the flat `BitbucketComment[]` and a `ResolutionFilter`, returns a flat `BitbucketComment[]` (so `formatCommentList` consumes it unchanged), and is a no-op passthrough when the filter is `undefined`. This keeps the ancestor walk out of the command handler and directly unit-testable.

### 5. Apply the filter before the output branch

In both `list` cases, compute the filtered array first, then feed it to the existing `fmt.output(json ? filtered : fmt.format…(filtered), false)` line. This makes `--json` and the human view consistent.

## Risks / Trade-offs

- **[Resolution field absent on the list endpoint for some Bitbucket configurations]** → Filtering degrades gracefully: a root with no `resolution` is treated as open, so `--unresolved` still returns it and `--resolved` simply returns nothing rather than erroring. Existing display tests already assume the list endpoint returns `resolution`; no regression.
- **[Ancestor walk on malformed/cyclic parent references]** → Bound the walk (track visited ids / cap depth) so a pathological `parent` chain can't loop forever; fall back to treating the last reachable comment as the root.
- **[Flag semantics differ between subcommands]** (`pr task update` *sets* state; `list` *filters*) → Acceptable and unsurprising; the flag names read naturally in both, and `update` vs `list` disambiguates intent. Documented in help text.
