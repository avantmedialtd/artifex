# Capability: vscode-extension

VSCode extension for monitoring OpenSpec change tasks in a dedicated panel.

## ADDED Requirements

### Requirement: Extension manifest and structure

The extension MUST have a valid VSCode extension structure with proper manifest configuration.

#### Scenario: Developer opens workspace with extension installed

**Given** the extension is installed in VSCode  
**And** a workspace is opened  
**When** the workspace contains an `openspec/changes` directory  
**Then** the extension activates automatically  
**And** the "OpenSpec Tasks" panel appears in the panel area

#### Scenario: Extension manifest defines correct metadata

**Given** the extension package.json exists at `vscode-extension/package.json`  
**When** the manifest is read  
**Then** it contains required fields: name, displayName, description, version, engines  
**And** the engines.vscode specifies minimum version "^1.85.0"  
**And** activationEvents includes "workspaceContains:**/openspec/changes"

### Requirement: TreeView panel displays active changes

The extension MUST display all active OpenSpec changes in a tree view panel similar to the Problems panel.

#### Scenario: Panel shows active changes with progress

**Given** workspace has `openspec/changes/add-feature/tasks.md` with 5 tasks (2 completed)  
**And** workspace has `openspec/changes/fix-bug/tasks.md` with 3 tasks (1 completed)  
**When** the OpenSpec Tasks panel is opened  
**Then** the panel shows two root items:
- "add-feature (2/5 tasks completed)"
- "fix-bug (1/3 tasks completed)"

#### Scenario: Panel excludes archived changes

**Given** workspace has `openspec/changes/old-change/tasks.md`  
**And** workspace has `openspec/changes/archive/archived-change/tasks.md`  
**When** the OpenSpec Tasks panel is opened  
**Then** only "old-change" is displayed  
**And** "archived-change" is not displayed

#### Scenario: Panel shows hierarchical structure

**Given** a change with tasks.md containing:
```markdown
## Implementation Tasks
- [ ] Task 1
- [x] Task 2

## Testing Tasks
- [ ] Task 3
```
**When** the change item is expanded  
**Then** two section items are shown: "Implementation Tasks" and "Testing Tasks"  
**When** a section is expanded  
**Then** the tasks under that section are displayed with completion status

### Requirement: Task completion visual indicators

Tasks MUST display clear visual indicators for completion status.

#### Scenario: Completed tasks show check icon

**Given** a task `- [x] Write tests`  
**When** the task is displayed in the tree view  
**Then** it shows a check icon (☑) next to "Write tests"

#### Scenario: Uncompleted tasks show empty icon

**Given** a task `- [ ] Add documentation`  
**When** the task is displayed in the tree view  
**Then** it shows an empty circle icon (☐) next to "Add documentation"

### Requirement: Badge displays unchecked task count

The panel MUST show a badge with the count of unchecked tasks when the count is greater than zero.

#### Scenario: Badge shows total unchecked count

**Given** change "add-feature" has 3 unchecked tasks  
**And** change "fix-bug" has 2 unchecked tasks  
**When** the OpenSpec Tasks panel is visible  
**Then** the panel badge displays "5"  
**And** the badge tooltip reads "5 unchecked tasks"

#### Scenario: Badge hidden when all tasks complete

**Given** all changes have all tasks marked as completed  
**When** the OpenSpec Tasks panel is visible  
**Then** no badge is displayed

#### Scenario: Badge updates when task status changes

**Given** the panel badge shows "5"  
**When** a task is marked as completed in tasks.md  
**Then** the badge updates to show "4"

### Requirement: Real-time file system monitoring

The extension MUST automatically refresh when tasks.md files change.

#### Scenario: Panel refreshes when tasks.md modified

**Given** the panel is displaying tasks  
**When** a tasks.md file is modified  
**Then** the panel refreshes within 200ms  
**And** the updated task status is displayed  
**And** the badge count updates if unchecked count changed

#### Scenario: Refresh is debounced for multiple rapid changes

**Given** the file system watcher is active  
**When** tasks.md is modified 5 times within 50ms  
**Then** only one refresh occurs after the last change  
**And** the refresh delay is approximately 100ms from the last change

#### Scenario: Watcher ignores archived changes

**Given** file watcher is monitoring openspec/changes  
**When** a file in `openspec/changes/archive/` is modified  
**Then** no refresh is triggered  
**And** the panel content remains unchanged

### Requirement: Error handling and graceful degradation

The extension MUST handle missing or malformed files without crashing.

#### Scenario: No openspec directory in workspace

**Given** workspace does not contain `openspec/changes` directory  
**When** VSCode opens the workspace  
**Then** the extension does not activate  
**And** no errors are shown to the user

#### Scenario: Empty changes directory

**Given** workspace has `openspec/changes/` but no subdirectories  
**When** the OpenSpec Tasks panel is opened  
**Then** the panel shows message "No active changes found"  
**And** no badge is displayed

#### Scenario: Malformed tasks.md file

**Given** a change has tasks.md with invalid markdown  
**When** the extension parses the file  
**Then** the change is skipped with a logged warning  
**And** other changes continue to display normally  
**And** the extension does not crash

#### Scenario: File read permission error

**Given** a tasks.md file exists but cannot be read (permissions)  
**When** the extension attempts to read the file  
**Then** an error is logged to the output channel  
**And** the change shows with "(error reading tasks)"  
**And** other changes display normally

### Requirement: Extension directory structure

The extension MUST be organized in a dedicated directory with proper TypeScript configuration.

#### Scenario: Extension files in vscode-extension directory

**Given** the zap repository root  
**When** checking for extension files  
**Then** a `vscode-extension/` directory exists  
**And** it contains `src/extension.ts` as entry point  
**And** it contains `package.json` with extension manifest  
**And** it contains `tsconfig.json` for TypeScript configuration  
**And** it contains `README.md` with extension documentation

#### Scenario: TypeScript compilation configuration

**Given** the extension has a tsconfig.json  
**When** the configuration is read  
**Then** it targets ES2022 or later  
**And** module is set to "commonjs" (VSCode requirement)  
**And** outDir is set to "out/"  
**And** it includes "src/**/*.ts"  
**And** it references "@types/vscode" and "@types/node"

### Requirement: Task parser implementation

The extension MUST parse tasks.md files following the same format as zap CLI commands.

#### Scenario: Parse sections from markdown headers

**Given** a tasks.md file with content:
```markdown
## Section 1
- [ ] Task A

## Section 2
- [x] Task B
```
**When** the parser processes the file  
**Then** two sections are extracted: "Section 1" and "Section 2"  
**And** "Section 1" contains Task A (uncompleted)  
**And** "Section 2" contains Task B (completed)

#### Scenario: Parse task completion status

**Given** tasks with checkboxes `- [ ]`, `- [x]`, `- [X]`  
**When** the parser processes each task  
**Then** `- [ ]` is marked as uncompleted  
**And** `- [x]` is marked as completed  
**And** `- [X]` is marked as completed (case-insensitive)

#### Scenario: Calculate completion counts

**Given** a tasks.md with 5 tasks (2 marked completed)  
**When** the parser processes the file  
**Then** totalTasks is 5  
**And** completedTasks is 2  
**And** uncheckedTasks is 3

### Requirement: Performance and efficiency

The extension MUST have minimal performance impact on VSCode.

#### Scenario: Extension activation is fast

**Given** a workspace with 10 active changes  
**When** VSCode opens the workspace  
**Then** extension activation completes within 500ms  
**And** the panel is ready to display within 1 second

#### Scenario: File parsing is efficient

**Given** a tasks.md file with 100 tasks  
**When** the parser processes the file  
**Then** parsing completes within 50ms

#### Scenario: Memory usage is reasonable

**Given** the extension is active with 20 changes  
**When** monitoring memory usage  
**Then** extension memory footprint is less than 10MB

### Requirement: Generic OpenSpec project support

The extension MUST work with any project using OpenSpec conventions, not just the zap project.

#### Scenario: Works in any workspace with OpenSpec structure

**Given** a workspace named "my-project"  
**And** it has `openspec/changes/` directory  
**And** changes contain tasks.md files  
**When** VSCode opens the workspace  
**Then** the extension activates and displays tasks  
**And** all features work identically to the zap project

#### Scenario: Extension name and branding are generic

**Given** the extension manifest  
**When** viewing the extension details  
**Then** displayName is "OpenSpec Tasks" (not "Zap Tasks")  
**And** description mentions "OpenSpec" not "zap"  
**And** no zap-specific terminology is used in the UI
