# Proposal: Expand Task Trees by Default in VSCode Extension

## Why

The VSCode extension currently displays change items in a collapsed state by default. This means developers must manually expand each change to see its sections and tasks, adding friction to the workflow and reducing the visibility of task details.

Users want to see their task breakdown immediately when opening the extension panel, without requiring extra clicks to expand tree nodes. This provides better visibility into what needs to be done and enables faster navigation to specific tasks.

## What Changes

Change the default collapsible state for tree items in the VSCode extension to expanded:

- **Change items**: Expanded by default (currently collapsed)
- **Section items**: Expanded by default (currently collapsed)
- **Task items**: Remain as non-collapsible leaf nodes (no change)

### Current Behavior

When opening the OpenSpec Tasks panel:
```
> add-feature (2/5 tasks completed)     [collapsed - requires click to expand]
> fix-bug (1/3 tasks completed)         [collapsed - requires click to expand]
```

### New Behavior

When opening the OpenSpec Tasks panel:
```
v add-feature (2/5 tasks completed)     [expanded by default]
  v Implementation                       [expanded by default]
    ☐ Task 1
    ☑ Task 2
  v Testing                              [expanded by default]
    ☑ Task 3
    ☐ Task 4
    ☐ Task 5
v fix-bug (1/3 tasks completed)         [expanded by default]
  v Implementation                       [expanded by default]
    ☑ Task 1
    ☐ Task 2
    ☐ Task 3
```

## Benefits

1. **Immediate visibility**: See all tasks at a glance without manual expansion
2. **Reduced friction**: No extra clicks needed to navigate the task hierarchy
3. **Better overview**: Quickly understand the full scope of work across all changes
4. **Faster navigation**: Directly see which tasks are pending vs completed
5. **Maintains collapse option**: Users can still collapse nodes if they prefer minimal view

## Implementation Scope

This change affects only the tree item initialization in the VSCode extension:

- Modify `taskProvider.ts:getChildren()` to use `TreeItemCollapsibleState.Expanded` instead of `TreeItemCollapsibleState.Collapsed` for change and section items
- No changes to task parsing, badge logic, or file watching are required

## Edge Cases

- **Empty changes**: Changes with no sections/tasks remain non-collapsible
- **User preferences**: VSCode remembers collapse/expand state per user interaction, so users can still collapse nodes if desired
- **Large trees**: Trees with many changes/sections will show all items, which is the desired behavior for visibility
