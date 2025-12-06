import * as path from 'path';
import * as vscode from 'vscode';
import { OpenSpecTaskProvider } from './taskProvider';

let treeView: vscode.TreeView<any> | undefined;
let taskProvider: OpenSpecTaskProvider | undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined;
let proposalWatcher: vscode.FileSystemWatcher | undefined;
let directoryWatcher: vscode.FileSystemWatcher | undefined;

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

    // Set up file watcher for proposal.md files to refresh when titles change
    const proposalPattern = new vscode.RelativePattern(
        workspaceRoot,
        'openspec/changes/**/proposal.md',
    );
    proposalWatcher = vscode.workspace.createFileSystemWatcher(proposalPattern);

    proposalWatcher.onDidChange(debouncedRefresh);
    proposalWatcher.onDidCreate(debouncedRefresh);
    proposalWatcher.onDidDelete(debouncedRefresh);

    context.subscriptions.push(proposalWatcher);

    // Set up directory watcher for openspec/changes to detect when change directories are added/removed
    const directoryPattern = new vscode.RelativePattern(workspaceRoot, 'openspec/changes/*');
    directoryWatcher = vscode.workspace.createFileSystemWatcher(directoryPattern);

    directoryWatcher.onDidCreate(debouncedRefresh);
    directoryWatcher.onDidDelete(debouncedRefresh);

    context.subscriptions.push(directoryWatcher);

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

    // Register command to open proposal.md file for a change
    const openProposalCommand = vscode.commands.registerCommand(
        'openspecTasks.openProposal',
        async (changeId: string) => {
            try {
                const proposalPath = path.join(
                    workspaceRoot,
                    'openspec',
                    'changes',
                    changeId,
                    'proposal.md',
                );
                const uri = vscode.Uri.file(proposalPath);
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to open proposal.md: The proposal file was not found for change "${changeId}"`,
                );
            }
        },
    );

    context.subscriptions.push(openProposalCommand);

    // Register command to copy title (from context menu)
    const copyTitleCommand = vscode.commands.registerCommand(
        'openspecTasks.copyTitle',
        async (item: any) => {
            try {
                // Extract title from the tree item's data
                const title = item?.data?.title;
                if (!title) {
                    vscode.window.showErrorMessage('Could not determine title');
                    return;
                }
                await vscode.env.clipboard.writeText(title);
                vscode.window.showInformationMessage(`Copied: "${title}"`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to copy title: ${error}`);
            }
        },
    );

    context.subscriptions.push(copyTitleCommand);

    // Register command to copy change ID
    const copyChangeIdCommand = vscode.commands.registerCommand(
        'openspecTasks.copyChangeId',
        async (item: any) => {
            try {
                // Extract changeId from the tree item's data
                const changeId = item?.data?.changeId;
                if (!changeId) {
                    vscode.window.showErrorMessage('Could not determine change ID');
                    return;
                }
                await vscode.env.clipboard.writeText(changeId);
                vscode.window.showInformationMessage(`Copied change ID: "${changeId}"`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to copy change ID: ${error}`);
            }
        },
    );

    context.subscriptions.push(copyChangeIdCommand);

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
    if (proposalWatcher) {
        proposalWatcher.dispose();
    }
    if (directoryWatcher) {
        directoryWatcher.dispose();
    }
    if (treeView) {
        treeView.dispose();
    }
    console.log('OpenSpec Tasks extension deactivated');
}
