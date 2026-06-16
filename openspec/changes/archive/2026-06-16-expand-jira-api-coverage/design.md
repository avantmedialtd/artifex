## Context

`af jira` speaks only `/rest/api/3` synchronously today: `jira/lib/client.ts` hardcodes that base path inside the `request<T>` helper, and every write is a single sync POST/PUT/DELETE. The roadmap in the proposal spans operations that do **not** fit that mold — some are asynchronous bulk jobs, some live on a different API entirely (`/rest/agile/1.0`), and one (`transition`) is currently issuing a malformed write that silently corrupts workflow state. This document records the architecture needed to absorb all ten roadmap items without a rewrite, plus the API facts verified against Atlassian's OpenAPI spec and reference docs (as of 2026-06) so later slices can be picked up without re-researching them.

This is a roadmap proposal: the design intentionally describes the shared infrastructure once and then the per-tier shape, so individual items can be implemented in separate changes that all inherit the same plumbing.

## Goals / Non-Goals

**Goals:**

- Fix the transition corruption bug by sending screen fields (resolution, required fields, comment) in the transition POST.
- Establish three reusable pieces of infrastructure: an async bulk task-poller, a second request base for the Agile API, and a unifying "what does this operation require?" discovery surface.
- Map each of the four distinct "move" semantics to the correct endpoint and verb so latency/failure modes are not hidden behind one overloaded command.
- Record the verified API facts (limits, body shapes, status codes) so each roadmap slice is implementable from this document.

**Non-Goals:**

- Implementing all ten items in one change — this is a backlog; slices ship independently in the order in `tasks.md`.
- Re-architecting the existing sync `/rest/api/3` client beyond adding an alternate base path.
- New ADF work — the existing `atlassian/lib/adf.ts` `textToAdf` helper covers transition/worklog/comment bodies.
- Duplicating the `pm` skill's sprint logic; tier-3 sprint work coordinates with `pm` rather than competing.
- Hard guarantees built on behavior that cannot be verified from documentation (see Open Questions).

## Decisions

### Three cost tiers

The roadmap sorts cleanly into three API-surface tiers, which is the primary axis for sequencing and risk:

- **Tier 1 — `/rest/api/3` sync** (client already speaks it): reparent, transition-screen, comment edit/delete, worklog, watchers/votes, editmeta. Cheapest; no new infrastructure.
- **Tier 2 — `/rest/api/3/bulk/*` ASYNC** (needs the task-poll helper): move, bulk edit/transition/delete.
- **Tier 3 — `/rest/agile/1.0`** (Jira Software only; new base path): rank, sprint/backlog, board/sprint listing.

### Async bulk model (verified)

All bulk writes return `201` with a body `{ "taskId": "…" }`; progress is polled with `GET /rest/api/3/bulk/queue/{taskId}`. Verified limits:

- Max **1,000 issues per request** — chunk larger selections.
- Only **5 concurrent bulk tasks globally** — serialize chunks rather than firing them in parallel.
- Task status is queryable for **14 days**.
- Observed statuses include `RUNNING` and `COMPLETE`. The full failure-state enum is **unconfirmed**, so the poller treats any non-terminal/unknown status defensively (keep polling with backoff; surface the raw status on an unrecognized terminal state rather than asserting success).

The poller is built once and gates both `move` (#2) and `bulk` (#6).

### Move body shape (verified)

`POST /rest/api/3/bulk/issues/move` takes `{ sendBulkNotification, targetToSourcesMapping }`. The mapping **key** is a descriptor string `"PROJECT-KEY,<issueTypeId>"`. Each **value** carries:

- `issueIdsOrKeys`
- infer flags: `inferStatusDefaults`, `inferFieldDefaults`, `inferClassificationDefaults`, `inferSubtaskTypeDefault`
- `targetMandatoryFields`
- `targetStatus` — maps a target-status-id → source-status-ids, for cross-workflow moves.

All issues in one request must land in a **single project + type + parent**. UX decision: auto-suggest the status mapping or set `inferStatusDefaults: true` rather than make users hand-build `targetStatus`.

### Transition with screen (verified)

`POST /rest/api/3/issue/{key}/transitions` accepts `transition` + `fields` + `update` in one call and returns `204`. Rules:

- Comment-on-transition goes in `update.comment[].add.body` as **ADF**.
- A given field must appear in **either** `fields` **or** `update`, never both.
- Concurrent transitions now return **409** — retry.
- Discovery: `GET …/transitions?expand=transitions.fields` returns each transition's `hasScreen` plus a `fields` map carrying `required` / `schema` / `allowedValues` / `operations`.
- Bulk transition (#6) can only perform transitions that need **no** field input.

This is the fix for the corruption bug: when the chosen transition has a resolution screen, send the resolution (and any required fields) in `fields`, so the issue is never left resolved-without-resolution.

### Reparent (verified)

`parent` is the unified canonical field for both company- and team-managed projects, replacing the deprecated Epic Link (`customfield_10014`) and Parent Link. Use `PUT /rest/api/3/issue/{key}` with `{ fields: { parent: { key|id } } }` (sync). Folding reparent into `update --parent` (rather than a new `move`-style verb) keeps it where users already set fields.

### Agile API (verified)

Tier 3 introduces the `/rest/agile/1.0` base path (Jira Software only):

- **rank** → `PUT /rest/agile/1.0/issue/rank`, body `{ issues[], rankBeforeIssue | rankAfterIssue, rankCustomFieldId? }` — **max 50** issues.
- **sprint move** → `POST /rest/agile/1.0/sprint/{id}/issue` — open/active sprints only.
- **backlog move** → `POST /rest/agile/1.0/backlog/issue` (global, no rank) or `…/backlog/{boardId}/issue` (with rank).
- **list boards** → `GET /rest/agile/1.0/board` (query `type`, `projectKeyOrId`).
- **list sprints** → `GET /rest/agile/1.0/board/{boardId}/sprint?state=…`.
- **create sprint** → `POST /rest/agile/1.0/sprint`.

Company- vs team-managed behavioral differences here are largely undocumented (see Open Questions).

### Comment visibility / JSM

Platform `Comment.jsdPublic` is **read-only** — internal/public JSM notes need a **different** endpoint: `POST /rest/servicedeskapi/request/{key}/comment` with `{ public: false }`. Branch on project type. The `sd.public.comment` property trick is not in any official reference — do **not** use it.

### Cross-cutting infrastructure (build once)

- **Async task-poller** — gates #2 and #6.
- **ADF markdown helper** — already exists (`textToAdf`); reused, not rebuilt.
- **Agile request base** — second base path alongside `/rest/api/3`.
- **A unifying discovery surface** — `transitions?expand=fields`, `editmeta`, and the existing `createmeta` answer "what does this operation require?" before a mutation fires. This is the most agent-friendly capability on the list and should be treated as a first-class deliverable, not a side effect.

## Risks / Trade-offs

- **[Bulk task failure-state enum is unconfirmed]** → poller treats unknown/non-terminal statuses defensively and surfaces the raw status rather than asserting success; failure handling is hardened empirically once real failure payloads are observed.
- **[`parent: null` clearing is undocumented and project-type-dependent]** → ship `--clear-parent` as **provisional**, gated behind empirical verification; do not advertise it as guaranteed until confirmed on both company- and team-managed projects.
- **[Concurrency: only 5 bulk tasks globally, 1000 issues/request]** → chunk + serialize large selections instead of parallelizing; surface a clear message when a selection is split.
- **[Concurrent transitions return 409]** → retry with backoff rather than failing the command.
- **[Bulk transition cannot perform field-requiring transitions]** → detect via `transitions?expand=fields` and refuse with a clear error pointing at single-issue `transition` instead of silently no-op'ing.
- **[Tier-3 sprint surface overlaps the `pm` skill]** → coordinate ownership with `pm`; expose Agile-native verbs the skill can call rather than reimplementing its planning logic.
- **[JSM internal-comment behavior differs from platform comments]** → branch on project type; never rely on the unofficial `sd.public.comment` trick.
- **[Adding a second base path could leak into the wrong tier]** → the Agile base is opt-in per call site, leaving the default `/rest/api/3` path untouched for tiers 1 and 2.

## Migration Plan

No data migration. Each roadmap item is additive — existing flags and output are unchanged. The one behavioral change is the transition fix (#1): after it ships, transitions that previously left an issue resolved-without-resolution will now set the resolution, which is the corrected (not breaking) behavior. Items ship in the `tasks.md` order; each is independently revertable because they add new verbs/flags rather than altering existing ones (except #1, which corrects a malformed request body).

## Open Questions

These are unverifiable from documentation; do **not** design hard guarantees on them — confirm empirically before relying on them:

- The exact bulk task **failure-state enum** (only `RUNNING`/`COMPLETE` observed).
- Whether `parent: null` reliably **clears** a parent, and how that differs by project type.
- The exact behavior of **JSM internal comments** via `/rest/servicedeskapi`.
- **Company- vs team-managed** Agile behavioral differences (rank, sprint, backlog).
- The "reporter can't vote" rule (appears to be a UI-only constraint).
