# Proposal: Remove af spec Subcommands

## Why

The `af spec propose|apply|archive` subcommands and their top-level `propose|apply|archive` shorthands are now redundant. They are thin wrappers around `claude /openspec:*` slash commands whose only added value — auto-commit on success and an interactive picker — has been superseded by the OPSX skill workflow (`/opsx:new`, `/opsx:ff`, `/opsx:apply`, `/opsx:archive`) and by the bundled workflow commands (`/start-work`, `/complete-work`), neither of which call `af spec` at all. `/complete-work` even produces richer commits with structured trailers (`Issue=`, `OpenSpec-Id=`) that the `af spec archive` auto-commit cannot match. Keeping the dead surface area costs us code, tests, specs, and documentation that no one uses.

## What Changes

- **BREAKING**: Remove the `af spec` command and its `propose`, `apply`, `archive` subcommands.
- **BREAKING**: Remove the top-level shorthands `af propose`, `af apply`, `af archive`.
- **BREAKING**: Remove the `ARTIFEX_AGENT` environment variable. It existed solely to let `commands/spec.ts` swap out the `claude` binary; with the spec handler gone, no other code reads it.
- Delete the `commands/spec.ts` handler module and its supporting infrastructure: `utils/openspec.ts`, `utils/change-select-render.tsx`, `components/change-select.tsx`, `utils/claude.ts`, `utils/claude.test.ts`, and the `extractProposalTitle` / `getLatestChangeId` exports from `utils/proposal.ts` (the `getActiveChanges` export stays — `af changes` still uses it).
- Remove the spec-command routing branches and import from `router.ts`.
- Remove the spec-command help entries from `commands/help.ts`.
- Delete the dedicated tests `spec-propose.test.ts`, `spec-apply.test.ts`, `spec-archive.test.ts`, prune the affected cases from `integration.test.ts`, and trim `utils/proposal.test.ts` to whatever still applies to `getActiveChanges`.
- Remove the `spec-propose-cli`, `spec-apply-cli`, `spec-archive-cli`, `spec-archive-cli-optional-id`, and `cli-command-shortcuts` capability directories from `openspec/specs/`.
- Modify the `cli-modular-structure` capability to drop the `Spec commands in separate module` scenario and the entire `Shared utilities extraction` and `Agent command configuration` requirements (all of which are about pieces being deleted in this change).
- Strip the "OpenSpec Commands with Auto-Commit" and "Configurable Agent Command" sections from `CLAUDE.md`, and remove the OpenSpec command sections plus the "ARTIFEX_AGENT Environment Variable" section from `README.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `spec-propose-cli`: All requirements REMOVED — capability deleted entirely.
- `spec-apply-cli`: All requirements REMOVED — capability deleted entirely.
- `spec-archive-cli`: All requirements REMOVED — capability deleted entirely.
- `spec-archive-cli-optional-id`: All requirements REMOVED — capability deleted entirely.
- `cli-command-shortcuts`: All requirements REMOVED — capability deleted entirely.
- `cli-modular-structure`: `Modular command structure` MODIFIED to drop the spec-commands scenario; `Shared utilities extraction` REMOVED (the only scenario described `utils/claude.ts`, which is being deleted); `Agent command configuration` REMOVED (the entire requirement covers `ARTIFEX_AGENT`, which is being removed).

## Impact

- **CLI surface**: Six entry points removed (`af spec`, `af spec propose`, `af spec apply`, `af spec archive`, `af propose`, `af apply`, `af archive`). Users who still invoke them will get the standard "Unknown command" error and exit 1. Migration path is to use `/opsx:new`, `/opsx:apply`, `/opsx:archive`, or the bundled `/start-work` and `/complete-work` slash commands.
- **Environment**: The `ARTIFEX_AGENT` environment variable is no longer read by anything. Users who set it will see no effect.
- **Code**: ~265 lines deleted from `commands/spec.ts`, plus the utility, component, and `utils/claude.ts` modules; minor edits to `router.ts` and `commands/help.ts`.
- **Tests**: Three top-level test files removed (`spec-propose.test.ts`, `spec-apply.test.ts`, `spec-archive.test.ts`); `utils/claude.test.ts` and `utils/proposal.test.ts` removed or trimmed; `integration.test.ts` trimmed.
- **Specs**: Five capability directories deleted from `openspec/specs/`; `cli-modular-structure` updated.
- **Docs**: `CLAUDE.md` and `README.md` updated.
- **External dependencies**: None. No callers in the bundled `setup/.claude/` commands or skills.
