# OpenSpec Tasks - VSCode Extension

Monitor OpenSpec change tasks in a dedicated panel within Visual Studio Code.

## Features

- **Dedicated Panel**: Display all active OpenSpec changes and their tasks in a native VSCode panel (similar to Problems panel)
- **Progress Tracking**: Shows completion counts for each change (e.g., "2/5 tasks completed")
- **Badge Notifications**: Displays a badge with the count of changes with unchecked tasks for at-a-glance status
- **Real-time Updates**: Automatically refreshes when `tasks.md` files change
- **Hierarchical Display**: Organizes tasks by change → section → individual task
- **Visual Indicators**: Uses checkboxes (☑/☐) to show task completion status
- **Click-to-Navigate**: Click on any task to open the `tasks.md` file at the exact line where the task is defined

## Requirements

- VSCode version 1.85.0 or higher
- Workspace must contain an `openspec/changes/` directory structure

## Installation

### Local Development Installation

1. Navigate to the extension directory:

    ```bash
    cd vscode-extension
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Compile the extension:

    ```bash
    npm run compile
    ```

4. Press `F5` in VSCode to open a new Extension Development Host window with the extension loaded

### Manual Installation

1. Package the extension:

    ```bash
    cd vscode-extension
    npm install -g @vscode/vsce
    vsce package
    ```

2. Install the `.vsix` file:
    - Open VSCode
    - Go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
    - Click the "..." menu → "Install from VSIX..."
    - Select the generated `.vsix` file

## Usage

1. Open a workspace that contains an `openspec/changes/` directory
2. The "OpenSpec Tasks" panel will automatically appear in the panel area (bottom of VSCode, alongside Problems, Output, Terminal)
3. Expand changes to see sections and individual tasks
4. Click on any task to open the `tasks.md` file at the specific line where the task is defined
5. The badge on the panel tab shows the count of active changes that have unchecked tasks

### Panel Location

The OpenSpec Tasks panel appears in the bottom panel area by default. You can:

- Show/hide it using the panel toggle button
- Move it to a different location by dragging the panel tab
- Access it via View → OpenSpec Tasks in the menu

## Configuration

The extension provides the following configuration options:

### Auto-Collapse Completed Sections

**Setting**: `openspecTasks.autoCollapseCompletedSections`
**Type**: Boolean
**Default**: `false`

Automatically collapse task sections where all todos are checked. When enabled, sections with all tasks completed will be displayed in a collapsed state, reducing visual clutter and helping you focus on incomplete work.

#### Enable in Settings UI

1. Open VSCode Settings (File → Preferences → Settings / Cmd+,)
2. Search for "openspec" or "collapse"
3. Check the "Auto Collapse Completed Sections" option

#### Enable in settings.json

Add this to your workspace or user settings:

```json
{
    "openspecTasks.autoCollapseCompletedSections": true
}
```

**Note**: Changes to this setting take effect when the tree view refreshes (on file changes or manual refresh).

## Extension Activation

The extension activates automatically when:

- A workspace is opened that contains `openspec/changes/` directory

If the directory doesn't exist, the extension remains inactive to avoid performance impact.

## Development

### Project Structure

```
vscode-extension/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── taskProvider.ts       # TreeDataProvider implementation
│   ├── taskParser.ts         # Parse tasks.md files
│   └── types.ts              # TypeScript interfaces
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript config
└── README.md                 # This file
```

### Building

```bash
npm run compile         # Compile TypeScript
npm run watch          # Watch mode for development
```

### Testing

```bash
npm test               # Run unit tests
```

## Troubleshooting

### Extension doesn't activate

- Ensure your workspace contains an `openspec/changes/` directory
- Check the VSCode Developer Console (Help → Toggle Developer Tools) for errors
- Try reloading the window (Ctrl+R / Cmd+R in Extension Development Host)

### Panel doesn't show tasks

- Verify that `tasks.md` files exist in change directories
- Check file permissions
- Try refreshing the view using the refresh icon in the panel toolbar

### Badge not updating

- The badge updates automatically when `tasks.md` files change
- You can manually refresh using the refresh command (Ctrl+Shift+P → "OpenSpec Tasks: Refresh")

## Known Limitations

- Read-only display (cannot edit tasks from the extension)
- Single workspace support only

## Future Enhancements

Potential features for future versions:

- Mark tasks complete from the extension
- Filter/search tasks
- Sort by completion status
- Additional configuration options
- Multi-workspace support

## License

UNLICENSED

## Author

István Antal <istvan@antal.xyz>
