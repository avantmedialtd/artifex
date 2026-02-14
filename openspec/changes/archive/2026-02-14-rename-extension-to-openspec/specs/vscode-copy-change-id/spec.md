## MODIFIED Requirements

### Requirement: Copy change ID command registration

The extension MUST register a command that copies a change ID to the clipboard.

#### Scenario: Command is registered in extension activation

**Given** the extension activates successfully
**When** the extension initialization completes
**Then** a command "openspec.copyChangeId" is registered
**And** the command accepts a change ID string as an argument
**And** the command is added to the extension's subscriptions

#### Scenario: Command copies change ID to clipboard

**Given** a change with ID "add-feature" exists in the workspace
**When** the "openspec.copyChangeId" command is invoked with "add-feature"
**Then** the string "add-feature" is written to the system clipboard
**And** a confirmation message "Copied: add-feature" is shown to the user

#### Scenario: Command handles clipboard errors gracefully

**Given** the clipboard is unavailable or write fails
**When** the "openspec.copyChangeId" command is invoked
**Then** an error message "Failed to copy change ID: <error>" is shown to the user
**And** the command completes without throwing an unhandled exception

### Requirement: Package.json includes context menu contribution

The extension manifest MUST define the context menu contribution for the copy change ID command.

#### Scenario: Context menu contribution is defined

**Given** the extension's package.json file
**When** the "contributes.menus" section is examined
**Then** it includes a "view/item/context" menu definition
**And** the menu includes a command "openspec.copyChangeId"
**And** the command is only visible when "viewItem == 'change'"
**And** the menu item has an appropriate label like "Copy Change ID"
