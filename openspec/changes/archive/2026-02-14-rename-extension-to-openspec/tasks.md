## 1. Extension Manifest (package.json)

- [x] 1.1 Rename `name` from `openspec-tasks` to `openspec`
- [x] 1.2 Rename `displayName` from `OpenSpec Tasks` to `OpenSpec`
- [x] 1.3 Update `description` to remove "Tasks" reference
- [x] 1.4 Rename view ID from `openspecTasks` to `openspecChanges` in `contributes.views`
- [x] 1.5 Update `configuration.title` from `OpenSpec Tasks` to `OpenSpec`
- [x] 1.6 Rename config key from `openspecTasks.autoCollapseCompletedSections` to `openspec.autoCollapseCompletedSections`
- [x] 1.7 Rename all command IDs from `openspecTasks.*` to `openspec.*` (refresh, openTaskLocation, openProposal, copyTitle, copyChangeId, applyChange, archiveChange)
- [x] 1.8 Update all menu `when` clauses from `view == openspecTasks` to `view == openspecChanges`
- [x] 1.9 Update `install-extension` script from `openspec-tasks-0.1.0.vsix` to `openspec-0.1.0.vsix`

## 2. Extension Source Code

- [x] 2.1 Update all command ID strings in `extension.ts` from `openspecTasks.*` to `openspec.*`
- [x] 2.2 Update `createTreeView` call to use `openspecChanges` instead of `openspecTasks`
- [x] 2.3 Update `getConfiguration('openspecTasks')` to `getConfiguration('openspec')` in `taskProvider.ts`
- [x] 2.4 Update console.log messages from "OpenSpec Tasks" to "OpenSpec"

## 3. Documentation

- [x] 3.1 Update `vscode-extension/README.md` title and references from "OpenSpec Tasks" to "OpenSpec"
- [x] 3.2 Update all `openspecTasks.*` setting/command references in README to `openspec.*`

## 4. Build Artifacts

- [x] 4.1 Rebuild VSIX package (produces `openspec-0.1.0.vsix` instead of `openspec-tasks-0.1.0.vsix`)
- [x] 4.2 Update VSIX filename comment in `scripts/generate-setup-manifest.ts`
- [x] 4.3 Regenerate setup manifest with `bun run generate:manifest`
