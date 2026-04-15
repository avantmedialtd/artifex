## Context

The `af spec` command and its top-level shorthands (`af propose`, `af apply`, `af archive`) were added in October 2025 as thin wrappers around `claude /openspec:proposal`, `/openspec:apply`, and `/openspec:archive`. At the time, the auto-commit and interactive picker behavior they layered on top of Claude's slash commands was the primary value-add. Since then, two things have changed:

1. **Orchestration moved up.** The bundled workflow commands `/start-work` and `/complete-work` (in `setup/.claude/commands/`) now drive the OpenSpec lifecycle end-to-end. Neither references `af spec` — they invoke OpenSpec skills directly and produce richer git commits with structured trailers like `Issue=PROJ-123` and `OpenSpec-Id=<id>`.
2. **Skills moved down.** The OPSX skill family (`/opsx:new`, `/opsx:ff`, `/opsx:apply`, `/opsx:archive`, etc.) provides direct, first-class entry points to the same OpenSpec workflow that `af spec` shells out to.

The `af spec` commands are now a redundant middle layer. A grep across the bundled `setup/.claude/` directory confirms there are no internal callers. Keeping them costs ~265 lines of handler code, three dedicated test files, five capability directories under `openspec/specs/`, and a documentation section in `CLAUDE.md` — all of which would otherwise need to be maintained as the surrounding workflow evolves.

This change deletes that middle layer entirely.

## Goals / Non-Goals

**Goals:**
- Remove the `af spec` command namespace and its `propose`, `apply`, `archive` subcommands.
- Remove the top-level `af propose`, `af apply`, `af archive` shorthands.
- Delete all code, tests, and capability specs that exist solely to support those commands.
- Leave the rest of the `af` CLI (jira, confluence, jenkins, changes, setup, stop-hook, e2e, …) untouched.
- Leave shared utilities that have other consumers untouched (`utils/proposal.ts:getActiveChanges` stays for `af changes`).

**Non-Goals:**
- Provide a backward-compatibility shim or deprecation warning. The migration target (`/opsx:*` skills) already exists and is documented; an unknown-command error is acceptable.
- Modify the bundled `start-work` / `complete-work` slash commands. They already do not depend on `af spec`.
- Touch the VS Code extension. Its own `titleExtractor.ts` is independent of `utils/proposal.ts`.

## Decisions

### Decision 1: Delete, do not deprecate

The simplest path is to remove the routing branches and let unknown-command handling produce the standard error. Reasons:

- There are no external callers in the bundled setup files or skills. Anyone using the commands in personal scripts will get a clear "Unknown command" message and can move to `/opsx:*` directly.
- A deprecation warning would require keeping the handler code, tests, and specs alive for one more release cycle, which defeats the entire point of the change.
- Artifex follows a "no backwards-compatibility hacks" stance per `CLAUDE.md` ("Don't use feature flags or backwards-compatibility shims when you can just change the code").

**Alternative considered:** keep `af propose|apply|archive` as one-line aliases that delegate straight to `claude /opsx:new|apply|archive`. Rejected — the muscle-memory savings are not worth the maintenance cost, and the OPSX slash commands are easy enough to type directly.

### Decision 2: Delete the entire dependency tree, not just `commands/spec.ts`

Several files become orphaned once `commands/spec.ts` is gone:

- `utils/openspec.ts` — entire file (only consumer is `commands/spec.ts`)
- `utils/change-select-render.tsx` — entire file (only consumer is `commands/spec.ts`)
- `components/change-select.tsx` — entire file (only consumer is `change-select-render.tsx`)
- `utils/claude.ts` — entire file. The `getAgentCommand()` helper exists solely to let `commands/spec.ts` swap out the `claude` binary via the `ARTIFEX_AGENT` environment variable. With the spec handler gone, `utils/claude.test.ts` is the only remaining consumer — and it tests dead code. Both files are deleted, and the `ARTIFEX_AGENT` environment variable is removed from the user-facing surface.
- `utils/proposal.ts:extractProposalTitle` — converted from `export function` to a private function. Still used internally by `getActiveChanges`, so it cannot be deleted, but it should not remain part of the module's public API.
- `utils/proposal.ts:getLatestChangeId` — deleted (no internal consumers).

Deleting them in the same change keeps the diff coherent and avoids leaving dead code that has to be cleaned up later. The `utils/proposal.ts` file itself is preserved because `commands/changes.ts` still uses `getActiveChanges` and the `ActiveChange` interface.

**The `utils/claude.ts` cascade was discovered during the apply phase.** It was missed in the first pass of the design because the file lives outside `commands/` and `components/`. Surfacing it before any code edits and expanding scope to clean it up is preferable to landing a half-finished sweep and queuing a follow-up change.

**Alternative considered:** leave the orphaned utilities for a follow-up "dead code sweep" change. Rejected — the orphans are caused by this change and should be cleaned up by it. A separate change adds calendar overhead with no benefit.

### Decision 3: Delete five spec capability directories and amend a sixth

The five capabilities being removed (`spec-propose-cli`, `spec-apply-cli`, `spec-archive-cli`, `spec-archive-cli-optional-id`, `cli-command-shortcuts`) document behavior that no longer exists. Each gets a delta spec under `specs/<capability>/spec.md` containing `## REMOVED Requirements` for every requirement in the capability. When the change is archived, the OpenSpec tooling will delete the capability directories from `openspec/specs/`.

`spec-archive-cli-optional-id` is included even though its requirements partially overlap with `spec-archive-cli` (the optional-id behavior was originally added as a separate capability, then duplicated into `spec-archive-cli`). Removing both is correct because both directories exist in `openspec/specs/` today.

The sixth capability, `cli-modular-structure`, survives but needs surgery:

- `### Requirement: Modular command structure` has three scenarios (NPM, Spec, Versions) — only the **Spec commands in separate module** scenario is stale. MODIFIED with the spec scenario removed.
- `### Requirement: Shared utilities extraction` has only one scenario, and that scenario describes `utils/claude.ts`. With the file deleted, the scenario has nothing to verify. REMOVED.
- `### Requirement: Agent command configuration` is an entire requirement (seven scenarios) about `ARTIFEX_AGENT` semantics. REMOVED.

The other requirements in `cli-modular-structure` (`Command routing separation`, `Main entry point simplification`, `Command handler interface consistency`, `Backward compatibility maintained`) are unaffected.

### Decision 4: Trim shared test files rather than deleting them wholesale

`integration.test.ts` and `utils/proposal.test.ts` cover removed surface alongside other behavior. Approach:

- `spec-propose.test.ts`, `spec-apply.test.ts`, `spec-archive.test.ts` — delete entirely. Each file exists solely to test one of the removed handlers.
- `integration.test.ts` — delete only the `spec`/`propose`/`apply`/`archive` test cases, leaving the rest of the integration coverage intact.
- `utils/proposal.test.ts` — delete only the cases that exercise `extractProposalTitle` and `getLatestChangeId`. Keep cases for `getActiveChanges`. If no `getActiveChanges` cases exist today, delete the file.

The implementation step will determine the exact split when editing these files.

## Risks / Trade-offs

- **Risk:** A user has `af spec propose` (or a shorthand) in personal aliases or scripts and gets an "Unknown command" error after the next install.
  → **Mitigation:** The error message is clear and the migration target is well-documented in this proposal and design. The README/CLAUDE.md updates also signpost the replacement (`/opsx:new`, `/opsx:apply`, `/opsx:archive`). Artifex is a personal tool, so the blast radius is small.

- **Risk:** Trimming `integration.test.ts` accidentally removes a case that was actually covering non-spec behavior.
  → **Mitigation:** Edit case-by-case rather than bulk-delete; run the full test suite after each edit. The CI test command (`bun test`) is fast enough for tight feedback.

- **Risk:** `utils/proposal.test.ts` ends up empty after trimming.
  → **Mitigation:** Acceptable — delete the empty file. If `getActiveChanges` has no test coverage at all today, the test file's deletion is purely a cleanup.

- **Trade-off:** Users lose the muscle-memory `af propose "..."` ergonomics. This is the explicit cost of the change and is mitigated by the OPSX slash commands being equally short to type.

## Migration Plan

This change is implementation-only — no data migration, no deployment coordination, no rollback plan beyond `git revert`. The implementation order in `tasks.md` will:

1. Delete the spec deltas' worth of code and the orphaned utility files.
2. Edit `router.ts` and `commands/help.ts` to drop routing and help entries.
3. Delete the dedicated test files and trim the shared ones.
4. Update `CLAUDE.md` and `README.md`.
5. Run `bun run format`, `bun run lint`, `bun run spell:check`, and `bun test` to confirm the codebase is still healthy.
6. Run `openspec validate remove-spec-subcommands --strict` to confirm the change artifacts are valid.

Once merged and archived, the five capability directories under `openspec/specs/` are removed by the OpenSpec archive tooling.
