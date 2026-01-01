import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { error, colors } from '../utils/output.ts';

/**
 * Represents a single task from tasks.md
 */
interface Task {
    text: string;
    completed: boolean;
    indent: number;
}

/**
 * Represents a section in tasks.md (e.g., "Implementation Tasks")
 */
interface Section {
    title: string;
    tasks: Task[];
}

/**
 * Represents all task data for a single change
 */
interface ChangeTaskData {
    changeId: string;
    sections: Section[];
    totalTasks: number;
    completedTasks: number;
}

/**
 * Parse a tasks.md file and extract structured task data.
 *
 * @param filePath - Path to the tasks.md file
 * @returns Parsed task data with sections and completion counts
 */
async function parseTasksFile(filePath: string): Promise<{
    sections: Section[];
    totalTasks: number;
    completedTasks: number;
}> {
    try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        const sections: Section[] = [];
        let currentSection: Section | null = null;
        let totalTasks = 0;
        let completedTasks = 0;

        for (const line of lines) {
            // Match section headers (## Header)
            const sectionMatch = line.match(/^## (.+)$/);
            if (sectionMatch) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: sectionMatch[1].trim(),
                    tasks: [],
                };
                continue;
            }

            // Match task items (- [ ] or - [x])
            const taskMatch = line.match(/^(\s*)- \[([ xX])\] (.+)$/);
            if (taskMatch) {
                const [, indentStr, checkbox, text] = taskMatch;
                const indent = indentStr.length;
                const isCompleted = checkbox.toLowerCase() === 'x';

                const task: Task = {
                    text: text.trim(),
                    completed: isCompleted,
                    indent,
                };

                if (currentSection) {
                    currentSection.tasks.push(task);
                }

                totalTasks++;
                if (isCompleted) {
                    completedTasks++;
                }
            }
        }

        // Push the last section
        if (currentSection) {
            sections.push(currentSection);
        }

        return { sections, totalTasks, completedTasks };
    } catch (_error) {
        // If file doesn't exist or can't be read, return empty data
        return { sections: [], totalTasks: 0, completedTasks: 0 };
    }
}

/**
 * Get all active change directories from openspec/changes/.
 * Excludes the 'archive' directory.
 *
 * @returns Array of change directory names
 */
async function getActiveChanges(): Promise<string[]> {
    try {
        const changesDir = join(process.cwd(), 'openspec', 'changes');
        const entries = await readdir(changesDir, { withFileTypes: true });

        return entries
            .filter(entry => entry.isDirectory() && entry.name !== 'archive')
            .map(entry => entry.name);
    } catch (_error) {
        // Directory doesn't exist or can't be read
        return [];
    }
}

/**
 * Format and display a single change's tasks with visual formatting.
 *
 * @param changeData - The change task data to display
 */
function displayChange(changeData: ChangeTaskData): void {
    const { changeId, sections, totalTasks, completedTasks } = changeData;

    // Display change header with progress
    const progressText = `${completedTasks}/${totalTasks} tasks completed`;
    console.log(
        `${colors.blue}┌─ ${changeId}${colors.reset} ${colors.gray}(${progressText})${colors.reset}`,
    );
    console.log(`${colors.blue}│${colors.reset}`);

    // Display each section and its tasks
    for (const section of sections) {
        if (section.tasks.length === 0) continue;

        console.log(
            `${colors.blue}│${colors.reset}  ${colors.cyan}${section.title}${colors.reset}`,
        );

        for (const task of section.tasks) {
            const checkbox = task.completed
                ? `${colors.green}☑${colors.reset}`
                : `${colors.gray}☐${colors.reset}`;
            const indent = ' '.repeat(task.indent / 4); // Convert spaces to visual indent
            console.log(`${colors.blue}│${colors.reset}  ${indent}${checkbox} ${task.text}`);
        }

        console.log(`${colors.blue}│${colors.reset}`);
    }

    // Display bottom border
    console.log(`${colors.blue}└${'─'.repeat(40)}${colors.reset}`);
    console.log('');
}

/**
 * Handle the 'todo' command.
 * Displays all TODO items from active OpenSpec changes.
 *
 * @param hasArgs - Whether any arguments were provided to the command
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleTodo(hasArgs: boolean): Promise<number> {
    // Reject if arguments were provided
    if (hasArgs) {
        error('Error: todo command does not accept arguments');
        console.error('Usage: af todo');
        return 1;
    }

    // Get all active changes
    const changes = await getActiveChanges();

    if (changes.length === 0) {
        console.log('No active changes found.');
        return 0;
    }

    // Display header
    console.log(`\n${colors.cyan}📋 TODO Items${colors.reset}\n`);

    // Process each change
    for (const changeId of changes) {
        const tasksPath = join(process.cwd(), 'openspec', 'changes', changeId, 'tasks.md');
        const { sections, totalTasks, completedTasks } = await parseTasksFile(tasksPath);

        if (totalTasks === 0) {
            // Skip changes with no tasks
            continue;
        }

        const changeData: ChangeTaskData = {
            changeId,
            sections,
            totalTasks,
            completedTasks,
        };

        displayChange(changeData);
    }

    return 0;
}
