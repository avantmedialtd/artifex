# Proposal: VSCode Extension for OpenSpec Task Monitoring

## Overview

Add a VSCode extension that displays OpenSpec task information in a panel similar to the Problems panel. The extension provides real-time visibility into active change tasks, showing completion status and progress without requiring developers to run `zap watch` in a terminal.

## Motivation

Currently, developers must run `zap watch` in a dedicated terminal to monitor OpenSpec task progress. This:

- Consumes a terminal window that could be used for other tasks
- Requires manual context switching to check task status
- Is not visible when working in other terminal tabs
- Doesn't integrate with VSCode's native UI patterns

A VSCode extension solves these issues by:

- Displaying tasks in a native VSCode panel (like Problems, Output, Terminal)
- Showing a badge with unchecked task count for at-a-glance status
- Auto-updating when task files change
- Integrating seamlessly with the developer's existing workflow

## Goals

1. **Provide visibility**: Display all active OpenSpec changes and their tasks in a VSCode panel
2. **Show progress**: Display completion counts and visual indicators (checked/unchecked)
3. **Badge notification**: Show count of unchecked tasks in the panel badge when count > 0
4. **Real-time updates**: Auto-refresh when tasks.md files change
5. **Generic implementation**: Work with any OpenSpec-based project, not just zap
6. **Simple UI**: Use native VSCode TreeView pattern similar to Problems panel

## Non-Goals

- Interactive task editing (read-only display only)
- Publishing to VSCode Marketplace (local extension initially)
- Custom WebView UI (use native TreeView instead)
- Integration with other OpenSpec commands (focus on display only)
- Multi-workspace support (single workspace initially)

## Scope

This change introduces a new capability: `vscode-extension`

### New Capability: vscode-extension

A VSCode extension that monitors and displays OpenSpec change tasks in a dedicated panel.

**Key Features:**
- TreeView panel showing active changes and their tasks
- Badge showing count of unchecked tasks
- File system watcher for auto-refresh
- Hierarchical display: changes → sections → tasks
- Visual indicators for task completion status

## Impact

**Users Affected:** All developers working on OpenSpec-based projects who use VSCode

**Breaking Changes:** None (additive only)

**Migration Required:** None (opt-in feature)

## Dependencies

- Requires VSCode API (vscode package)
- Requires TypeScript for extension development
- Requires existing OpenSpec directory structure (`openspec/changes/`)

## Alternatives Considered

1. **WebView Panel**: Considered using WebView for custom HTML/CSS rendering
   - Rejected: More complex, slower, less native feel

2. **Status Bar Item Only**: Considered showing only a count in the status bar
   - Rejected: Not enough information, requires clicking to see details

3. **Enhance zap watch**: Considered improving the terminal command instead
   - Rejected: Doesn't solve the terminal consumption problem

4. **Separate Repository**: Considered creating standalone extension repo
   - Rejected: Adds complexity, prefer monorepo initially for faster iteration

## Open Questions

- Should the extension support opening tasks.md files when clicking on tasks? (Future enhancement)
- Should we add configuration for customizing the display? (Future enhancement)
- Should we support marking tasks complete from the extension? (Future enhancement)

## Success Criteria

1. Extension installs and activates in VSCode
2. Panel appears in the panel area (bottom, like Problems)
3. All active changes are displayed with accurate task counts
4. Badge shows correct count of unchecked tasks
5. Panel auto-refreshes when tasks.md files change
6. Extension works on any OpenSpec-based project
7. Zero performance impact when no OpenSpec directory exists
