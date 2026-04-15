## Context

`af commit` was introduced as a convenience wrapper over `git commit` with two subcommands:

- `af commit save "<msg>" [Key=Value...]` — stages all changes, commits with a message, and attaches trailers.
- `af commit apply [change-id]` — commits ongoing OpenSpec work with a generated `Apply: <Title>` message. Falls back to an interactive picker when multiple changes are in flight.

Three bundled Claude Code slash commands — `/commit-work`, `/complete-work`, `/work-auto` — invoke `af commit save` as their canonical "commit with trailers" step. No direct end-user callers exist outside these slash commands; there is no documentation in README or elsewhere telling humans to type `af commit`.

`git commit` itself has supported the `--trailer "Key=Value"` flag for years and does exactly what `af commit save` does. The wrapper exists mainly for symmetry with other `af ...` subcommands, not for any behavioral gap.

Four OpenSpec capabilities touch this area:

- `commit-command` — documents `af commit` / `af commit apply`
- `commit-save-subcommand` — documents `af commit save`
- `commit-work-command` — documents the `/commit-work` **slash command** (which currently wraps `af commit save`)
- `setup-command` — references `af commit save` in scenarios covering the bundled slash commands

This change mirrors the recent removal of `af licenses` (commit `500514e`), but has ~5x the surface area because the commit command has real downstream callers.

## Goals / Non-Goals

**Goals:**

- Remove `af commit` and every piece of code that exists solely to support it.
- Preserve exact commit-message and trailer behavior in the three workflow slash commands, so existing automated workflows (`/work-auto` loops, OpenSpec archival commits) continue producing identical git output.
- Retire the two commit-only spec capabilities (`commit-command`, `commit-save-subcommand`) cleanly, and update the two that survive (`commit-work-command`, `setup-command`).
- Leave `af commit` producing a clear "unknown command" error rather than a stub, matching the pattern set by the `af licenses` removal.

**Non-Goals:**

- Refactoring or renaming any other `af` command.
- Changing commit semantics (message format, trailer keys, staging behavior) anywhere.
- Providing a backwards-compatibility alias or deprecation shim. This is a hard removal.
- Touching the `utils/git.ts` helpers that other callers still rely on (`stageAndCommit`, `stageDirectory`, `hasChangesToCommit`, `createCommit`).

## Decisions

### Decision 1: Inline `git commit --trailer` into the slash command docs

**Choice:** Each of `/commit-work`, `/complete-work`, and `/work-auto` gets its commit step rewritten to invoke `git` directly, using one `--trailer "Key=Value"` flag per trailer.

**Replacement shape:**

```bash
git add -A
git commit -m "<message>" \
  --trailer "Issue=<issue-key>" \
  --trailer "OpenSpec-Id=<change-id>"
```

**Rationale:**

- Produces byte-identical commits to `af commit save` (same staging, same message, same trailers).
- Zero new abstractions to document or test — `git commit --trailer` is already table stakes knowledge for anyone reading these slash commands.
- Keeps the slash commands self-contained: no dependency on the `af` binary being present for the commit step (it's still needed for other steps like `af e2e`).

**Alternatives considered:**

- *Keep `af commit save` but rename it.* Rejected — doesn't solve the "why does this wrapper exist" question.
- *Move the helper into a shared script under `setup/`.* Rejected — just relocates the abstraction without shrinking it.
- *Have the slash commands invoke `git` via a shell function.* Rejected — shell functions don't survive across the three separate steps in `/work-auto`'s loop, and inlining is clearer.

### Decision 2: Retire `commit-command` and `commit-save-subcommand` as whole capabilities

**Choice:** Delete both `openspec/specs/commit-command/spec.md` and `openspec/specs/commit-save-subcommand/spec.md`. The delta specs for this change will express them as complete removals.

**Rationale:**

- Both capabilities exist only to describe behavior that is now gone. There is no residual behavior to spec.
- Matches the pattern for `af licenses`: the code went, the tests went, and there was no spec file to orphan. Here there are spec files, so they need explicit removal via delta.

**Alternatives considered:**

- *Keep the specs as historical reference.* Rejected — `openspec/changes/archive/` already serves that purpose. Live specs should reflect live behavior.

### Decision 3: Rewrite `commit-work-command` spec in-place, not retire it

**Choice:** The `commit-work-command` capability survives because it documents the `/commit-work` **slash command**, not the `af commit` CLI. Its delta spec rewrites every scenario that mentions `af commit save` to describe the new git-based commit step.

**Rationale:**

- The `/commit-work` slash command still exists and still has requirements worth specifying.
- Deleting the whole capability would orphan a user-facing feature that has documented behavior.

### Decision 4: Lock in the removal with an absence-assertion test

**Choice:** Replace `commit-apply.test.ts` with a small test that asserts `af commit` now returns a non-zero exit code and an unknown-command error, then add a similar assertion to `integration.test.ts` (mirroring how `500514e` handled `af licenses`).

**Rationale:**

- Prevents accidental resurrection of the command (e.g., a copy-paste from archive restoring an import in `router.ts`).
- Zero cost in CI; one assertion per entry point.

**Alternatives considered:**

- *Delete the test file entirely with no replacement.* Rejected — the `af licenses` removal added a regression test specifically to guard the absence of the command. Same pattern applies.

### Decision 5: Delete `utils/git.ts` helpers only if they have no other callers

**Choice:** Remove `stageAllAndCommit` and `stageAllAndCommitWithTrailers`. `parseTrailer` lives in `commands/spec.ts` and goes with its callers.

**Rationale:**

- Verified in explore mode: the only callers of these two helpers are `handleCommitApply` / `handleCommitSave` in `commands/spec.ts` and their own unit tests in `utils/git.test.ts`.
- Keeping dead utility functions around is worse than removing them — they tempt future callers to restore the command.

**Guard:** Implementation task must re-grep for callers right before deletion, in case any intervening work added a new consumer.

## Risks / Trade-offs

**[Risk] Workflow regression in `/work-auto` loops.** The three slash commands are the OpenSpec workflow's only documented commit path. A subtle difference between `af commit save` and `git commit --trailer` (e.g., argument quoting, empty-trailer handling, or staging edge cases) could silently break the automation loop.

→ **Mitigation:** Tasks include an explicit verification step for each rewritten slash command: commit a scratch change using the inlined git invocation, then inspect `git log -1 --format=%B` to confirm the message body and trailers match what `af commit save` produced previously. Capture a known-good output in the task notes.

**[Risk] The three slash commands are duplicated across `setup/.claude/`, `.claude/`, `.opencode/`, and `.github/`.** The `setup-command` capability copies files from `setup/` into `~/.claude/` at install time, but the in-repo `.claude/`, `.opencode/`, and `.github/` trees may also carry stale copies.

→ **Mitigation:** Grep for `af commit save` across the entire repo during implementation and rewrite every hit. Do not trust the four-path list from explore mode — verify fresh before editing.

**[Risk] Breaking hard-removal affects anyone with muscle memory.** A developer who types `af commit save ...` after the change will get an unknown-command error with no migration hint.

→ **Trade-off accepted.** The `af licenses` removal did the same thing, and the error message from the router (`Error: Unknown command: commit`) already points at `af help`. Adding a deprecation shim for muscle memory would defeat the point of the removal. Worth mentioning in the commit message so anyone who hits it can find the rewrite quickly via `git log --grep`.

**[Risk] `integration.test.ts` or other test files may reference `af commit`.** Only `commit-apply.test.ts` is known; there could be forgotten stragglers.

→ **Mitigation:** Tasks include a repo-wide grep for `af commit` and `handleCommit` before declaring the change complete.

## Migration Plan

Not applicable — this is a local CLI tool, not a deployed service. There is no rolling deployment, no feature flag, no backwards-compatibility window. The change lands as a single commit; anyone on the updated binary sees the removal immediately, and anyone on an older binary is unaffected until they upgrade.

**Rollback strategy:** If the rewritten slash commands turn out to have a defect, revert the single merge commit. The `openspec/changes/archive/` entry for this change will preserve the full before-and-after for reference.

## Open Questions

None. Scope was pinned down during explore mode and all four decision points were answered by the user before entering `/opsx:new`.
