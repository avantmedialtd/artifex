## MODIFIED Requirements

### Requirement: Apply command available for incomplete changes

The Apply context menu command MUST only be visible for changes that have at least one incomplete task.

#### Scenario: Apply command executes af spec apply

**Given** a change "add-feature" with incomplete tasks
**When** the user selects "Apply Change" from the context menu
**Then** a terminal opens and executes `af spec apply add-feature`
**And** the terminal auto-closes when the command completes successfully

### Requirement: Archive command available for complete changes

The Archive context menu command MUST only be visible for changes where all tasks are complete.

#### Scenario: Archive command executes af spec archive

**Given** a change "fix-bug" with all tasks complete
**When** the user selects "Archive Change" from the context menu
**Then** a terminal opens and executes `af spec archive fix-bug`
**And** the terminal auto-closes when the command completes successfully
