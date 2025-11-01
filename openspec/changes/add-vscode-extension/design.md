# Design: VSCode Extension for OpenSpec Task Monitoring

## Architecture Overview

The extension follows standard VSCode extension patterns using TreeDataProvider for the panel display and FileSystemWatcher for auto-refresh functionality.

```
vscode-extension/
├── src/
│   ├── extension.ts          # Extension entry point (activate/deactivate)
│   ├── taskProvider.ts       # TreeDataProvider implementation
│   ├── taskParser.ts         # Parse tasks.md files
│   └── types.ts              # TypeScript interfaces
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript config
└── README.md                 # Extension documentation
```

## Component Design

### Extension Entry Point (`extension.ts`)

**Responsibilities:**
- Register TreeDataProvider with VSCode
- Create and register the TreeView
- Set up FileSystemWatcher for `openspec/changes/**/*.md`
- Handle extension activation/deactivation
- Update badge count based on unchecked tasks

**Key APIs:**
- `vscode.window.createTreeView()`
- `vscode.workspace.createFileSystemWatcher()`
- `vscode.TreeView.badge` for displaying unchecked count

### Task Provider (`taskProvider.ts`)

**Responsibilities:**
- Implement `vscode.TreeDataProvider<TaskItem>`
- Discover active changes in `openspec/changes/` (excluding archive)
- Parse tasks.md files for each change
- Build tree structure: Change → Section → Task
- Provide tree items with appropriate icons and labels
- Refresh tree when files change

**Tree Structure:**
```
📁 Change: add-feature (2/5 tasks completed)
  ├─ 📋 Section: Implementation Tasks
  │   ├─ ☑ Task: Create module structure
  │   ├─ ☐ Task: Add tests
  │   └─ ☐ Task: Update documentation
  └─ 📋 Section: Validation
      ├─ ☑ Task: Run lint
      └─ ☐ Task: Test integration
```

**Tree Item Types:**
1. **ChangeItem**: Root level showing change ID and progress
2. **SectionItem**: Section headers from tasks.md (## headers)
3. **TaskItem**: Individual task with checkbox state

### Task Parser (`taskParser.ts`)

**Responsibilities:**
- Read and parse tasks.md files
- Extract sections (## headers)
- Extract tasks (- [ ] / - [x] items)
- Calculate completion counts
- Handle missing or malformed files gracefully

**Reuse Strategy:**
- Logic can be ported from `commands/todo.ts` and `commands/watch.ts`
- Adapt TypeScript code to work in VSCode extension context
- Ensure no Node.js-specific dependencies that conflict with VSCode API

### Types (`types.ts`)

**Core Interfaces:**
```typescript
interface Task {
    text: string;
    completed: boolean;
    indent: number;
}

interface Section {
    title: string;
    tasks: Task[];
}

interface ChangeData {
    changeId: string;
    sections: Section[];
    totalTasks: number;
    completedTasks: number;
}
```

## File System Watching

**Pattern:** `**/openspec/changes/**/tasks.md`
- Watches for changes to any tasks.md file in the changes directory
- Ignores archive directory (`!**/archive/**`)
- Debounces updates (100ms) to avoid excessive refreshes
- Triggers TreeDataProvider refresh on file changes

## Badge Display Logic

The panel badge shows the count of unchecked tasks across all active changes:

```typescript
const uncheckedCount = allChanges.reduce((sum, change) => {
    return sum + (change.totalTasks - change.completedTasks);
}, 0);

if (uncheckedCount > 0) {
    treeView.badge = {
        value: uncheckedCount,
        tooltip: `${uncheckedCount} unchecked task${uncheckedCount !== 1 ? 's' : ''}`
    };
} else {
    treeView.badge = undefined; // Hide badge when all tasks complete
}
```

## Error Handling

1. **No OpenSpec directory**: Extension activates but shows empty panel with helpful message
2. **Malformed tasks.md**: Skip file, log warning, continue with other changes
3. **File read errors**: Gracefully handle permissions issues, show error in panel
4. **Watcher errors**: Log error, attempt to recreate watcher

## Performance Considerations

1. **Lazy Loading**: Only parse tasks.md when expanding tree items (if needed)
2. **Caching**: Cache parsed results, invalidate on file change
3. **Debouncing**: Debounce file system events to reduce refresh frequency
4. **Efficient Updates**: Only refresh affected tree items, not entire tree

## VSCode API Usage

**Key APIs:**
- `vscode.TreeDataProvider`: Core interface for tree view
- `vscode.TreeItem`: Individual tree nodes
- `vscode.TreeView`: Panel registration and badge management
- `vscode.FileSystemWatcher`: File change monitoring
- `vscode.workspace.workspaceFolders`: Get workspace root
- `vscode.ThemeIcon`: Use built-in icons for checkboxes

**Icons:**
- `new vscode.ThemeIcon('check')`: Completed task (☑)
- `new vscode.ThemeIcon('circle-outline')`: Unchecked task (☐)
- `new vscode.ThemeIcon('folder')`: Change item
- `new vscode.ThemeIcon('list-flat')`: Section item

## Extension Manifest (package.json)

**Key Configuration:**
```json
{
  "name": "openspec-tasks",
  "displayName": "OpenSpec Tasks",
  "description": "Monitor OpenSpec change tasks",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.85.0"
  },
  "activationEvents": [
    "workspaceContains:**/openspec/changes"
  ],
  "contributes": {
    "views": {
      "panel": [
        {
          "id": "openspecTasks",
          "name": "OpenSpec Tasks"
        }
      ]
    }
  }
}
```

## Testing Strategy

1. **Unit Tests**: Test task parser logic with sample tasks.md content
2. **Integration Tests**: Test TreeDataProvider with mock VSCode API
3. **Manual Testing**: Test in real VSCode with zap project
4. **Edge Cases**: Test with no changes, empty tasks.md, malformed files

## Future Enhancements (Out of Scope)

1. Click to open tasks.md file
2. Click to mark task complete
3. Filter/search tasks
4. Sort by completion status
5. Configuration options (refresh interval, display format)
6. Multi-workspace support
7. Integration with zap CLI commands

## Technology Choices

**Why TreeDataProvider over WebView?**
- Native VSCode UI, better performance
- Automatic theming support
- Simpler implementation
- Consistent with other panels (Problems, Test Results)

**Why separate directory over monolithic structure?**
- Clear separation of concerns
- Can be extracted to separate repo later if needed
- Independent versioning and deployment
- Doesn't pollute main CLI codebase

**Why TypeScript?**
- Required for VSCode extension development
- Type safety for VSCode API usage
- Consistent with zap project conventions
- Better IDE support and refactoring
