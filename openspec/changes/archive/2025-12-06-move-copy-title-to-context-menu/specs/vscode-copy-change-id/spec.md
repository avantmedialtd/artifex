## MODIFIED Requirements

### Requirement: Existing copy title functionality is preserved

The copy title command MUST be available via context menu on change items, and clicking a change item MUST open the proposal.md file.

#### Scenario: Copy title via context menu

**Given** a change with ID "update-docs" and title "Update API Documentation"
**When** the user right-clicks on the change item
**And** selects "Copy Title" from the context menu
**Then** "Update API Documentation" is copied to the clipboard
**And** a confirmation message "Copied: Update API Documentation" is shown

#### Scenario: Clicking change item opens proposal.md

**Given** a change with ID "update-docs" exists in the workspace
**When** the user clicks on the change item (not right-click)
**Then** the file `openspec/changes/update-docs/proposal.md` is opened in the editor

#### Scenario: Copy title not available for changes without titles

**Given** a change with ID "quick-fix" that has no title in proposal.md
**When** the user right-clicks on the change item
**Then** the "Copy Title" option is disabled or not shown

## ADDED Requirements

### Requirement: Context menu includes Copy Title for change items

The extension MUST provide a "Copy Title" context menu item for change items that have titles.

#### Scenario: Context menu shows Copy Title for changes with titles

**Given** the tree view displays a change with title "Add User Dashboard"
**When** the user right-clicks on the change item
**Then** the context menu contains "Copy Title" option
**And** the context menu also contains "Copy Change ID" option

#### Scenario: Copy Title command copies proposal title

**Given** a change tree item for "add-feature" with title "Add User Dashboard"
**When** the user clicks "Copy Title" from the context menu
**Then** the clipboard receives "Add User Dashboard"
**And** a confirmation message is shown

### Requirement: Click action opens proposal.md

Clicking on a change item MUST open the proposal.md file for that change in the editor.

#### Scenario: Click navigates to proposal.md

**Given** a change "add-feature" exists with a proposal.md file
**When** the user single-clicks on the change item in the tree view
**Then** the proposal.md file is opened in the editor
**And** the editor shows the contents of `openspec/changes/add-feature/proposal.md`

#### Scenario: Click on change without proposal.md shows error

**Given** a change "broken-change" exists without a proposal.md file
**When** the user single-clicks on the change item
**Then** an error message is shown indicating the proposal file was not found
