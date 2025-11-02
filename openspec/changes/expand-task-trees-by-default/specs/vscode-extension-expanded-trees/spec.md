# vscode-extension-expanded-trees Specification Delta

## MODIFIED Requirements

### Requirement: TreeView panel displays active changes

The extension MUST display all active OpenSpec changes in a tree view panel similar to the Problems panel, with tree items expanded by default for immediate visibility.

#### Scenario: Tree items are expanded by default

**Given** workspace has `openspec/changes/add-feature/tasks.md` with 2 sections and 5 tasks
**And** workspace has `openspec/changes/fix-bug/tasks.md` with 1 section and 3 tasks
**When** the OpenSpec Tasks panel is opened
**Then** all change items are expanded by default
**And** all section items under each change are expanded by default
**And** all tasks are immediately visible without requiring manual expansion

#### Scenario: Change items display as expanded

**Given** workspace has `openspec/changes/add-feature/tasks.md` with sections
**When** the tree view creates the change item
**Then** the change item has collapsible state set to `TreeItemCollapsibleState.Expanded`
**And** the change item's children (sections) are visible without clicking to expand

#### Scenario: Section items display as expanded

**Given** a change has a section "Implementation" with 3 tasks
**When** the tree view creates the section item
**Then** the section item has collapsible state set to `TreeItemCollapsibleState.Expanded`
**And** the section item's children (tasks) are visible without clicking to expand

#### Scenario: User can still collapse expanded items

**Given** the tree view shows expanded change and section items
**When** the user clicks the collapse icon on a change or section item
**Then** the item collapses as expected
**And** VSCode remembers the collapsed state
**And** the item remains collapsed on subsequent refreshes until the user expands it again

#### Scenario: Empty or error states remain non-collapsible

**Given** there are no active changes in the workspace
**When** the tree view displays "No active changes found"
**Then** the message item has collapsible state `TreeItemCollapsibleState.None`

**Given** an error occurs loading changes
**When** the tree view displays "Error loading changes"
**Then** the error item has collapsible state `TreeItemCollapsibleState.None`
