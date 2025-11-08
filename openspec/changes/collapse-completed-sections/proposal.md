# Proposal: Collapse Task Sections Where All Todos Are Checked

## Problem

In the VSCode extension's OpenSpec Tasks view, when a section has all its tasks completed, it still displays expanded by default. This creates visual clutter and makes it harder to focus on the incomplete work that requires attention. Users have to manually collapse completed sections to keep their view focused on active tasks.

## Proposed Solution

Add a VSCode setting `openspecTasks.autoCollapseCompletedSections` that controls whether task sections with all todos checked are automatically collapsed in the tree view. When enabled, sections where all tasks are completed will be displayed in a collapsed state, reducing visual noise and helping users focus on incomplete work.

## Benefits

- **Improved Focus**: Users can quickly see which sections still have work remaining
- **Reduced Visual Clutter**: Completed sections take up less screen space when collapsed
- **User Control**: Optional setting allows users to choose their preferred behavior
- **Persistent Preference**: Setting is stored in VSCode workspace/user settings

## Implementation Scope

This change modifies the VSCode extension's task provider to:

1. Add a new configuration setting for auto-collapsing completed sections
2. Update the tree item generation logic to check section completion status
3. Set the collapsible state to `Collapsed` for fully completed sections when the setting is enabled
4. Respect the setting value when refreshing the tree view

## Related Capabilities

- `vscode-extension-collapsed-sections` - New spec defining the auto-collapse behavior and setting

## Alternatives Considered

- **Always collapse completed sections**: This removes user choice and may frustrate users who want to see their completed work
- **Manual command to toggle**: Requires extra user action each time the view loads, less convenient than a persistent preference
- **Collapse at change level instead of section level**: Less granular control, doesn't help when a change has mixed complete/incomplete sections
