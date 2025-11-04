# Proposal: Show Change Title in VSCode Extension

## Why

The VSCode extension currently displays changes using only the `change-id` (e.g., "add-feature (2/5 tasks completed)"). This makes it difficult for developers to quickly understand what each change is about without opening the change folder or reading the proposal file. Developers must navigate to the proposal.md file to understand what a change does, which interrupts workflow and reduces productivity.

The CLI's auto-commit feature already has title extraction logic in `utils/proposal.ts` that reads the first line of `proposal.md` and extracts a clean title. This proven logic should be applied to the VSCode extension to provide human-readable titles and a consistent experience.

## What Changes

- **Add title extraction**: Create `vscode-extension/src/titleExtractor.ts` with `extractProposalTitle` function (mirroring CLI logic)
- **Extend ChangeData model**: Update `ChangeData` interface in `vscode-extension/src/types.ts` to include optional `title?: string` field
- **Parse and populate title**: Modify `vscode-extension/src/taskParser.ts` to extract title for each change and populate the ChangeData
- **Update tree view display**: Modify `OpenSpecTaskProvider` in `vscode-extension/src/taskProvider.ts` to show format: `"Title (change-id) - X/Y tasks completed"`
- **Add copy button**: Register command `openspecTasks.copyTitle` in `vscode-extension/src/extension.ts` that copies title to clipboard and add inline action button to change items

## Impact

- Affected specs: `vscode-extension` (enhanced with title display and copy functionality)
- Affected code:
    - `vscode-extension/src/types.ts` - ChangeData interface with title field
    - `vscode-extension/src/titleExtractor.ts` - New file with title extraction logic
    - `vscode-extension/src/taskParser.ts` - Title extraction and population
    - `vscode-extension/src/taskProvider.ts` - Tree view label formatting with title
    - `vscode-extension/src/extension.ts` - Copy title command registration
