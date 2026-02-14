import * as path from 'path';
import * as vscode from 'vscode';
import { getAllChangeDataFromAllWorkspaces } from './taskParser';
import { ChangeData, Section, Task } from './types';

/**
 * Tree item types for the OpenSpec Tasks view
 */
export type TreeItemType = 'change' | 'artifact' | 'section' | 'task';

/**
 * Data attached to an artifact tree item
 */
export interface ArtifactItemData {
    artifactId: 'proposal' | 'specs' | 'design' | 'tasks';
    present: boolean;
    changeData: ChangeData;
}

/**
 * Tree item data that can represent a change, artifact, section, or task
 */
export class OpenSpecTaskItem extends vscode.TreeItem {
    constructor(
        public readonly type: TreeItemType,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly data?: ChangeData | ArtifactItemData | Section | Task,
        public readonly parent?: OpenSpecTaskItem,
    ) {
        super(label, collapsibleState);

        // Set icon based on type
        if (type === 'change') {
            this.iconPath = new vscode.ThemeIcon('folder');
        } else if (type === 'artifact') {
            const artifact = data as ArtifactItemData;
            this.iconPath = artifact.present
                ? new vscode.ThemeIcon('check')
                : new vscode.ThemeIcon('circle-outline');
        } else if (type === 'section') {
            this.iconPath = new vscode.ThemeIcon('list-flat');
        } else if (type === 'task') {
            const task = data as Task;
            this.iconPath = task.completed
                ? new vscode.ThemeIcon('check')
                : new vscode.ThemeIcon('circle-outline');
        }

        // Set context value for potential commands
        this.contextValue = type;
    }
}

/**
 * TreeDataProvider for OpenSpec tasks
 */
export class OpenSpecTaskProvider implements vscode.TreeDataProvider<OpenSpecTaskItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<OpenSpecTaskItem | undefined | null | void> =
        new vscode.EventEmitter<OpenSpecTaskItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<OpenSpecTaskItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private changeDataCache: ChangeData[] = [];
    private isMultiRoot: boolean = false;

    constructor() {
        // No longer need workspace root - we scan all workspaces
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get the TreeItem representation of an element
     */
    getTreeItem(element: OpenSpecTaskItem): vscode.TreeItem {
        return element;
    }

    /**
     * Check if a section has all tasks completed
     */
    private isSectionFullyCompleted(section: Section): boolean {
        // Empty sections are not considered "fully completed"
        if (section.tasks.length === 0) {
            return false;
        }

        // Check if all tasks are completed
        return section.tasks.every(task => task.completed);
    }

    /**
     * Resolve the ChangeData for an element by walking up the parent chain.
     */
    private getChangeDataFromElement(element: OpenSpecTaskItem): ChangeData | undefined {
        let current: OpenSpecTaskItem | undefined = element;
        while (current) {
            if (current.type === 'change') {
                return current.data as ChangeData;
            }
            if (current.type === 'artifact') {
                return (current.data as ArtifactItemData).changeData;
            }
            current = current.parent;
        }
        return undefined;
    }

    /**
     * Get the children of an element
     */
    async getChildren(element?: OpenSpecTaskItem): Promise<OpenSpecTaskItem[]> {
        // Root level: show changes
        if (!element) {
            try {
                this.changeDataCache = await getAllChangeDataFromAllWorkspaces();

                const uniqueFolders = new Set(this.changeDataCache.map(c => c.workspaceFolder.uri));
                this.isMultiRoot = uniqueFolders.size > 1;

                if (this.changeDataCache.length === 0) {
                    return [
                        new OpenSpecTaskItem(
                            'change',
                            'No active changes found',
                            vscode.TreeItemCollapsibleState.None,
                        ),
                    ];
                }

                return this.changeDataCache.map(changeData => {
                    // Format: "Title (change-id)" or just "change-id"
                    let label: string;
                    if (changeData.title) {
                        label = `${changeData.title} (${changeData.changeId})`;
                    } else {
                        label = changeData.changeId;
                    }

                    if (this.isMultiRoot) {
                        label = `[${changeData.workspaceFolder.name}] ${label}`;
                    }

                    const item = new OpenSpecTaskItem(
                        'change',
                        label,
                        vscode.TreeItemCollapsibleState.Expanded,
                        changeData,
                    );

                    // Set context value to encode completion status and title presence
                    const isComplete =
                        changeData.artifacts.tasks &&
                        changeData.totalTasks > 0 &&
                        changeData.completedTasks === changeData.totalTasks;
                    const hasTitle = Boolean(changeData.title);
                    const completionPart = isComplete ? 'complete' : 'incomplete';
                    const titlePart = hasTitle ? '-with-title' : '';
                    item.contextValue = `change-${completionPart}${titlePart}`;

                    return item;
                });
            } catch (error) {
                console.error('Error loading changes:', error);
                return [
                    new OpenSpecTaskItem(
                        'change',
                        'Error loading changes',
                        vscode.TreeItemCollapsibleState.None,
                    ),
                ];
            }
        }

        // Change level: show four artifact nodes in fixed order
        if (element.type === 'change') {
            const changeData = element.data as ChangeData;
            const changeDir = path.join(
                changeData.workspaceFolder.uri,
                'openspec',
                'changes',
                changeData.changeId,
            );

            const artifactDefs: {
                id: ArtifactItemData['artifactId'];
                label: string;
                present: boolean;
                expandable: boolean;
            }[] = [
                {
                    id: 'proposal',
                    label: 'Proposal',
                    present: changeData.artifacts.proposal,
                    expandable: false,
                },
                {
                    id: 'specs',
                    label: 'Specs',
                    present: changeData.artifacts.specs.length > 0,
                    expandable: changeData.artifacts.specs.length > 0,
                },
                {
                    id: 'design',
                    label: 'Design',
                    present: changeData.artifacts.design,
                    expandable: false,
                },
                {
                    id: 'tasks',
                    label: changeData.artifacts.tasks
                        ? `Tasks (${changeData.completedTasks}/${changeData.totalTasks})`
                        : 'Tasks',
                    present: changeData.artifacts.tasks,
                    expandable: changeData.artifacts.tasks && changeData.sections.length > 0,
                },
            ];

            return artifactDefs.map(def => {
                const collapsibleState = def.expandable
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.None;

                const artifactData: ArtifactItemData = {
                    artifactId: def.id,
                    present: def.present,
                    changeData,
                };

                const item = new OpenSpecTaskItem(
                    'artifact',
                    def.label,
                    collapsibleState,
                    artifactData,
                    element,
                );

                item.contextValue = `artifact-${def.id}`;

                // Set click command for present artifacts (leaf nodes only)
                if (def.present && !def.expandable) {
                    const filePath =
                        def.id === 'proposal'
                            ? path.join(changeDir, 'proposal.md')
                            : path.join(changeDir, 'design.md');
                    item.command = {
                        command: 'openspec.openTaskLocation',
                        title: 'Open File',
                        arguments: [filePath, 1],
                    };
                }

                return item;
            });
        }

        // Artifact level: show children based on artifact type
        if (element.type === 'artifact') {
            const artifactData = element.data as ArtifactItemData;
            const changeData = artifactData.changeData;
            const changeDir = path.join(
                changeData.workspaceFolder.uri,
                'openspec',
                'changes',
                changeData.changeId,
            );

            // Specs artifact: show capability children
            if (artifactData.artifactId === 'specs') {
                return changeData.artifacts.specs.map(capName => {
                    const specPath = path.join(changeDir, 'specs', capName, 'spec.md');
                    const item = new OpenSpecTaskItem(
                        'section',
                        capName,
                        vscode.TreeItemCollapsibleState.None,
                        undefined,
                        element,
                    );
                    item.iconPath = new vscode.ThemeIcon('file');
                    item.command = {
                        command: 'openspec.openTaskLocation',
                        title: 'Open Spec',
                        arguments: [specPath, 1],
                    };
                    item.contextValue = 'spec-file';
                    return item;
                });
            }

            // Tasks artifact: show sections → tasks (preserve existing drill-down)
            if (artifactData.artifactId === 'tasks') {
                const config = vscode.workspace.getConfiguration('openspec');
                const autoCollapseCompletedSections = config.get<boolean>(
                    'autoCollapseCompletedSections',
                    false,
                );

                return changeData.sections.map(section => {
                    let collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                    if (autoCollapseCompletedSections && this.isSectionFullyCompleted(section)) {
                        collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                    }

                    return new OpenSpecTaskItem(
                        'section',
                        section.title,
                        collapsibleState,
                        section,
                        element,
                    );
                });
            }

            return [];
        }

        // Section level: show tasks
        if (element.type === 'section') {
            const section = element.data as Section;
            if (!section || !section.tasks) {
                return [];
            }

            const changeData = this.getChangeDataFromElement(element);
            const changeId = changeData?.changeId;

            return section.tasks.map(task => {
                const icon = task.completed ? '☑' : '☐';
                const label = `${icon} ${task.text}`;
                const taskItem = new OpenSpecTaskItem(
                    'task',
                    label,
                    vscode.TreeItemCollapsibleState.None,
                    task,
                    element,
                );

                if (task.lineNumber && changeId && changeData?.workspaceFolder) {
                    const tasksFilePath = path.join(
                        changeData.workspaceFolder.uri,
                        'openspec',
                        'changes',
                        changeId,
                        'tasks.md',
                    );
                    taskItem.command = {
                        command: 'openspec.openTaskLocation',
                        title: 'Open Task Location',
                        arguments: [tasksFilePath, task.lineNumber],
                    };
                }

                return taskItem;
            });
        }

        return [];
    }

    /**
     * Load data without refreshing the tree view
     */
    async loadData(): Promise<void> {
        try {
            this.changeDataCache = await getAllChangeDataFromAllWorkspaces();

            // Update multi-root status
            const uniqueFolders = new Set(this.changeDataCache.map(c => c.workspaceFolder.uri));
            this.isMultiRoot = uniqueFolders.size > 1;
        } catch (error) {
            console.error('Error loading change data:', error);
        }
    }

    /**
     * Get the total number of unchecked tasks across all changes
     */
    getUncheckedTaskCount(): number {
        return this.changeDataCache.reduce((sum, changeData) => {
            return sum + (changeData.totalTasks - changeData.completedTasks);
        }, 0);
    }

    /**
     * Get the number of active changes (changes with at least one task)
     */
    getActiveChangesCount(): number {
        return this.changeDataCache.filter(changeData => changeData.totalTasks > 0).length;
    }

    /**
     * Calculate the completion percentage across all active changes.
     * Returns a value from 0-100 representing the percentage of completed tasks.
     * Returns 0 if there are no tasks.
     */
    getCompletionPercentage(): number {
        const totalTasks = this.getTotalTaskCount();

        if (totalTasks === 0) {
            return 0;
        }

        const completedTasks = this.getCompletedTaskCount();

        return Math.round((completedTasks / totalTasks) * 100);
    }

    /**
     * Get the total number of tasks across all changes
     */
    getTotalTaskCount(): number {
        return this.changeDataCache.reduce((sum, changeData) => sum + changeData.totalTasks, 0);
    }

    /**
     * Get the total number of completed tasks across all changes
     */
    getCompletedTaskCount(): number {
        return this.changeDataCache.reduce((sum, changeData) => sum + changeData.completedTasks, 0);
    }

    /**
     * Get the count of active changes that are unfinished.
     * A change is unfinished if tasks.md is absent, has no tasks, or has unchecked tasks.
     */
    getActiveChangesWithUncheckedTasks(): number {
        return this.changeDataCache.filter(changeData => {
            if (!changeData.artifacts.tasks) {
                return true; // No tasks.md = unfinished
            }
            if (changeData.totalTasks === 0) {
                return true; // Empty tasks.md = unfinished
            }
            return changeData.completedTasks < changeData.totalTasks;
        }).length;
    }
}
