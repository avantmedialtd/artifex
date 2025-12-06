# VSCode Extension Apply and Archive Commands

## Summary

Add context menu commands to the VSCode extension panel that allow users to run `zap apply` and `zap archive` directly from the Changes tree view. Commands are conditionally visible based on task completion status:

- **Apply**: Visible only when the change has incomplete tasks
- **Archive**: Visible only when all tasks are complete

## Motivation

Currently, users must switch to a terminal to run `zap apply` or `zap archive` commands. Adding these commands directly to the VSCode extension's context menu streamlines the workflow by keeping users in the IDE.

## Approach

1. **Extend contextValue encoding**: Modify the tree item's `contextValue` to encode completion status (e.g., `change-incomplete`, `change-complete-with-title`) for conditional menu visibility
2. **Register commands**: Add `openspecTasks.applyChange` and `openspecTasks.archiveChange` commands
3. **Configure context menus**: Use VSCode's `when` clause with regex matching to show/hide menu items based on contextValue
4. **Execute via Task API**: Run commands using VSCode's Task API with `close: true` for auto-close on success, keeping terminal open on failure for error visibility

## Technical Details

### Context Value Encoding

Current: `change` or `change-with-title`

New encoding scheme:
- `change-incomplete` - Has incomplete tasks, no title
- `change-incomplete-with-title` - Has incomplete tasks, has title
- `change-complete` - All tasks complete, no title
- `change-complete-with-title` - All tasks complete, has title

### Menu Visibility

| Command | When Clause |
|---------|-------------|
| Apply | `viewItem =~ /^change-incomplete/` |
| Archive | `viewItem =~ /^change-complete/` |
| Copy Title | `viewItem =~ /with-title$/` |
| Copy Change ID | `viewItem =~ /^change/` |

### Command Execution

Commands will use the VSCode Task API to execute `zap apply <change-id>` or `zap archive <change-id>` in the integrated terminal. The task presentation will:
- Show terminal when command starts
- Auto-close on success (`close: true`)
- Stay open on failure so users can see error messages
