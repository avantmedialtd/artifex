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
**And** the "OpenSpec" panel appears in the panel area

#### Scenario: Extension manifest defines correct metadata

**Given** the extension package.json exists at `vscode-extension/package.json`
**When** the manifest is read
**Then** it contains required fields: name, displayName, description, version, engines
**And** the name field is `openspec`
**And** the displayName field is `OpenSpec`
**And** the engines.vscode specifies minimum version "^1.85.0"
**And** activationEvents includes "workspaceContains:**/openspec/changes"

### Requirement: TreeView panel displays active changes

The extension MUST display all active OpenSpec changes in a tree view panel similar to the Problems panel.

#### Scenario: Panel excludes archived changes

**Given** workspace has `openspec/changes/old-change/` directory
**And** workspace has `openspec/changes/archive/archived-change/` directory
**When** the OpenSpec panel is opened
**Then** only "old-change" is displayed
**And** "archived-change" is not displayed

#### Scenario: Panel refreshes immediately when change is archived

**Given** workspace has `openspec/changes/active-change/` displayed in panel
**When** the change directory is moved to `openspec/changes/archive/2025-11-08-active-change/`
**Then** the panel refreshes within 100ms
**And** "active-change" is removed from the panel
**And** no manual refresh is required

#### Scenario: Panel refreshes immediately when new change is created

**Given** the OpenSpec panel is open
**When** a new change directory `openspec/changes/new-feature/` is created
**Then** the panel refreshes within 100ms
**And** "new-feature" appears in the panel with four artifact nodes

### Requirement: Commands use openspec namespace

All extension commands MUST use the `openspec` prefix instead of `openspecTasks`.

#### Scenario: Command IDs use correct prefix

**Given** the extension is activated
**When** the registered commands are examined
**Then** all commands use the `openspec.*` prefix
**And** the following commands are registered:
- `openspec.refresh`
- `openspec.openTaskLocation`
- `openspec.openProposal`
- `openspec.copyTitle`
- `openspec.copyChangeId`

### Requirement: View uses openspecChanges ID

The tree view MUST use `openspecChanges` as its view ID.

#### Scenario: View ID is correctly set

**Given** the extension package.json
**When** the contributes.views section is examined
**Then** the view ID is `openspecChanges`
**And** the view container ID remains `openspec`

### Requirement: Directory watcher monitors change directory structure

The extension MUST watch the `openspec/changes` directory in all applicable workspace folders for structural changes (directory additions/removals) and artifact file changes to detect when changes are archived, created, or artifacts are added.

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

#### Scenario: Watcher detects artifact file creation

**Given** the extension is active
**And** a change directory exists at `{workspaceFolder}/openspec/changes/my-change/`
**When** design.md is created in the change directory
**Then** the watcher detects the new file
**And** triggers a panel refresh updating the Design artifact status

#### Scenario: Watcher detects spec file creation

**Given** the extension is active
**And** a change directory exists at `{workspaceFolder}/openspec/changes/my-change/`
**When** a new spec file is created at `specs/auth/spec.md` within the change
**Then** the watcher detects the new file
**And** triggers a panel refresh updating the Specs artifact status

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

### Requirement: Artifact-aware tree hierarchy

The tree view SHALL display each change with four artifact children in fixed order: Proposal, Specs, Design, Tasks. Each artifact node SHALL indicate whether its corresponding file exists.

#### Scenario: Change with all artifacts present

- **WHEN** a change directory contains proposal.md, specs/ with at least one spec file, design.md, and tasks.md
- **THEN** the tree shows four artifact nodes under the change, all marked as present
- **AND** each artifact node is clickable and opens the corresponding file

#### Scenario: Change with only proposal created

- **WHEN** a change directory contains only proposal.md
- **THEN** the tree shows four artifact nodes under the change
- **AND** Proposal is marked as present and clickable
- **AND** Specs, Design, and Tasks are marked as not created and are inert (no click action)

#### Scenario: Change with no artifacts

- **WHEN** a change directory exists but contains no recognized artifact files
- **THEN** the tree shows four artifact nodes, all marked as not created

### Requirement: Artifact status inferred from files

The extension SHALL infer artifact status purely from file existence on disk, with no dependency on external CLI tools or metadata files.

#### Scenario: Proposal status detection

- **WHEN** the extension scans a change directory
- **AND** proposal.md exists
- **THEN** the Proposal artifact is marked as present

#### Scenario: Specs status detection

- **WHEN** the extension scans a change directory
- **AND** the specs/ subdirectory contains at least one subdirectory with a spec.md file
- **THEN** the Specs artifact is marked as present

#### Scenario: Design status detection

- **WHEN** the extension scans a change directory
- **AND** design.md exists
- **THEN** the Design artifact is marked as present

#### Scenario: Tasks status detection

- **WHEN** the extension scans a change directory
- **AND** tasks.md exists
- **THEN** the Tasks artifact is marked as present

### Requirement: Specs container node with children

The Specs artifact node SHALL be expandable when specs exist, showing each spec capability as a child node.

#### Scenario: Specs node with multiple capabilities

- **WHEN** a change has specs/auth/spec.md and specs/notifications/spec.md
- **THEN** the Specs node is expandable
- **AND** it shows child nodes "auth" and "notifications"
- **AND** clicking a child node opens the corresponding spec.md file

#### Scenario: Specs node with no specs

- **WHEN** a change has no specs/ directory or the directory is empty
- **THEN** the Specs node is marked as not created and is not expandable

### Requirement: Tasks artifact preserves section/checkbox drill-down

The Tasks artifact node SHALL expand into the existing section → task hierarchy when tasks.md exists.

#### Scenario: Tasks node with sections and tasks

- **WHEN** a change has tasks.md with sections and task checkboxes
- **THEN** the Tasks node is expandable
- **AND** expanding it shows sections, each containing task items with checkbox indicators
- **AND** clicking a task item opens tasks.md at the task's line number

#### Scenario: Tasks node label shows completion count

- **WHEN** a change has tasks.md with 3 completed and 5 total tasks
- **THEN** the Tasks artifact node label includes "3/5"

### Requirement: Clicking artifact opens corresponding file

Each present artifact node SHALL open its file when clicked.

#### Scenario: Click Proposal artifact

- **WHEN** user clicks the Proposal artifact node
- **AND** proposal.md exists
- **THEN** proposal.md is opened in the editor

#### Scenario: Click Design artifact

- **WHEN** user clicks the Design artifact node
- **AND** design.md exists
- **THEN** design.md is opened in the editor

#### Scenario: Click not-created artifact

- **WHEN** user clicks an artifact node that is marked as not created
- **THEN** nothing happens (no file opened, no error shown)
