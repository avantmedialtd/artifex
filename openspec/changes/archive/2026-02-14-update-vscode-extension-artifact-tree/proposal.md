# Update VSCode Extension Artifact Tree

## Why

The VSCode extension was built when OpenSpec used a 3-phase model where `propose` produced all artifacts at once. The extension assumes a fully-formed change with `tasks.md` ready to parse. OpenSpec now uses an artifact-driven workflow where artifacts are created incrementally (proposal → specs → design → tasks). Changes can exist for extended periods with only a proposal and no tasks. The extension needs to show artifact progression as a first-class concept.

## What Changes

- Replace the flat task-only tree with an artifact-aware tree structure
- Show all four artifacts (proposal, specs, design, tasks) as children of each change, always in fixed order
- Infer artifact status from file existence: present = accessible/clickable, absent = shown but inert
- Display specs as a container node with individual spec files as children
- Preserve existing task drill-down (sections → checkboxes) under the tasks artifact node
- Update "finished" logic: a change is finished when `tasks.md` exists and all tasks are checked
- Update badge to count unfinished changes (catches changes with no artifacts, not just unchecked tasks)
- Expand file watchers to cover all artifact files (design.md, specs/**/*.md), not just tasks.md and proposal.md

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `vscode-extension`: Tree view structure changes from task-only to artifact-aware hierarchy; badge logic changes; file watcher coverage expands; activation no longer requires tasks.md

## Impact

- `vscode-extension/src/taskProvider.ts` - Major rewrite: new tree item types for artifacts, new tree hierarchy
- `vscode-extension/src/taskParser.ts` - Expand to detect all artifact files, not just tasks.md
- `vscode-extension/src/types.ts` - New types for artifact status and artifact tree items
- `vscode-extension/src/extension.ts` - Expand file watchers to cover all artifact files
- `vscode-extension/package.json` - May need new context value patterns for artifact nodes
