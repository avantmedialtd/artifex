# task-navigation Specification Delta

## ADDED Requirements

### Requirement: Track line numbers during task parsing

The task parser MUST capture and store the line number where each task checkbox appears in the `tasks.md` file.

#### Scenario: Parse task with line number

**Given** a `tasks.md` file contains the following content:
```markdown
## Implementation Tasks

- [ ] Update parser
- [x] Add tests
```
**And** the "Update parser" task appears on line 3 (1-indexed)
**When** the parser processes the file
**Then** the task data includes `lineNumber: 3`
**And** the line number is 1-indexed to match VSCode's editor line numbering

#### Scenario: Handle tasks without line numbers gracefully

**Given** a task object is created without a line number (backwards compatibility)
**When** the task is displayed in the tree view
**Then** it appears normally without click navigation
**And** clicking on it has no effect (no error occurs)

### Requirement: Task data model includes line numbers

The `Task` interface MUST include an optional `lineNumber` field to support navigation.

#### Scenario: Task interface defines lineNumber field

**Given** the `Task` interface in `types.ts`
**When** the interface definition is reviewed
**Then** it includes an optional `lineNumber?: number` field
**And** the field is optional to maintain backwards compatibility
**And** the line number is 1-indexed when present

### Requirement: VSCode command for task navigation

The extension MUST register a command that opens a `tasks.md` file at a specific line number.

#### Scenario: Command opens file at specified line

**Given** a task is located at line 5 in `openspec/changes/add-feature/tasks.md`
**When** the navigation command is invoked with the file path and line number
**Then** VSCode opens the file in the editor
**And** the cursor is positioned at line 5
**And** the line is scrolled into view if needed

#### Scenario: Command handles missing files gracefully

**Given** the navigation command is invoked for a non-existent file
**When** the command executes
**Then** VSCode displays an error message like "Could not open file"
**And** the extension does not crash
**And** other tasks remain clickable

### Requirement: Tasks are clickable in tree view

Task tree items MUST be clickable and execute the navigation command when clicked.

#### Scenario: Clicking task opens file at correct line

**Given** the OpenSpec Tasks panel displays a task from line 8 of `tasks.md`
**When** the user clicks on the task item
**Then** the file opens in the editor
**And** the cursor jumps to line 8
**And** the panel remains open (does not close)

#### Scenario: Clicking task without line number does nothing

**Given** a task tree item does not have a line number (backwards compatibility case)
**When** the user clicks on the task item
**Then** no action occurs
**And** no error message is displayed
**And** the task remains visible in the panel

#### Scenario: Clicking change or section items has no effect

**Given** the tree view displays change and section items (parent nodes)
**When** the user clicks on a change or section item
**Then** it expands or collapses as normal
**And** no file navigation occurs
**And** only task items (leaf nodes) trigger navigation

### Requirement: Navigation command integration

The navigation command MUST be properly registered and integrated with the extension lifecycle.

#### Scenario: Command is registered on activation

**Given** the extension activates in a workspace with OpenSpec changes
**When** the extension initialization completes
**Then** the command `openspecTasks.openTaskLocation` (or similar) is registered
**And** the command is available for task tree items to invoke
**And** the command is added to context subscriptions for proper cleanup

#### Scenario: Command is disposed on deactivation

**Given** the extension is active with the navigation command registered
**When** the extension deactivates
**Then** the command is properly disposed
**And** no memory leaks occur
**And** cleanup happens before extension shutdown completes

### Requirement: Preserve existing tree view behavior

The click navigation feature MUST NOT break existing tree view functionality.

#### Scenario: Tree expansion and collapse still works

**Given** the tree view displays changes and sections
**When** the user clicks on a change or section to expand/collapse
**Then** the tree expands or collapses as expected
**And** the click-to-navigate feature does not interfere
**And** child items appear/disappear correctly

#### Scenario: Checkbox icons remain visible

**Given** tasks are displayed with checkbox icons (☐ and ☑)
**When** the click navigation is added
**Then** the checkbox icons still appear correctly
**And** the task text is still readable
**And** visual formatting is unchanged

#### Scenario: Task completion state is still visible

**Given** tasks have different completion states (completed/uncompleted)
**When** displayed in the tree view with click navigation
**Then** completed tasks still show ☑ icon
**And** unchecked tasks still show ☐ icon
**And** the visual distinction remains clear
