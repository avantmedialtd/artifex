# Expose Bitbucket comment resolution and allow filtering by resolved state

## Why

`af bb pr comment list` already renders a thread's resolution state, but there is no way to narrow the output to just the resolved or just the unresolved threads — on a busy PR the reviewer must eyeball a long list to find what still needs attention. The sibling `pr task list` has the same gap: tasks already carry `RESOLVED`/`UNRESOLVED` state but the list can't be filtered by it. Adding a `--resolved` / `--unresolved` filter to both turns "what's still outstanding on this PR?" into a single command.

## What Changes

- Add `--resolved` and `--unresolved` filter flags to `af bb pr comment list <id>`.
    - Resolution is a **thread** property (only the top-level comment of a thread carries `resolution`), so filtering operates on whole threads by their root: `--resolved` keeps threads whose root is resolved (replies included), `--unresolved` keeps threads whose root is open. The rendered reply tree stays intact.
- Add matching `--resolved` and `--unresolved` filter flags to `af bb pr task list <id>`. Tasks carry per-task state, so filtering is a flat match on `state`.
- On both commands the two flags are mutually exclusive; supplying both prints an error and exits 1 (mirroring the existing `pr task update` behavior).
- The filter is applied before output rendering, so `--json` emits the filtered set too (scriptable).
- No new API calls or flags in the parser (`--resolved`/`--unresolved` are already parsed booleans); filtering is client-side over the already-drained page set.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `bitbucket-command`: the "Pull request comment listing and retrieval" and "Pull request task listing" requirements gain resolution-state filtering behavior.

## Impact

- `commands/bitbucket.ts` — read the filter flags in the `comment list` and `task list` cases; apply before the `json ? … : format` branch; reuse the existing mutual-exclusivity error.
- `bitbucket/lib/` — a new pure, unit-testable helper to filter comments into whole threads by their root's resolution state (the ancestor walk).
- Tests — helper unit tests plus command-level tests for both `comment list` and `task list`.
- Docs — the Bitbucket section of `CLAUDE.md` and the inline `pr comment list` / `pr task list` help text in `commands/bitbucket.ts`.
- No changes to `bitbucket/lib/client.ts` (no new endpoints) and no breaking changes.
