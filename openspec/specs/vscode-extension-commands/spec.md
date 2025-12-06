# vscode-extension-commands Specification

## Purpose
TBD - created by archiving change vscode-extension-apply-archive-commands. Update Purpose after archive.
## Requirements
### Requirement: Apply command available for incomplete changes

The Apply context menu command MUST only be visible for changes that have at least one incomplete task.

#### Scenario: Apply command shown for change with incomplete tasks

**Given** a change "add-feature" with 3 total tasks and 1 completed task
**When** the user right-clicks on "add-feature" in the Changes panel
**Then** the context menu shows "Apply Change" option

#### Scenario: Apply command hidden for fully complete change

**Given** a change "fix-bug" with 3 total tasks and 3 completed tasks
**When** the user right-clicks on "fix-bug" in the Changes panel
**Then** the context menu does NOT show "Apply Change" option

#### Scenario: Apply command executes zap apply

**Given** a change "add-feature" with incomplete tasks
**When** the user selects "Apply Change" from the context menu
**Then** a terminal opens and executes `zap apply add-feature`
**And** the terminal auto-closes when the command completes successfully

### Requirement: Archive command available for complete changes

The Archive context menu command MUST only be visible for changes where all tasks are complete.

#### Scenario: Archive command shown for fully complete change

**Given** a change "fix-bug" with 3 total tasks and 3 completed tasks
**When** the user right-clicks on "fix-bug" in the Changes panel
**Then** the context menu shows "Archive Change" option

#### Scenario: Archive command hidden for incomplete change

**Given** a change "add-feature" with 3 total tasks and 1 completed task
**When** the user right-clicks on "add-feature" in the Changes panel
**Then** the context menu does NOT show "Archive Change" option

#### Scenario: Archive command executes zap archive

**Given** a change "fix-bug" with all tasks complete
**When** the user selects "Archive Change" from the context menu
**Then** a terminal opens and executes `zap archive fix-bug`
**And** the terminal auto-closes when the command completes successfully

### Requirement: Terminal stays open on command failure

When a command fails, the terminal MUST remain open so users can see error messages.

#### Scenario: Terminal stays open on apply failure

**Given** a change "broken-change" that causes `zap apply` to fail
**When** the user selects "Apply Change" from the context menu
**And** the command exits with a non-zero status
**Then** the terminal remains open
**And** the error message is visible to the user

### Requirement: Context value encodes completion status

The tree item contextValue MUST encode both completion status and title presence for menu visibility filtering.

#### Scenario: Incomplete change without title

**Given** a change with incomplete tasks and no title in proposal.md
**When** the tree item is created
**Then** the contextValue is "change-incomplete"

#### Scenario: Incomplete change with title

**Given** a change with incomplete tasks and a title in proposal.md
**When** the tree item is created
**Then** the contextValue is "change-incomplete-with-title"

#### Scenario: Complete change without title

**Given** a change with all tasks complete and no title in proposal.md
**When** the tree item is created
**Then** the contextValue is "change-complete"

#### Scenario: Complete change with title

**Given** a change with all tasks complete and a title in proposal.md
**When** the tree item is created
**Then** the contextValue is "change-complete-with-title"

