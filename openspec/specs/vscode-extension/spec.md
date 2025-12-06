# vscode-extension Specification

## Purpose
TBD - created by archiving change add-vscode-extension. Update Purpose after archive.
## Requirements
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

The extension MUST watch the `openspec/changes` directory for structural changes (directory additions/removals) to detect when changes are archived or created.

#### Scenario: Watcher detects directory removal from changes

**Given** the extension is active
**And** a change directory exists at `openspec/changes/my-change/`
**When** the directory is moved to `openspec/changes/archive/2025-11-08-my-change/`
**Then** the directory watcher detects the removal
**And** triggers a panel refresh

#### Scenario: Watcher detects directory addition to changes

**Given** the extension is active
**And** no directory exists at `openspec/changes/new-feature/`
**When** a new directory is created at `openspec/changes/new-feature/`
**Then** the directory watcher detects the addition
**And** triggers a panel refresh

#### Scenario: Watcher is properly disposed on deactivation

**Given** the extension is active
**And** the directory watcher is registered
**When** the extension is deactivated
**Then** the directory watcher is disposed
**And** no memory leaks occur

