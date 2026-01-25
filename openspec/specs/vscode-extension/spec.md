# vscode-extension Specification

## Purpose
TBD - created by archiving change add-vscode-extension. Update Purpose after archive.
## Requirements
### Requirement: Extension manifest and structure

The extension MUST have a valid VSCode extension structure with proper manifest configuration.

#### Scenario: Developer opens workspace with extension installed

**Given** the extension is installed in VSCode
**And** a workspace is opened
**When** any workspace folder contains an `openspec/changes` directory
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

#### Scenario: Panel excludes archived changes

**Given** workspace has `openspec/changes/old-change/tasks.md`
**And** workspace has `openspec/changes/archive/archived-change/tasks.md`
**When** the OpenSpec Tasks panel is opened
**Then** only "old-change" is displayed
**And** "archived-change" is not displayed

#### Scenario: Panel refreshes immediately when change is archived

**Given** workspace has `openspec/changes/active-change/tasks.md` displayed in panel
**When** the change directory is moved to `openspec/changes/archive/2025-11-08-active-change/`
**Then** the panel refreshes within 100ms
**And** "active-change" is removed from the panel
**And** no manual refresh is required

#### Scenario: Panel refreshes immediately when new change is created

**Given** the OpenSpec Tasks panel is open
**When** a new change directory `openspec/changes/new-feature/` is created
**And** a `tasks.md` file is added to the change
**Then** the panel refreshes within 100ms
**And** "new-feature" appears in the panel

### Requirement: Directory watcher monitors change directory structure

The extension MUST watch the `openspec/changes` directory in all applicable workspace folders for structural changes (directory additions/removals) to detect when changes are archived or created.

#### Scenario: Watcher detects directory removal from changes

**Given** the extension is active
**And** a change directory exists at `{workspaceFolder}/openspec/changes/my-change/`
**When** the directory is moved to `{workspaceFolder}/openspec/changes/archive/2025-11-08-my-change/`
**Then** the directory watcher detects the removal
**And** triggers a panel refresh

#### Scenario: Watcher detects directory addition to changes

**Given** the extension is active
**And** no directory exists at `{workspaceFolder}/openspec/changes/new-feature/`
**When** a new directory is created at `{workspaceFolder}/openspec/changes/new-feature/`
**Then** the directory watcher detects the addition
**And** triggers a panel refresh

#### Scenario: Watcher is properly disposed on deactivation

**Given** the extension is active
**And** directory watchers are registered for multiple workspace folders
**When** the extension is deactivated
**Then** all directory watchers are disposed
**And** no memory leaks occur

### Requirement: Multi-root workspace support

The extension MUST support VS Code multi-root workspaces by scanning all workspace folders for OpenSpec changes and aggregating them into the unified tree view.

#### Scenario: Extension activates in multi-root workspace

**Given** a multi-root workspace with folders "project-a" and "project-b"
**And** "project-a" has `openspec/changes/feature-a/tasks.md`
**And** "project-b" has `openspec/changes/feature-b/tasks.md`
**When** the extension activates
**Then** both "feature-a" and "feature-b" appear in the Changes panel

#### Scenario: Changes display workspace folder context

**Given** a multi-root workspace with folders "project-a" and "project-b"
**And** both folders contain OpenSpec changes
**When** the Changes panel is opened
**Then** each change item includes the workspace folder name in its label
**And** changes are visually distinguishable by their source workspace folder

#### Scenario: Single folder workspace preserves existing behavior

**Given** a single-folder workspace with `openspec/changes/my-change/tasks.md`
**When** the Changes panel is opened
**Then** the change appears without workspace folder prefix
**And** the behavior matches the pre-workspace-support version

### Requirement: Dynamic workspace folder handling

The extension MUST handle workspace folders being added or removed without requiring a window reload.

#### Scenario: Workspace folder added with OpenSpec changes

**Given** the extension is active in a workspace
**When** a new folder containing `openspec/changes` is added to the workspace
**Then** the extension detects the new folder within 500ms
**And** changes from the new folder appear in the Changes panel
**And** file watchers are created for the new folder

#### Scenario: Workspace folder removed

**Given** the extension is active with changes from folder "project-a"
**When** "project-a" is removed from the workspace
**Then** changes from "project-a" are removed from the Changes panel
**And** file watchers for "project-a" are properly disposed
**And** no memory leaks occur

#### Scenario: Workspace folder without OpenSpec changes

**Given** a multi-root workspace
**When** a folder without `openspec/changes` directory is added
**Then** the extension does not create watchers for that folder
**And** no errors are logged

### Requirement: Commands execute in correct workspace folder context

Commands MUST execute in the context of the workspace folder containing the target change.

#### Scenario: Apply command uses correct workspace folder

**Given** a change "feature-a" from workspace folder "project-a"
**When** the user selects "Apply Change" from the context menu
**Then** the terminal executes `af spec apply feature-a`
**And** the command runs with cwd set to "project-a"

#### Scenario: Archive command uses correct workspace folder

**Given** a complete change "feature-b" from workspace folder "project-b"
**When** the user selects "Archive Change" from the context menu
**Then** the terminal executes `af spec archive feature-b`
**And** the command runs with cwd set to "project-b"

#### Scenario: Open proposal navigates to correct file

**Given** a change "feature-a" from workspace folder "project-a"
**When** the user clicks on the change item
**Then** the file `project-a/openspec/changes/feature-a/proposal.md` opens
**And** the file opens in the editor regardless of which workspace folder is currently focused

