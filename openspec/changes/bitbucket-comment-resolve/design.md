## Context

`af bb pr comment` already supports list/get/add/update/delete against Bitbucket Cloud's `…/pullrequests/{id}/comments` endpoints (`bitbucket/lib/client.ts`, `commands/bitbucket.ts`). Bitbucket Cloud additionally lets reviewers **resolve** a comment thread, tracked via a `resolution` object on the comment, but the CLI neither reads nor sets it.

This change adds both sides — display resolution state, and resolve/reopen verbs. The defining constraint is that **Bitbucket Cloud's comment-resolution API is sparsely documented**. The existing client (`client.ts` header) sets the precedent: API shapes derived from observation are committed only after being **verified against the live API**, and spec scenarios that depend on an unverified shape are gated with a `GIVEN … has been verified during implementation` clause (see the task-resolution requirement). This design follows that same discipline.

## Goals / Non-Goals

**Goals:**

- Surface comment-thread resolution state in `af bb pr comment list` and `get`.
- Add `af bb pr comment resolve <pr-id> <comment-id>` and `af bb pr comment reopen <pr-id> <comment-id>`.
- Keep the change additive and consistent with existing `af bb` conventions (`--json`, workspace/repo resolution, `BITBUCKET_*` auth).
- Capture a concrete verification recipe so implementation can confirm the API shape rather than guess.

**Non-Goals:**

- Resolving/reopening **tasks** — already covered by `af bb pr task update --resolved/--unresolved`.
- Bitbucket **Server/Data Center** support (Cloud only, matching the rest of the command).
- Bulk operations (resolve all threads on a PR) — possible follow-up.
- Filtering `comment list` by resolution state — possible follow-up; this change only displays it.

## Decisions

### D1: Dedicated `resolve` / `reopen` verbs, not flags on `comment update`

Resolution is a distinct sub-resource action, not a content edit. `comment update` maps to `PUT …/comments/{cid}` with `{content:{raw}}`; resolution toggles a separate `/resolve` sub-resource. Modelling it as verbs (`comment resolve` / `comment reopen`) keeps intent explicit and avoids overloading `update`.

- **Alternative considered:** `comment update <pr> <cid> --resolved/--unresolved`, mirroring the task command. Rejected because (a) it would hit a different endpoint than the rest of `update`, making one subcommand fan out to two unrelated APIs, and (b) "resolve/reopen" reads more naturally for a thread.
- **Trade-off:** mild inconsistency with the task surface (`--resolved` flag). Accepted — the underlying APIs genuinely differ, and the verbs are clearer.

### D2: Client functions `resolveComment` / `reopenComment`

Add two functions to `bitbucket/lib/client.ts` mirroring the existing approve/unapprove pair (`POST` to act, `DELETE` to undo), pending verification:

```
resolveComment → POST   …/pullrequests/{id}/comments/{cid}/resolve   body {}
reopenComment  → DELETE …/pullrequests/{id}/comments/{cid}/resolve
```

- **Alternative considered:** `PUT …/comments/{cid}` with a `resolution`/state field in the body (the task-resolution model). To be ruled in/out by verification — if the `/resolve` sub-resource does not exist, fall back to whatever the live API accepts and document it.
- The exact method and path **MUST be confirmed by D5 before merge**; the spec scenarios are gated accordingly.

### D3: `resolution` field on `BitbucketComment`

Extend the type in `bitbucket/lib/types.ts`:

```ts
resolution?: {
    type?: string;            // e.g. "pullrequest_comment_resolution"
    user?: BitbucketUser;     // who resolved
    created_on?: string;      // when resolved
} | null;
```

Absent/null ⇒ open thread. Field names align with observed Bitbucket payloads but are confirmed in D5.

### D4: Rendering in `formatters.ts`

`formatCommentList` (and single-comment rendering) gains a resolution marker, kept stylistically close to the existing task checkbox (`[x]`/`[ ]`). Resolved threads render a visible marker (e.g. a `✓ resolved` tag), optionally annotated with resolver + timestamp when present; open threads render unmarked. Replies inherit their root thread's display naturally since they render in-tree.

### D5: Verification recipe (do this first during implementation)

Against a live test PR, before wiring anything:

1. Create an inline comment; in the Bitbucket UI click **Resolve**.
2. `GET …/pullrequests/{id}/comments/{cid}` and `…/comments` (list) — record whether `resolution` appears, its exact field names, and whether it shows up on the **list** endpoint or only the single-comment GET.
3. Probe the toggle: try `POST …/comments/{cid}/resolve` then `DELETE …/comments/{cid}/resolve`; confirm status codes and the resulting `resolution` value. If that 404s, try `PUT` with a resolution field.
4. Update the `client.ts` header note + the `resolution` type to match observed reality, then un-gate the spec scenarios.

## Risks / Trade-offs

- **Unverified API shape** → Mitigation: D5 verification step is a prerequisite task; dependent spec scenarios carry the `GIVEN … verified` gate, so the spec stays honest until confirmed.
- **`resolution` may only be returned by the single-comment GET, not the list endpoint** → Mitigation: verify in D5 step 2; if list omits it, document that `comment list` resolution display is best-effort and `comment get` is authoritative, rather than firing N extra requests.
- **Resolution may be valid only on a thread's root comment, not replies** → Mitigation: pass the user-supplied comment id straight through and surface any API rejection as a clear error; do not silently redirect it elsewhere.
- **Permission/visibility (e.g. resolving someone else's thread, or on a merged PR)** → Mitigation: surface the API error message and a non-zero exit, consistent with other `af bb` mutations.

## Migration Plan

Purely additive — new subcommands and an optional type field. No data migration, no config changes (reuses `BITBUCKET_*`). Rollback is a straight revert; nothing persists client-side.

## Open Questions

- Exact endpoint + method for resolve/reopen (`POST`/`DELETE /resolve` vs `PUT` with a field) — resolved by D5.
- Does the **list** endpoint include `resolution`, or only the single-comment GET? — resolved by D5.
- Do **general** (non-inline) comment threads support resolution, or only inline ones? — resolved by D5; affects whether the verbs should warn on non-resolvable comments.
