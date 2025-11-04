import * as path from 'path';
import * as vscode from 'vscode';
import { getAllChangeData } from './taskParser';
import { ChangeData, Section, Task } from './types';

/**
 * Tree item types for the OpenSpec Tasks view
 */
export type TreeItemType = 'change' | 'section' | 'task';

/**
 * Tree item data that can represent a change, section, or task
 */
export class OpenSpecTaskItem extends vscode.TreeItem {
    constructor(
        public readonly type: TreeItemType,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly data?: ChangeData | Section | Task,
        public readonly parent?: OpenSpecTaskItem,
    ) {
        super(label, collapsibleState);

        // Set icon based on type
        if (type === 'change') {
            this.iconPath = new vscode.ThemeIcon('folder');
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

    private workspaceRoot: string;
    private changeDataCache: ChangeData[] = [];

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
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
     * Get the children of an element
     */
    async getChildren(element?: OpenSpecTaskItem): Promise<OpenSpecTaskItem[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        // Root level: show changes (expanded by default for immediate visibility)
        if (!element) {
            try {
                this.changeDataCache = await getAllChangeData(this.workspaceRoot);

                if (this.changeDataCache.length === 0) {
                    // No changes found
                    return [
                        new OpenSpecTaskItem(
                            'change',
                            'No active changes found',
                            vscode.TreeItemCollapsibleState.None,
                        ),
                    ];
                }

                return this.changeDataCache.map(changeData => {
                    const label = `${changeData.changeId} (${changeData.completedTasks}/${changeData.totalTasks})`;
                    return new OpenSpecTaskItem(
                        'change',
                        label,
                        vscode.TreeItemCollapsibleState.Expanded,
                        changeData,
                    );
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

        // Change level: show sections (expanded by default for immediate visibility)
        if (element.type === 'change') {
            const changeData = element.data as ChangeData;
            return changeData.sections.map(section => {
                return new OpenSpecTaskItem(
                    'section',
                    section.title,
                    vscode.TreeItemCollapsibleState.Expanded,
                    section,
                    element,
                );
            });
        }

        // Section level: show tasks
        if (element.type === 'section') {
            const section = element.data as Section;
            // Get the change ID from the parent element
            const changeElement = element.parent;
            const changeData = changeElement?.data as ChangeData;
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

                // Add command to open task location if line number is available
                if (task.lineNumber && changeId) {
                    const tasksFilePath = path.join(
                        this.workspaceRoot,
                        'openspec',
                        'changes',
                        changeId,
                        'tasks.md',
                    );
                    taskItem.command = {
                        command: 'openspecTasks.openTaskLocation',
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
        if (!this.workspaceRoot) {
            return;
        }

        try {
            this.changeDataCache = await getAllChangeData(this.workspaceRoot);
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
     * Get the count of active changes that have at least one unchecked task
     */
    getActiveChangesWithUncheckedTasks(): number {
        return this.changeDataCache.filter(changeData => {
            const hasUncheckedTasks = changeData.completedTasks < changeData.totalTasks;
            return hasUncheckedTasks;
        }).length;
    }
}
