import * as path from 'path';
import * as vscode from 'vscode';
import { OpenSpecTaskProvider } from './taskProvider';

let treeView: vscode.TreeView<any> | undefined;
let taskProvider: OpenSpecTaskProvider | undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined;

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('OpenSpec Tasks extension is now active');

    // Get workspace root
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        console.log('No workspace folder found');
        return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;

    // Check if openspec/changes directory exists
    const changesPath = path.join(workspaceRoot, 'openspec', 'changes');
    const changesUri = vscode.Uri.file(changesPath);

    vscode.workspace.fs.stat(changesUri).then(
        () => {
            // Directory exists, initialize the extension
            initializeExtension(context, workspaceRoot);
        },
        () => {
            // Directory doesn't exist, don't initialize
            console.log('No openspec/changes directory found, extension will not activate');
        },
    );
}

/**
 * Initialize the extension components
 */
function initializeExtension(context: vscode.ExtensionContext, workspaceRoot: string) {
    // Create task provider
    taskProvider = new OpenSpecTaskProvider(workspaceRoot);

    // Register tree view
    treeView = vscode.window.createTreeView('openspecTasks', {
        treeDataProvider: taskProvider,
        showCollapseAll: true,
    });

    context.subscriptions.push(treeView);

    // Update badge initially after a short delay to let tree load
    setTimeout(async () => {
        if (taskProvider) {
            await taskProvider.loadData();
            updateBadge();
        }
    }, 500);

    // Update badge when tree data changes
    taskProvider.onDidChangeTreeData(async () => {
        // Wait for data to load then update badge
        setTimeout(async () => {
            if (taskProvider) {
                await taskProvider.loadData();
                updateBadge();
            }
        }, 100);
    });

    // Set up file watcher for tasks.md files
    const pattern = new vscode.RelativePattern(workspaceRoot, 'openspec/changes/**/tasks.md');
    fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    // Debounce refresh to avoid excessive updates
    let refreshTimeout: NodeJS.Timeout | undefined;
    const debouncedRefresh = () => {
        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(() => {
            if (taskProvider) {
                taskProvider.refresh();
                updateBadge();
            }
        }, 100);
    };

    fileWatcher.onDidChange(debouncedRefresh);
    fileWatcher.onDidCreate(debouncedRefresh);
    fileWatcher.onDidDelete(debouncedRefresh);

    context.subscriptions.push(fileWatcher);

    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand('openspecTasks.refresh', () => {
        if (taskProvider) {
            taskProvider.refresh();
            updateBadge();
        }
    });

    context.subscriptions.push(refreshCommand);

    console.log('OpenSpec Tasks extension initialized successfully');
}

/**
 * Update the badge with completion percentage.
 * Shows the percentage of completed tasks across all active changes.
 * Badge is hidden when there are no active changes or no tasks.
 */
function updateBadge() {
    if (!treeView || !taskProvider) {
        return;
    }

    const activeChangesCount = taskProvider.getActiveChangesCount();
    const completionPercentage = taskProvider.getCompletionPercentage();
    const totalTasks = taskProvider.getTotalTaskCount();
    const completedTasks = taskProvider.getCompletedTaskCount();

    // Hide badge if no active changes or no tasks
    if (activeChangesCount === 0 || totalTasks === 0) {
        treeView.badge = undefined;
        return;
    }

    // Show completion percentage as badge with detailed tooltip
    treeView.badge = {
        value: completionPercentage,
        tooltip: `${activeChangesCount} active change${activeChangesCount !== 1 ? 's' : ''}, ${completionPercentage}% complete (${completedTasks}/${totalTasks} tasks)`,
    };
}

/**
 * Deactivate the extension
 */
export function deactivate() {
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    if (treeView) {
        treeView.dispose();
    }
    console.log('OpenSpec Tasks extension deactivated');
}
