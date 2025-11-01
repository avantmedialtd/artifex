# vscode-extension-badge Specification Delta

## MODIFIED Requirements

### Requirement: Extension badge displays completion percentage

The VSCode extension panel tab badge MUST display the completion percentage of tasks across all active changes instead of the unchecked task count.

#### Scenario: Badge shows completion percentage with active changes

**Given** workspace has 3 active changes
**And** there are 20 total tasks across all changes
**And** 15 tasks are completed
**When** the extension calculates the badge
**Then** the badge value is 75 (representing 75% completion)
**And** the badge tooltip shows "3 active changes, 75% complete (15/20 tasks)"

#### Scenario: Badge shows 0% for no completed tasks

**Given** workspace has 2 active changes
**And** there are 10 total tasks
**And** 0 tasks are completed
**When** the extension calculates the badge
**Then** the badge value is 0
**And** the badge tooltip shows "2 active changes, 0% complete (0/10 tasks)"

#### Scenario: Badge shows 100% for all completed tasks

**Given** workspace has 1 active change
**And** there are 8 total tasks
**And** all 8 tasks are completed
**When** the extension calculates the badge
**Then** the badge value is 100
**And** the badge tooltip shows "1 active change, 100% complete (8/8 tasks)"

#### Scenario: Badge hidden when no active changes

**Given** workspace has 0 active changes
**When** the extension calculates the badge
**Then** the badge is hidden (undefined)

#### Scenario: Badge hidden when no tasks exist

**Given** workspace has 1 active change
**And** there are 0 total tasks in the change
**When** the extension calculates the badge
**Then** the badge is hidden (undefined)

#### Scenario: Percentage rounds to nearest whole number

**Given** workspace has 1 active change
**And** there are 3 total tasks
**And** 2 tasks are completed
**When** the extension calculates the badge
**Then** the badge value is 67 (66.67% rounded to 67)
**And** the badge tooltip shows "1 active change, 67% complete (2/3 tasks)"
