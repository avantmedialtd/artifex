/**
 * Represents a single task from tasks.md
 */
export interface Task {
    text: string;
    completed: boolean;
    indent: number;
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
    sections: Section[];
    totalTasks: number;
    completedTasks: number;
}
