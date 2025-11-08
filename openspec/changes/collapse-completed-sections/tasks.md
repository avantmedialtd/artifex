# Tasks

## Configuration Setup

- [x] Add `openspecTasks.autoCollapseCompletedSections` boolean setting to `vscode-extension/package.json` contributes.configuration section
- [x] Set default value to `false` (opt-in behavior to avoid surprising existing users)
- [x] Add description: "Automatically collapse task sections where all todos are checked"

## Tree Provider Logic

- [x] Update `taskProvider.ts` to read the `autoCollapseCompletedSections` setting
- [x] Add helper method `isSectionFullyCompleted(section: Section): boolean` to check if all tasks in a section are completed
- [x] Modify section tree item creation in `getChildren()` to conditionally set `TreeItemCollapsibleState.Collapsed` when setting is enabled and section is fully completed
- [x] Ensure sections with unchecked tasks always expand regardless of setting
- [x] Handle edge case where a section has zero tasks (should not be considered "fully completed")

## Testing

- [x] Test with setting enabled: verify completed sections collapse on load
- [x] Test with setting disabled: verify completed sections expand normally
- [x] Test mixed sections: verify only fully completed sections collapse
- [x] Test toggling the setting: verify tree view refreshes appropriately
- [x] Test sections with no tasks: verify they don't get collapsed incorrectly

## Documentation

- [x] Update `vscode-extension/README.md` to document the new setting
- [x] Add example configuration snippet showing how to enable the feature
