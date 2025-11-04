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

    // Register command to open task location
    const openTaskLocationCommand = vscode.commands.registerCommand(
        'openspecTasks.openTaskLocation',
        async (filePath: string, lineNumber: number) => {
            try {
                const uri = vscode.Uri.file(filePath);
                const document = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(document);

                // Create a range for the target line (0-indexed)
                const line = lineNumber - 1;
                const range = new vscode.Range(line, 0, line, 0);

                // Reveal the line and position cursor at the beginning
                editor.selection = new vscode.Selection(range.start, range.start);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open file: ${error}`);
            }
        },
    );

    context.subscriptions.push(openTaskLocationCommand);

    console.log('OpenSpec Tasks extension initialized successfully');
}

/**
 * Update the badge with count of changes with unchecked tasks.
 * Shows the number of active changes that have at least one unchecked task.
 * Badge is hidden when all changes are complete or there are no active changes.
 */
function updateBadge() {
    if (!treeView || !taskProvider) {
        return;
    }

    const changesWithUncheckedTasks = taskProvider.getActiveChangesWithUncheckedTasks();

    // Hide badge if no changes with unchecked tasks (all complete or no changes)
    if (changesWithUncheckedTasks === 0) {
        treeView.badge = undefined;
        return;
    }

    // Show count of changes with unchecked tasks as badge with detailed tooltip
    treeView.badge = {
        value: changesWithUncheckedTasks,
        tooltip: `${changesWithUncheckedTasks} active change${changesWithUncheckedTasks !== 1 ? 's' : ''} with unchecked tasks`,
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
