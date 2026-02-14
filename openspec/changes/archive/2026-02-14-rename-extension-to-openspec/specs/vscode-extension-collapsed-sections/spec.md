## MODIFIED Requirements

### Requirement: Configuration setting for auto-collapse behavior

The VSCode extension MUST provide a configuration setting that controls whether completed task sections are automatically collapsed.

#### Scenario: Setting is defined in package.json

- **GIVEN** the VSCode extension is installed
- **WHEN** the user opens VSCode settings
- **THEN** a setting named "Openspec: Auto Collapse Completed Sections" is available
- **AND** the setting key is `openspec.autoCollapseCompletedSections`
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

### Requirement: Conditionally collapse completed sections

The task provider MUST set the collapsible state based on section completion status and the configuration setting.

#### Scenario: Auto-collapse enabled and section fully completed

- **GIVEN** the setting `openspec.autoCollapseCompletedSections` is `true`
- **AND** a task section has all tasks checked
- **WHEN** the task provider creates the tree item for the section
- **THEN** the tree item's `collapsibleState` is set to `vscode.TreeItemCollapsibleState.Collapsed`
- **AND** the section appears collapsed in the tree view
- **AND** users can still manually expand it if desired

#### Scenario: Auto-collapse enabled but section has incomplete tasks

- **GIVEN** the setting `openspec.autoCollapseCompletedSections` is `true`
- **AND** a task section has at least one unchecked task
- **WHEN** the task provider creates the tree item for the section
- **THEN** the tree item's `collapsibleState` is set to `vscode.TreeItemCollapsibleState.Expanded`
- **AND** the section appears expanded showing its tasks
- **AND** users can see the unchecked tasks immediately

#### Scenario: Auto-collapse disabled and section fully completed

- **GIVEN** the setting `openspec.autoCollapseCompletedSections` is `false`
- **AND** a task section has all tasks checked
- **WHEN** the task provider creates the tree item for the section
- **THEN** the tree item's `collapsibleState` is set to `vscode.TreeItemCollapsibleState.Expanded`
- **AND** the section appears expanded as it would by default
- **AND** completed tasks remain visible

#### Scenario: Auto-collapse disabled and section has incomplete tasks

- **GIVEN** the setting `openspec.autoCollapseCompletedSections` is `false`
- **AND** a task section has at least one unchecked task
- **WHEN** the task provider creates the tree item for the section
- **THEN** the tree item's `collapsibleState` is set to `vscode.TreeItemCollapsibleState.Expanded`
- **AND** behavior is identical to the default (no special logic needed)

### Requirement: Read configuration setting at runtime

The task provider MUST read the current value of the configuration setting when creating tree items.

#### Scenario: Read setting from VSCode configuration API

- **GIVEN** the task provider is creating tree items
- **WHEN** it needs to determine collapsible state for a section
- **THEN** it calls `vscode.workspace.getConfiguration('openspec')`
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

### Requirement: Documentation of the feature

The VSCode extension README MUST document the auto-collapse completed sections feature and its configuration.

#### Scenario: README includes setting documentation

- **GIVEN** a user reads the `vscode-extension/README.md` file
- **WHEN** they look for configuration options
- **THEN** the README includes a section describing the `openspec.autoCollapseCompletedSections` setting
- **AND** explains what the setting does in clear language
- **AND** shows the setting's default value (`false`)
- **AND** explains how to enable or disable it

#### Scenario: README provides configuration example

- **GIVEN** a user wants to enable auto-collapse completed sections
- **WHEN** they consult the README
- **THEN** it includes a JSON snippet showing how to configure the setting
- **AND** the snippet uses correct VSCode settings syntax
- **AND** example: `"openspec.autoCollapseCompletedSections": true`
