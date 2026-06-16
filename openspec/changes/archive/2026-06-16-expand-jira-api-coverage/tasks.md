# Tasks

This is a roadmap to pick slices from. Groups are ordered by leverage and dependency: the bug fix first, then cheap Tier-1 wins, then the shared async plumbing that unlocks the Tier-2 items, then standalone Tier-1 work, then the Tier-3 Agile surface, then optional fill-ins.

## 1. Transition-screen support (#1, Tier 1) — fixes the corruption bug

- [x] 1.1 Extend `transitions` to request `?expand=transitions.fields` and report each transition's `hasScreen` + required fields
- [x] 1.2 Add `--resolution`, `--comment`, and repeatable `--field <name>=<value>` flags to `af jira transition`
- [x] 1.3 Build the transition POST body with `transition` + `fields` + `update`, sending the comment as ADF under `update.comment` and never placing a field in both `fields` and `update`
- [x] 1.4 Retry on `409` (concurrent transition) with backoff
- [x] 1.5 Tests: transition-with-resolution sets Resolution; comment-on-transition emits ADF; screen discovery surfaces required fields
- [x] 1.6 Update `commands/help.ts` (README covered in the final docs pass) for the new transition flags

## 2. Cheap Tier-1 wins (batched)

- [x] 2.1 Reparent (#5): add `--parent <key>` to `af jira update`, sending `{ fields: { parent: { key } } }`
- [x] 2.2 Reparent (#5): add `--clear-parent` as provisional (attempt `parent: null`), guarded/documented as unverified
- [x] 2.3 Comment edit/delete (#4): add `af jira comment edit <id>` and `af jira comment delete <id>`
- [x] 2.4 Comment visibility (#4): add `--visibility <role-or-group>` to comment add/edit; branch to `/rest/servicedeskapi` for JSM internal notes (`--internal`/`--public`)
- [x] 2.5 editmeta (#7): add `af jira editmeta <key>` reporting editable fields + allowed values (parallel to existing `fields`)
- [x] 2.6 Tests for reparent set/clear, comment edit/delete, visibility, and editmeta rendering
- [x] 2.7 Update `commands/help.ts` (README covered in the final docs pass) for the new flags/subcommands

## 3. Async task-poller, then move (#2, Tier 2)

- [x] 3.1 Build a reusable async bulk task-poller: submit → capture `taskId` → poll `GET /rest/api/3/bulk/queue/{taskId}` to a terminal state, handling unknown/non-terminal statuses defensively
- [x] 3.2 Add `af jira move <key> --to-project <key> [--type <name>]` calling `POST /rest/api/3/bulk/issues/move`
- [x] 3.3 Build `targetToSourcesMapping` with the `"PROJECT-KEY,<issueTypeId>"` descriptor key and set/auto-suggest `inferStatusDefaults` (or an explicit `targetStatus` mapping)
- [x] 3.4 Tests: move polls the task to completion; cross-workflow move infers status defaults
- [x] 3.5 Update `commands/help.ts` (README covered in the final docs pass) for `move`

## 4. Bulk operations over JQL (#6, Tier 2) — reuses the poller

- [x] 4.1 Add `af jira bulk <edit|transition|delete> --jql "<query>"` resolving issues by JQL
- [x] 4.2 Chunk selections to ≤1,000 issues/request and serialize to ≤5 concurrent tasks
- [x] 4.3 Detect field-requiring transitions (via `transitions?expand=fields`) and refuse bulk-transition with a pointer to single-issue `transition`
- [x] 4.4 Tests: bulk transition polls; large selection chunks/serializes; field-requiring transition refused
- [x] 4.5 Update `commands/help.ts` (README covered in the final docs pass) for `bulk`

## 5. Worklogs (#3, Tier 1) — standalone

- [x] 5.1 Add `af jira worklog add/list/update/delete`
- [x] 5.2 Render worklog comments as ADF via the existing `textToAdf` helper
- [x] 5.3 Tests for add (time + ADF comment), list, update, delete
- [x] 5.4 Update `commands/help.ts` (README covered in the final docs pass) for `worklog`

## 6. Tier 3: Agile base path and verbs — coordinate with the `pm` skill

- [x] 6.1 Add a second request base for `/rest/agile/1.0` alongside the hardcoded `/rest/api/3` in `jira/lib/client.ts`
- [x] 6.2 Rank (#8): add `af jira rank <key> --above <key2> | --below <key2>` via `PUT /rest/agile/1.0/issue/rank` (respect the 50-issue limit)
- [x] 6.3 Sprint ↔ backlog (#9): add `af jira sprint add <key> --sprint <id>` and `af jira sprint remove <key>`
- [x] 6.4 Board/sprint listing (#9): add `af jira boards` and `af jira sprints --board <id>`
- [x] 6.5 Coordinate sprint ownership with the `pm` skill to avoid duplicating its planning logic (documented in design.md; no overlapping planning logic added)
- [x] 6.6 Tests for rank above/below, sprint add/remove, boards, and sprints listing
- [x] 6.7 Update `commands/help.ts` and `.cspell.json` for Agile terms (README covered in the final docs pass)

## 7. Watchers/votes (#10, Tier 1) — optional fill-ins

- [x] 7.1 Add `af jira watch <key>` and `af jira unwatch <key>`
- [x] 7.2 Add `af jira vote <key>`
- [x] 7.3 Tests for watch/unwatch/vote
- [x] 7.4 Update `commands/help.ts` (README covered in the final docs pass)

## 8. Cross-cutting docs and packaging

- [x] 8.1 Update the Jira section of `CLAUDE.md` with the new subcommands/flags (and the README Commands › Jira section)
- [x] 8.2 Add any new proper nouns/terms to `.cspell.json`
- [x] 8.3 Run `bun run format`, `bun run lint`, `bun run spell:check`, and `bun run test`
