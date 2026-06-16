# Expand `af jira` coverage: issue move, transition screens, and workflow depth

## Why

- `af jira` today covers: issue CRUD (get/list/search/create/update/delete), comments (add + list ONLY), _blind_ transitions, assign/unassign, issue links, remote links, versions CRUD, attach (add only), and custom fields (createmeta-backed). It is missing large, high-value slices of the Jira Cloud REST v3 API and the entire Jira Agile API.
- **Latent correctness bug (fix as part of this work):** `af jira transition KEY --to Done` posts only `{ transition: { id } }` (see `jira/lib/client.ts` `transitionIssue`). If the target transition has a resolution screen, the issue ends up resolved with **no Resolution** — silent workflow-state corruption. We do not merely lack a feature; we mutate issues incorrectly.
- Users asked for "issue move" and "workflows." Those decompose into (a) transition-screen support and (b) FOUR distinct "move" operations that span three different API tiers.
- artifex is positioned as an agent-friendly CLI. The highest leverage is letting AI agents close issues _correctly_ (resolution + comment on transition), move/restructure issues, and _discover what a mutation requires before firing it_.

## What Changes

The ranked roadmap below is a backlog to pick slices from, not a single deliverable. `S/M/L` = implementation surface; `rank #` = leverage order; `tier` = API surface (see design.md).

| #   | Gap                                                                                   | Proposed verb                                       | API tier | Cost | Why it matters                                                                       |
| --- | ------------------------------------------------------------------------------------- | --------------------------------------------------- | -------- | ---- | ------------------------------------------------------------------------------------ |
| 1   | Transition screens — resolution, required fields, comment-on-transition; discover via `?expand=transitions.fields` | extend `transition` + `transitions`                 | 1        | S    | Fixes the corruption bug; lets agents close issues correctly                         |
| 2   | Move project/type                                                                     | `jira move KEY --to-project X [--type Y]`            | 2        | L    | Headline ask. Async → forces the task-poll helper reused by all bulk ops             |
| 3   | Worklogs CRUD                                                                          | `jira worklog add/list/update/delete`               | 1        | M    | Time-tracking; ADF comment; agent-loggable                                           |
| 4   | Comment edit/delete + visibility                                                      | `jira comment edit/delete`, `--visibility`          | 1        | S    | Completes a half-built feature (only add+list today)                                 |
| 5   | Reparent / set-epic                                                                   | `jira update --parent PROJ-5` (+ `--clear-parent`)  | 1        | S    | `parent` is the canonical field (replaced Epic Link); trivial extension of `update`  |
| 6   | Bulk edit/transition/delete over JQL                                                  | `jira bulk <op> --jql "…"`                           | 2        | M    | Big agent leverage; reuses #2's async plumbing. Bulk-transition can't do field-requiring transitions |
| 7   | editmeta                                                                               | `jira editmeta KEY`                                 | 1        | S    | Makes `update` field-aware; parallels existing `fields` (createmeta)                 |
| 8   | Rank in backlog                                                                        | `jira rank KEY --above/--below KEY2`                | 3        | M    | Backlog grooming; needs Agile base path (max 50/req)                                 |
| 9   | Sprint ↔ backlog + board/sprint listing                                               | `jira sprint add/remove`, `jira boards/sprints`     | 3        | L    | Biggest new surface; overlaps the `pm` skill — coordinate, don't duplicate           |
| 10  | Watchers / Votes                                                                       | `jira watch/unwatch`, `jira vote`                   | 1        | S    | Cheap fill-ins; low leverage for a dev CLI                                           |

**The four "move" semantics resolved** (they span all three tiers — this is why "move" is not one feature):

- **Move project/type** → `POST /rest/api/3/bulk/issues/move` (async → poll `GET /rest/api/3/bulk/queue/{taskId}`). No single-issue move endpoint exists; even one issue goes through bulk.
- **Reparent** → `PUT /rest/api/3/issue/{key}` with `{ fields: { parent: { key } } }` (sync, trivial).
- **Rank** → `PUT /rest/agile/1.0/issue/rank` (Agile API, max 50).
- **Sprint ↔ backlog** → `POST /rest/agile/1.0/sprint/{id}/issue` and `POST /rest/agile/1.0/backlog/issue` (Agile API).
- **Recommendation:** `move` = the project/type wizard only; reparent folds into `update --parent`; rank/sprint get Agile-native verbs. One overloaded `move` verb would hide wildly different latency/failure modes.

## Capabilities

### New Capabilities

<!-- None. All new behavior extends the existing jira-command capability. -->

### Modified Capabilities

- `jira-command`: Adds transition-screen support (`--resolution`/`--comment`/`--field` on `transition`, screen discovery on `transitions`), `jira move`, `jira worklog`, comment `edit`/`delete` + `--visibility`, `update --parent`/`--clear-parent`, `jira bulk`, `jira editmeta`, `jira rank`, `jira sprint`/`boards`/`sprints`, and `jira watch`/`unwatch`/`vote`.

## Impact

- New client functions; a **reusable async bulk task-poller** (POST → taskId → poll `/bulk/queue/{taskId}`).
- A **second request base** for the Agile API — `jira/lib/client.ts` hardcodes `/rest/api/3` at the `request<T>` helper; tier 3 needs `/rest/agile/1.0`.
- New subcommands/flags; updates to `commands/jira.ts`, `commands/help.ts`, README, `.cspell.json`.
- ADF helper (`atlassian/lib/adf.ts` `textToAdf`) is reused for transition/worklog/comment bodies — no new ADF work.
- Coordinate with the `pm` skill on sprint overlap (tier 3).
- Affects only the Jira surface; Confluence/Bitbucket/Sonar/Jenkins untouched.
