# Tasks

## Configuration Setup

- [ ] Add `openspecTasks.autoCollapseCompletedSections` boolean setting to `vscode-extension/package.json` contributes.configuration section
- [ ] Set default value to `false` (opt-in behavior to avoid surprising existing users)
- [ ] Add description: "Automatically collapse task sections where all todos are checked"

## Tree Provider Logic

- [ ] Update `taskProvider.ts` to read the `autoCollapseCompletedSections` setting
- [ ] Add helper method `isSectionFullyCompleted(section: Section): boolean` to check if all tasks in a section are completed
- [ ] Modify section tree item creation in `getChildren()` to conditionally set `TreeItemCollapsibleState.Collapsed` when setting is enabled and section is fully completed
- [ ] Ensure sections with unchecked tasks always expand regardless of setting
- [ ] Handle edge case where a section has zero tasks (should not be considered "fully completed")

## Testing

- [ ] Test with setting enabled: verify completed sections collapse on load
- [ ] Test with setting disabled: verify completed sections expand normally
- [ ] Test mixed sections: verify only fully completed sections collapse
- [ ] Test toggling the setting: verify tree view refreshes appropriately
- [ ] Test sections with no tasks: verify they don't get collapsed incorrectly

## Documentation

- [ ] Update `vscode-extension/README.md` to document the new setting
- [ ] Add example configuration snippet showing how to enable the feature
