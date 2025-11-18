# Tasks

## Implementation

- [ ] Add "Copy Change ID" context menu contribution to package.json
  - Add new menu item under "view/item/context" for "openspecTasks" view
  - Set visibility condition to "viewItem == 'change'"
  - Use appropriate icon (e.g., "$(clippy)" or "$(copy)")
  - Specify command as "openspecTasks.copyChangeId"

- [ ] Register copyChangeId command in extension.ts
  - Create command handler that accepts changeId parameter
  - Use vscode.env.clipboard.writeText to copy change ID
  - Show success message with vscode.window.showInformationMessage
  - Handle clipboard errors with try-catch and show error message
  - Add command to context.subscriptions

- [ ] Update OpenSpecTaskItem to support context menu command invocation
  - Ensure ChangeData with changeId is accessible in tree item's data property
  - Verify contextValue is set to "change" for change-type items
  - Test that change ID can be extracted when context menu command is invoked

## Testing

- [ ] Test copy change ID from context menu
  - Right-click on a change item
  - Verify "Copy Change ID" appears in context menu
  - Click the menu item and verify change ID is in clipboard
  - Verify confirmation message appears

- [ ] Test context menu visibility
  - Verify "Copy Change ID" appears only for change items
  - Verify it does not appear for section or task items
  - Test with multiple changes to ensure correct ID is copied

- [ ] Test error handling
  - Simulate clipboard failure (if possible) and verify error message
  - Verify no unhandled exceptions occur

- [ ] Test existing copy title functionality
  - Click on a change item with a title
  - Verify title is still copied (not change ID)
  - Verify both copy title and copy change ID work independently

## Documentation

- [ ] Update vscode-extension README.md with copy change ID feature
  - Add description of context menu option
  - Include screenshot or example of usage
  - Explain difference between copy title and copy change ID
