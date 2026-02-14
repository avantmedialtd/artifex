import * as path from 'path';
import * as vscode from 'vscode';
import { OpenSpecTaskProvider } from './taskProvider';
import { ChangeData } from './types';
import { getWorkspaceFoldersWithOpenSpec } from './taskParser';

let treeView: vscode.TreeView<any> | undefined;
let taskProvider: OpenSpecTaskProvider | undefined;

// Map of workspace folder URI to its watchers
const workspaceFolderWatchers: Map<
    string,
    {
        fileWatcher: vscode.FileSystemWatcher;
        proposalWatcher: vscode.FileSystemWatcher;
        designWatcher: vscode.FileSystemWatcher;
        specsWatcher: vscode.FileSystemWatcher;
        directoryWatcher: vscode.FileSystemWatcher;
    }
> = new Map();

/**
 * Activate the extension
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('OpenSpec extension is now active');

    // Check if any workspace folder has OpenSpec changes
    const foldersWithOpenSpec = await getWorkspaceFoldersWithOpenSpec();

    if (foldersWithOpenSpec.length === 0) {
        console.log('No openspec/changes directory found in any workspace folder');
        return;
    }

    // Initialize the extension (no longer needs a specific workspace root)
    initializeExtension(context);

    // Set up watchers for each workspace folder with OpenSpec
    for (const folderRef of foldersWithOpenSpec) {
        setupWatchersForFolder(context, folderRef.uri);
    }

    // Subscribe to workspace folder changes to handle dynamic additions/removals
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async event => {
            // Handle added folders
            for (const added of event.added) {
                const changesDir = path.join(added.uri.fsPath, 'openspec', 'changes');
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(changesDir));
                    setupWatchersForFolder(context, added.uri.fsPath);
                    taskProvider?.refresh();
                } catch {
                    // No OpenSpec in this folder
                }
            }

            // Handle removed folders
            for (const removed of event.removed) {
                disposeWatchersForFolder(removed.uri.fsPath);
                taskProvider?.refresh();
            }
        }),
    );
}

/**
 * Initialize the extension components
 */
function initializeExtension(context: vscode.ExtensionContext) {
    // Create task provider (no longer needs workspace root - scans all workspaces)
    taskProvider = new OpenSpecTaskProvider();

    // Register tree view
    treeView = vscode.window.createTreeView('openspecChanges', {
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

    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand('openspec.refresh', () => {
        if (taskProvider) {
            taskProvider.refresh();
            updateBadge();
        }
    });

    context.subscriptions.push(refreshCommand);

    // Register command to open task location
    const openTaskLocationCommand = vscode.commands.registerCommand(
        'openspec.openTaskLocation',
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

    // Register command to open proposal.md file for a change.
    // Accepts ChangeData directly or a tree item with ChangeData in its data field.
    const openProposalCommand = vscode.commands.registerCommand(
        'openspec.openProposal',
        async (arg: any) => {
            try {
                // Resolve ChangeData from argument (could be ChangeData or a tree item)
                const changeData: ChangeData | undefined =
                    arg?.changeId && arg?.workspaceFolder
                        ? arg
                        : arg?.data?.changeId && arg?.data?.workspaceFolder
                          ? arg.data
                          : arg?.data?.changeData;

                if (!changeData) {
                    vscode.window.showErrorMessage(
                        'Could not determine change for opening proposal',
                    );
                    return;
                }

                const proposalPath = path.join(
                    changeData.workspaceFolder.uri,
                    'openspec',
                    'changes',
                    changeData.changeId,
                    'proposal.md',
                );
                const uri = vscode.Uri.file(proposalPath);
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to open proposal.md: The proposal file was not found`,
                );
            }
        },
    );

    context.subscriptions.push(openProposalCommand);

    // Register command to copy title (from context menu)
    const copyTitleCommand = vscode.commands.registerCommand(
        'openspec.copyTitle',
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
        'openspec.copyChangeId',
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

    console.log('OpenSpec extension initialized successfully');
}

/**
 * Set up file watchers for a specific workspace folder
 */
function setupWatchersForFolder(context: vscode.ExtensionContext, workspaceFolderUri: string) {
    // Check if watchers already exist for this folder
    if (workspaceFolderWatchers.has(workspaceFolderUri)) {
        return;
    }

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

    // Set up file watcher for tasks.md files
    const tasksPattern = new vscode.RelativePattern(
        workspaceFolderUri,
        'openspec/changes/**/tasks.md',
    );
    const fileWatcher = vscode.workspace.createFileSystemWatcher(tasksPattern);
    fileWatcher.onDidChange(debouncedRefresh);
    fileWatcher.onDidCreate(debouncedRefresh);
    fileWatcher.onDidDelete(debouncedRefresh);
    context.subscriptions.push(fileWatcher);

    // Set up file watcher for proposal.md files
    const proposalPattern = new vscode.RelativePattern(
        workspaceFolderUri,
        'openspec/changes/**/proposal.md',
    );
    const proposalWatcher = vscode.workspace.createFileSystemWatcher(proposalPattern);
    proposalWatcher.onDidChange(debouncedRefresh);
    proposalWatcher.onDidCreate(debouncedRefresh);
    proposalWatcher.onDidDelete(debouncedRefresh);
    context.subscriptions.push(proposalWatcher);

    // Set up file watcher for design.md files
    const designPattern = new vscode.RelativePattern(
        workspaceFolderUri,
        'openspec/changes/**/design.md',
    );
    const designWatcher = vscode.workspace.createFileSystemWatcher(designPattern);
    designWatcher.onDidChange(debouncedRefresh);
    designWatcher.onDidCreate(debouncedRefresh);
    designWatcher.onDidDelete(debouncedRefresh);
    context.subscriptions.push(designWatcher);

    // Set up file watcher for spec files
    const specsPattern = new vscode.RelativePattern(
        workspaceFolderUri,
        'openspec/changes/**/specs/**/*.md',
    );
    const specsWatcher = vscode.workspace.createFileSystemWatcher(specsPattern);
    specsWatcher.onDidChange(debouncedRefresh);
    specsWatcher.onDidCreate(debouncedRefresh);
    specsWatcher.onDidDelete(debouncedRefresh);
    context.subscriptions.push(specsWatcher);

    // Set up directory watcher for openspec/changes
    const directoryPattern = new vscode.RelativePattern(workspaceFolderUri, 'openspec/changes/*');
    const directoryWatcher = vscode.workspace.createFileSystemWatcher(directoryPattern);
    directoryWatcher.onDidCreate(debouncedRefresh);
    directoryWatcher.onDidDelete(debouncedRefresh);
    context.subscriptions.push(directoryWatcher);

    // Store watchers for this folder
    workspaceFolderWatchers.set(workspaceFolderUri, {
        fileWatcher,
        proposalWatcher,
        designWatcher,
        specsWatcher,
        directoryWatcher,
    });
}

/**
 * Dispose watchers for a specific workspace folder
 */
function disposeWatchersForFolder(workspaceFolderUri: string) {
    const watchers = workspaceFolderWatchers.get(workspaceFolderUri);
    if (watchers) {
        watchers.fileWatcher.dispose();
        watchers.proposalWatcher.dispose();
        watchers.designWatcher.dispose();
        watchers.specsWatcher.dispose();
        watchers.directoryWatcher.dispose();
        workspaceFolderWatchers.delete(workspaceFolderUri);
    }
}

/**
 * Update the badge with count of unfinished changes.
 * A change is unfinished if tasks.md is absent, empty, or has unchecked tasks.
 * Badge is hidden when all changes are finished or there are no active changes.
 */
function updateBadge() {
    if (!treeView || !taskProvider) {
        return;
    }

    const unfinishedChanges = taskProvider.getActiveChangesWithUncheckedTasks();

    if (unfinishedChanges === 0) {
        treeView.badge = undefined;
        return;
    }

    treeView.badge = {
        value: unfinishedChanges,
        tooltip: `${unfinishedChanges} unfinished change${unfinishedChanges !== 1 ? 's' : ''}`,
    };
}

/**
 * Deactivate the extension
 */
export function deactivate() {
    // Dispose all workspace folder watchers
    for (const [, watchers] of workspaceFolderWatchers) {
        watchers.fileWatcher.dispose();
        watchers.proposalWatcher.dispose();
        watchers.designWatcher.dispose();
        watchers.specsWatcher.dispose();
        watchers.directoryWatcher.dispose();
    }
    workspaceFolderWatchers.clear();

    if (treeView) {
        treeView.dispose();
    }
    console.log('OpenSpec extension deactivated');
}
