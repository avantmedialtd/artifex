import { watch } from 'node:fs';
import { join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { error, colors } from '../utils/output.ts';

interface Task {
    text: string;
    completed: boolean;
    indent: number;
}

interface Section {
    title: string;
    tasks: Task[];
}

interface ChangeTaskData {
    changeId: string;
    sections: Section[];
    totalTasks: number;
    completedTasks: number;
}

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

        if (currentSection) {
            sections.push(currentSection);
        }

        return { sections, totalTasks, completedTasks };
    } catch (_error) {
        return { sections: [], totalTasks: 0, completedTasks: 0 };
    }
}

async function getActiveChanges(): Promise<string[]> {
    try {
        const changesDir = join(process.cwd(), 'openspec', 'changes');
        const entries = await readdir(changesDir, { withFileTypes: true });

        return entries
            .filter(entry => entry.isDirectory() && entry.name !== 'archive')
            .map(entry => entry.name);
    } catch (_error) {
        return [];
    }
}

function displayChange(changeData: ChangeTaskData): void {
    const { changeId, sections, totalTasks, completedTasks } = changeData;

    const progressText = `${completedTasks}/${totalTasks} tasks completed`;
    console.log(
        `${colors.blue}┌─ ${changeId}${colors.reset} ${colors.gray}(${progressText})${colors.reset}`,
    );
    console.log(`${colors.blue}│${colors.reset}`);

    for (const section of sections) {
        if (section.tasks.length === 0) continue;

        console.log(
            `${colors.blue}│${colors.reset}  ${colors.cyan}${section.title}${colors.reset}`,
        );

        for (const task of section.tasks) {
            const checkbox = task.completed
                ? `${colors.green}☑${colors.reset}`
                : `${colors.gray}☐${colors.reset}`;
            const indent = ' '.repeat(task.indent / 4);
            console.log(`${colors.blue}│${colors.reset}  ${indent}${checkbox} ${task.text}`);
        }

        console.log(`${colors.blue}│${colors.reset}`);
    }

    console.log(`${colors.blue}└${'─'.repeat(40)}${colors.reset}`);
    console.log('');
}

async function displayTodos(): Promise<void> {
    // Clear screen and position cursor at top-left
    process.stdout.write('\x1b[2J\x1b[H');

    const changes = await getActiveChanges();

    // Display header with timestamp
    const timestamp = new Date().toLocaleTimeString();
    console.log(
        `${colors.cyan}📋 TODO Items (watching for changes...)${colors.reset} ${colors.gray}Last updated: ${timestamp}${colors.reset}`,
    );
    console.log(`${colors.gray}Press Ctrl+C to exit${colors.reset}\n`);

    if (changes.length === 0) {
        console.log('No active changes found.');
        return;
    }

    for (const changeId of changes) {
        const tasksPath = join(process.cwd(), 'openspec', 'changes', changeId, 'tasks.md');
        const { sections, totalTasks, completedTasks } = await parseTasksFile(tasksPath);

        if (totalTasks === 0) {
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
}

export async function handleWatch(hasArgs: boolean): Promise<number> {
    if (hasArgs) {
        error('Error: watch command does not accept arguments');
        console.error('Usage: zap watch');
        return 1;
    }

    const changesDir = join(process.cwd(), 'openspec', 'changes');

    // Display initial state
    await displayTodos();

    // Set up debouncing
    let debounceTimer: NodeJS.Timeout | null = null;

    // Set up file watcher with recursive option
    const watcher = watch(changesDir, { recursive: true }, (_eventType, filename) => {
        // Ignore changes in archive directory
        if (filename && filename.includes('archive')) {
            return;
        }

        // Debounce: wait 100ms after last change before refreshing
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            displayTodos().catch(err => {
                console.error(`Error refreshing display: ${err}`);
            });
        }, 100);
    });

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
        console.log('\nStopping watch mode...');
        watcher.close();
        process.exit(0);
    });

    // Handle errors
    watcher.on('error', err => {
        error(`File watching error: ${err.message}`);
        console.error('Attempting to continue...');
    });

    // Keep process running
    return new Promise(() => {
        // Never resolves - watch runs until interrupted
    });
}
