# vscode-extension-collapsed-sections Specification

## Purpose

Define the behavior for automatically collapsing task sections in the VSCode extension's OpenSpec Tasks view when all tasks within the section are checked, controlled by a user preference setting.

## ADDED Requirements

### Requirement: Configuration setting for auto-collapse behavior

The VSCode extension MUST provide a configuration setting that controls whether completed task sections are automatically collapsed.

#### Scenario: Setting is defined in package.json

- **GIVEN** the VSCode extension is installed
- **WHEN** the user opens VSCode settings
- **THEN** a setting named "Openspec Tasks: Auto Collapse Completed Sections" is available
- **AND** the setting key is `openspecTasks.autoCollapseCompletedSections`
- **AND** the setting type is boolean
- **AND** the setting description is "Automatically collapse task sections where all todos are checked"
- **AND** the setting default value is `false`

#### Scenario: Setting appears in settings UI

- **GIVEN** the user opens VSCode settings UI (Preferences > Settings)
- **WHEN** they search for "openspec" or "collapse"
- **THEN** the "Auto Collapse Completed Sections" setting appears
- **AND** it displays as a checkbox control
- **AND** the description clearly explains the behavior
- **AND** changes to the setting are saved to workspace or user settings

### Requirement: Detect fully completed sections

The task provider MUST accurately determine when a section has all its tasks completed.

#### Scenario: Section with all tasks checked is identified

- **GIVEN** a task section contains 5 tasks
- **AND** all 5 tasks have checkbox state `[x]` (checked)
- **WHEN** the task provider evaluates the section
- **THEN** it identifies the section as "fully completed"
- **AND** the section is eligible for auto-collapse if the setting is enabled

#### Scenario: Section with mixed task states is not fully completed

- **GIVEN** a task section contains 5 tasks
- **AND** 4 tasks are checked `[x]` and 1 task is unchecked `[ ]`
- **WHEN** the task provider evaluates the section
- **THEN** it identifies the section as NOT fully completed
- **AND** the section is NOT eligible for auto-collapse
- **AND** the section displays in expanded state regardless of the setting

#### Scenario: Section with no tasks is not considered completed

- **GIVEN** a task section has a title but contains zero tasks
- **WHEN** the task provider evaluates the section
- **THEN** it identifies the section as NOT fully completed
- **AND** the section displays in expanded state
- **AND** prevents incorrect collapse behavior for empty sections

#### Scenario: Section completion detection uses task data

- **GIVEN** the task provider has parsed section data including task list
- **WHEN** checking if a section is fully completed
- **THEN** it iterates through all tasks in `section.tasks`
- **AND** checks the `completed` property of each task
- **AND** returns `true` only if all tasks have `completed: true` and task count > 0

### Requirement: Conditionally collapse completed sections

The task provider MUST set the collapsible state based on section completion status and the configuration setting.

#### Scenario: Auto-collapse enabled and section fully completed

- **GIVEN** the setting `openspecTasks.autoCollapseCompletedSections` is `true`
- **AND** a task section has all tasks checked
- **WHEN** the task provider creates the tree item for the section
- **THEN** the tree item's `collapsibleState` is set to `vscode.TreeItemCollapsibleState.Collapsed`
- **AND** the section appears collapsed in the tree view
- **AND** users can still manually expand it if desired

#### Scenario: Auto-collapse enabled but section has incomplete tasks

- **GIVEN** the setting `openspecTasks.autoCollapseCompletedSections` is `true`
- **AND** a task section has at least one unchecked task
- **WHEN** the task provider creates the tree item for the section
- **THEN** the tree item's `collapsibleState` is set to `vscode.TreeItemCollapsibleState.Expanded`
- **AND** the section appears expanded showing its tasks
- **AND** users can see the unchecked tasks immediately

#### Scenario: Auto-collapse disabled and section fully completed

- **GIVEN** the setting `openspecTasks.autoCollapseCompletedSections` is `false`
- **AND** a task section has all tasks checked
- **WHEN** the task provider creates the tree item for the section
- **THEN** the tree item's `collapsibleState` is set to `vscode.TreeItemCollapsibleState.Expanded`
- **AND** the section appears expanded as it would by default
- **AND** completed tasks remain visible

#### Scenario: Auto-collapse disabled and section has incomplete tasks

- **GIVEN** the setting `openspecTasks.autoCollapseCompletedSections` is `false`
- **AND** a task section has at least one unchecked task
- **WHEN** the task provider creates the tree item for the section
- **THEN** the tree item's `collapsibleState` is set to `vscode.TreeItemCollapsibleState.Expanded`
- **AND** behavior is identical to the default (no special logic needed)

### Requirement: Read configuration setting at runtime

The task provider MUST read the current value of the configuration setting when creating tree items.

#### Scenario: Read setting from VSCode configuration API

- **GIVEN** the task provider is creating tree items
- **WHEN** it needs to determine collapsible state for a section
- **THEN** it calls `vscode.workspace.getConfiguration('openspecTasks')`
- **AND** reads the `autoCollapseCompletedSections` property
- **AND** uses the boolean value to determine collapse logic
- **AND** handles undefined/null values by defaulting to `false`

#### Scenario: Setting changes take effect on next refresh

- **GIVEN** the tree view is displayed with current collapse states
- **WHEN** the user changes the `autoCollapseCompletedSections` setting
- **THEN** the setting change is persisted to VSCode configuration
- **AND** the tree view refreshes automatically (via configuration change listener if implemented)
- **OR** refreshes on next manual refresh or file change
- **AND** section collapse states update to reflect the new setting value

### Requirement: Maintain existing expansion behavior for changes

The change-level tree items MUST continue to display in expanded state regardless of task completion.

#### Scenario: Changes remain expanded with auto-collapse enabled

- **GIVEN** the setting `openspecTasks.autoCollapseCompletedSections` is `true`
- **AND** a change has all sections with all tasks completed
- **WHEN** the task provider creates the tree item for the change
- **THEN** the change's `collapsibleState` remains `vscode.TreeItemCollapsibleState.Expanded`
- **AND** the change is visible in expanded form
- **AND** only the sections within it are collapsed
- **AND** users can see the change structure at a glance

#### Scenario: Auto-collapse setting does not affect task items

- **GIVEN** the setting `openspecTasks.autoCollapseCompletedSections` is `true` or `false`
- **WHEN** the task provider creates tree items for individual tasks
- **THEN** task items have `collapsibleState` of `vscode.TreeItemCollapsibleState.None`
- **AND** tasks display as leaf nodes in the tree
- **AND** the setting has no effect on task item rendering

### Requirement: Documentation of the feature

The VSCode extension README MUST document the auto-collapse completed sections feature and its configuration.

#### Scenario: README includes setting documentation

- **GIVEN** a user reads the `vscode-extension/README.md` file
- **WHEN** they look for configuration options
- **THEN** the README includes a section describing the `openspecTasks.autoCollapseCompletedSections` setting
- **AND** explains what the setting does in clear language
- **AND** shows the setting's default value (`false`)
- **AND** explains how to enable or disable it

#### Scenario: README provides configuration example

- **GIVEN** a user wants to enable auto-collapse completed sections
- **WHEN** they consult the README
- **THEN** it includes a JSON snippet showing how to configure the setting
- **AND** the snippet uses correct VSCode settings syntax
- **AND** example: `"openspecTasks.autoCollapseCompletedSections": true`
