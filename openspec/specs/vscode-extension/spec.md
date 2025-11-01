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

