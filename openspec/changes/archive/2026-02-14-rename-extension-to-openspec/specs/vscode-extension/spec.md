## MODIFIED Requirements

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

**Given** workspace has `openspec/changes/old-change/tasks.md`
**And** workspace has `openspec/changes/archive/archived-change/tasks.md`
**When** the OpenSpec panel is opened
**Then** only "old-change" is displayed
**And** "archived-change" is not displayed

#### Scenario: Panel refreshes immediately when change is archived

**Given** workspace has `openspec/changes/active-change/tasks.md` displayed in panel
**When** the change directory is moved to `openspec/changes/archive/2025-11-08-active-change/`
**Then** the panel refreshes within 100ms
**And** "active-change" is removed from the panel
**And** no manual refresh is required

#### Scenario: Panel refreshes immediately when new change is created

**Given** the OpenSpec panel is open
**When** a new change directory `openspec/changes/new-feature/` is created
**And** a `tasks.md` file is added to the change
**Then** the panel refreshes within 100ms
**And** "new-feature" appears in the panel

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
- `openspec.applyChange`
- `openspec.archiveChange`

### Requirement: View uses openspecChanges ID

The tree view MUST use `openspecChanges` as its view ID.

#### Scenario: View ID is correctly set

**Given** the extension package.json
**When** the contributes.views section is examined
**Then** the view ID is `openspecChanges`
**And** the view container ID remains `openspec`
