# Show Titles in Changes Command

## Why

The `zap changes` command currently displays only change IDs and task progress (e.g., `fix-extension-archive-refresh     3/8 tasks`). This requires developers to mentally map change IDs to what they're actually working on. The VSCode extension already shows titles extracted from `proposal.md`, providing a better UX. The CLI should offer the same clarity.

## What Changes

- Enhance `zap changes` to read each change's `proposal.md` and display the title before the change ID
- Reuse the existing `extractProposalTitle` utility from `utils/proposal.ts`
- Format output as: `Title (change-id)     N/M tasks` or fall back to current format if no title is available

## Impact

- Affected specs: `changes-command`
- Affected code: `commands/changes.ts`, potentially `utils/proposal.ts`
- No breaking changes - fallback behavior preserved when title extraction fails
