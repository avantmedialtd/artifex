## 1. Types and Data Model

- [x] 1.1 Add `ArtifactStatus` interface to `types.ts` with `proposal: boolean`, `specs: string[]`, `design: boolean`, `tasks: boolean`
- [x] 1.2 Add `artifacts` field of type `ArtifactStatus` to `ChangeData` interface
- [x] 1.3 Add `'artifact'` to the `TreeItemType` union

## 2. Artifact Detection in Parser

- [x] 2.1 Add `detectArtifacts()` function to `taskParser.ts` that scans a change directory for proposal.md, design.md, specs/**/spec.md, and tasks.md
- [x] 2.2 Update `getChangeData()` to call `detectArtifacts()` and populate the new `artifacts` field
- [x] 2.3 Make `getChangeData()` work for changes with no tasks.md (return empty sections, 0/0 counts, but still populate artifacts and title)

## 3. Tree Provider Rewrite

- [x] 3.1 Add artifact node creation to `getChildren()` — when parent is a change, return four artifact nodes (Proposal, Specs, Design, Tasks) in fixed order instead of sections
- [x] 3.2 Implement present/absent artifact icons: `check` for present, `circle-outline` for absent
- [x] 3.3 Implement Proposal artifact node: leaf, click opens proposal.md when present
- [x] 3.4 Implement Design artifact node: leaf, click opens design.md when present
- [x] 3.5 Implement Specs artifact node: expandable container when specs exist, children are capability names that open their spec.md
- [x] 3.6 Implement Tasks artifact node: expandable when tasks.md exists, children are sections → tasks (preserve existing drill-down logic)
- [x] 3.7 Show task completion count in Tasks node label (e.g. "Tasks (3/5)") when tasks.md exists
- [x] 3.8 Make absent artifact nodes inert (no click command, not expandable)

## 4. Change Label and Badge

- [x] 4.1 Update change label format to `Title (change-id)` — remove task count from change label (moved to Tasks node)
- [x] 4.2 Fall back to just `change-id` when no proposal.md exists (no title available)
- [x] 4.3 Update `getActiveChangesWithUncheckedTasks()` to count a change as unfinished when tasks.md is absent or has unchecked tasks

## 5. File Watchers

- [x] 5.1 Add watcher for `openspec/changes/**/design.md` (create, change, delete)
- [x] 5.2 Add watcher for `openspec/changes/**/specs/**/*.md` (create, change, delete)
- [x] 5.3 Dispose new watchers properly in `disposeWatchersForFolder()` and `deactivate()`

## 6. Context Values and Commands

- [x] 6.1 Add context values for artifact nodes to support future context menu actions
- [x] 6.2 Update `openspec.openProposal` command to work from artifact node (currently wired to change node)
