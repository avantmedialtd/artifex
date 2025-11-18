# vscode-copy-change-id Specification

## Purpose
TBD - created by archiving change vscode-copy-change-id-button. Update Purpose after archive.
## Requirements
### Requirement: Copy change ID command registration

The extension MUST register a command that copies a change ID to the clipboard.

#### Scenario: Command is registered in extension activation

**Given** the extension activates successfully
**When** the extension initialization completes
**Then** a command "openspecTasks.copyChangeId" is registered
**And** the command accepts a change ID string as an argument
**And** the command is added to the extension's subscriptions

#### Scenario: Command copies change ID to clipboard

**Given** a change with ID "add-feature" exists in the workspace
**When** the "openspecTasks.copyChangeId" command is invoked with "add-feature"
**Then** the string "add-feature" is written to the system clipboard
**And** a confirmation message "Copied: add-feature" is shown to the user

#### Scenario: Command handles clipboard errors gracefully

**Given** the clipboard is unavailable or write fails
**When** the "openspecTasks.copyChangeId" command is invoked
**Then** an error message "Failed to copy change ID: <error>" is shown to the user
**And** the command completes without throwing an unhandled exception

### Requirement: Context menu integration for change items

The extension MUST provide a context menu item for copying change IDs that appears when right-clicking on change tree items.

#### Scenario: Context menu item appears for change items

**Given** the tree view displays a change "add-feature (3/5 tasks completed)"
**When** the user right-clicks on the change item
**Then** a context menu appears
**And** the menu contains an item labeled "Copy Change ID"
**And** the "Copy Change ID" option is enabled

#### Scenario: Context menu item does not appear for non-change items

**Given** the tree view displays a section item under a change
**When** the user right-clicks on the section item
**Then** the context menu does not contain "Copy Change ID"
**And** only context menu items appropriate for sections are shown

#### Scenario: Context menu item does not appear for task items

**Given** the tree view displays a task item under a section
**When** the user right-clicks on the task item
**Then** the context menu does not contain "Copy Change ID"
**And** only context menu items appropriate for tasks are shown

### Requirement: Change tree item includes change ID in metadata

Change tree items MUST store the change ID in a way that can be passed to the copy command.

#### Scenario: Change tree item stores change ID

**Given** a change with ID "fix-bug" and title "Fix Authentication Bug"
**When** the tree item is created for this change
**Then** the tree item's data property contains the ChangeData object
**And** the ChangeData object includes the changeId field with value "fix-bug"
**And** the change ID can be extracted for command invocation

#### Scenario: Change tree item with context menu passes change ID to command

**Given** a change tree item for "add-feature" with title "Add User Dashboard"
**When** the user clicks "Copy Change ID" from the context menu
**Then** the "openspecTasks.copyChangeId" command is invoked with "add-feature"
**And** the clipboard receives "add-feature" (not the full label text)

### Requirement: Package.json includes context menu contribution

The extension manifest MUST define the context menu contribution for the copy change ID command.

#### Scenario: Context menu contribution is defined

**Given** the extension's package.json file
**When** the "contributes.menus" section is examined
**Then** it includes a "view/item/context" menu definition
**And** the menu includes a command "openspecTasks.copyChangeId"
**And** the command is only visible when "viewItem == 'change'"
**And** the menu item has an appropriate label like "Copy Change ID"

#### Scenario: Context menu contribution uses appropriate icon

**Given** the context menu contribution for copy change ID
**When** the menu definition is examined
**Then** the menu item includes an icon (e.g., "$(clippy)" or "$(copy)")
**Or** no icon is specified and the default clipboard icon is used

### Requirement: Existing copy title functionality is preserved

The new copy change ID command MUST NOT interfere with the existing copy title functionality.

#### Scenario: Copy title command still works for changes with titles

**Given** a change with ID "update-docs" and title "Update API Documentation"
**When** the user clicks on the change item (not right-click)
**Then** the "openspecTasks.copyTitle" command is invoked
**And** "Update API Documentation" is copied to the clipboard
**And** a confirmation message "Copied: Update API Documentation" is shown

#### Scenario: Both copy commands are available independently

**Given** a change with both ID and title
**When** the user examines available actions
**Then** clicking the item copies the title
**And** right-clicking and selecting "Copy Change ID" copies the change ID
**And** both actions work correctly without conflicts

