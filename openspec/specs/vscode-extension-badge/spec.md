# vscode-extension-badge Specification

## Purpose
TBD - created by archiving change change-vscode-badge-to-percentage. Update Purpose after archive.
## Requirements
### Requirement: Extension badge displays count of active changes with unchecked tasks

The VSCode extension panel tab badge MUST display the count of active changes that have at least one unchecked task.

#### Scenario: Badge shows count of changes with unchecked tasks

**Given** workspace has 3 active changes
**And** change "add-feature" has 5 tasks (2 completed, 3 unchecked)
**And** change "fix-bug" has 3 tasks (1 completed, 2 unchecked)
**And** change "update-docs" has 4 tasks (4 completed, 0 unchecked)
**When** the extension calculates the badge
**Then** the badge value is 2 (two changes with unchecked tasks)
**And** the badge tooltip shows "2 active change(s) with unchecked tasks"

#### Scenario: Badge shows count when all changes have unchecked tasks

**Given** workspace has 3 active changes
**And** each change has at least one unchecked task
**When** the extension calculates the badge
**Then** the badge value is 3
**And** the badge tooltip shows "3 active change(s) with unchecked tasks"

#### Scenario: Badge hidden when all tasks are complete

**Given** workspace has 2 active changes
**And** all tasks in all changes are completed
**When** the extension calculates the badge
**Then** the badge is hidden (undefined)

#### Scenario: Badge hidden when no active changes

**Given** workspace has 0 active changes
**When** the extension calculates the badge
**Then** the badge is hidden (undefined)

#### Scenario: Badge hidden when no tasks exist

**Given** workspace has 1 active change
**And** there are 0 total tasks in the change
**When** the extension calculates the badge
**Then** the badge is hidden (undefined)

#### Scenario: Badge shows 1 for single change with unchecked tasks

**Given** workspace has 1 active change
**And** the change has 3 total tasks
**And** 2 tasks are completed
**When** the extension calculates the badge
**Then** the badge value is 1
**And** the badge tooltip shows "1 active change(s) with unchecked tasks"

