/**
 * Represents a single task from tasks.md
 */
export interface Task {
    text: string;
    completed: boolean;
    indent: number;
    lineNumber?: number;
}

/**
 * Represents a section in tasks.md (e.g., "Implementation Tasks")
 */
export interface Section {
    title: string;
    tasks: Task[];
}

/**
 * Represents all task data for a single change
 */
export interface ChangeData {
    changeId: string;
    title?: string;
    sections: Section[];
    totalTasks: number;
    completedTasks: number;
    /** The workspace folder this change belongs to */
    workspaceFolder: WorkspaceFolderRef;
}

/**
 * Reference to a workspace folder
 */
export interface WorkspaceFolderRef {
    /** The workspace folder URI path */
    uri: string;
    /** The workspace folder name */
    name: string;
    /** The workspace folder index (for ordering) */
    index: number;
}
