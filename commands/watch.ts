import { watch } from 'node:fs';
import { join, basename } from 'node:path';
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

export function getProjectName(): string {
    const cwd = process.cwd();
    const projectName = basename(cwd);
    return projectName || 'root';
}

export interface AggregateMetrics {
    totalChanges: number;
    totalTasks: number;
    completedTasks: number;
}

export function calculateAggregateMetrics(changes: ChangeTaskData[]): AggregateMetrics {
    return {
        totalChanges: changes.length,
        totalTasks: changes.reduce((sum, change) => sum + change.totalTasks, 0),
        completedTasks: changes.reduce((sum, change) => sum + change.completedTasks, 0),
    };
}

export function renderProgressBar(completed: number, total: number): string {
    if (total === 0) {
        return `${colors.gray}${'░'.repeat(20)}${colors.reset} ${colors.gray}N/A${colors.reset}`;
    }

    const percentage = Math.round((completed / total) * 100);
    const barWidth = 20;
    const filledWidth = Math.round((completed / total) * barWidth);

    const filledBar = '█'.repeat(filledWidth);
    const emptyBar = '░'.repeat(barWidth - filledWidth);

    const barColor = percentage === 100 ? colors.green : colors.green;
    const emptyColor = colors.gray;

    return `${barColor}${filledBar}${colors.reset}${emptyColor}${emptyBar}${colors.reset} ${colors.gray}${percentage}%${colors.reset}`;
}

function calculateIdleDuration(lastChangeTime: number): number {
    return Date.now() - lastChangeTime;
}

function formatIdleDuration(durationMs: number): string {
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}

function displayStatusBar(changes: ChangeTaskData[], lastChangeTime: number): void {
    const projectName = getProjectName();
    const metrics = calculateAggregateMetrics(changes);
    const progressBar = renderProgressBar(metrics.completedTasks, metrics.totalTasks);

    const changeText = metrics.totalChanges === 1 ? 'change' : 'changes';
    let statusLine = `Project: ${colors.cyan}${projectName}${colors.reset} ${colors.gray}|${colors.reset} ${colors.gray}${metrics.totalChanges}${colors.reset} ${changeText} ${colors.gray}|${colors.reset} ${colors.gray}${metrics.completedTasks}/${metrics.totalTasks}${colors.reset} tasks ${colors.gray}|${colors.reset} ${progressBar}`;

    // Add idle warning if idle for more than 60 seconds
    const idleDurationMs = calculateIdleDuration(lastChangeTime);
    const idleThresholdMs = 60 * 1000; // 60 seconds
    const idleRedThresholdMs = 30 * 60 * 1000; // 30 minutes

    if (idleDurationMs > idleThresholdMs) {
        const idleDuration = formatIdleDuration(idleDurationMs);
        // Use red color for 30+ minutes, yellow for 60s-30m
        const warningColor = idleDurationMs > idleRedThresholdMs ? colors.red : colors.yellow;
        const idleWarning = ` ${colors.gray}|${colors.reset} ${warningColor}⚠ IDLE for ${idleDuration}${colors.reset}`;
        statusLine += idleWarning;
    }

    const borderLength = 100;
    console.log(`${colors.blue}┌${'─'.repeat(borderLength)}${colors.reset}`);
    console.log(`${colors.blue}│${colors.reset} ${statusLine}`);
    console.log(`${colors.blue}└${'─'.repeat(borderLength)}${colors.reset}`);
}

async function displayTodos(lastChangeTime: number): Promise<void> {
    // Clear screen and position cursor at top-left
    process.stdout.write('\x1b[2J\x1b[H');

    const changes = await getActiveChanges();

    // Display header with timestamp
    const timestamp = new Date(lastChangeTime).toLocaleTimeString();
    console.log(
        `${colors.cyan}📋 TODO Items (watching for changes...)${colors.reset} ${colors.gray}Last change: ${timestamp}${colors.reset}`,
    );
    console.log(`${colors.gray}Press Ctrl+C to exit${colors.reset}\n`);

    if (changes.length === 0) {
        console.log('No active changes found.');
        // Display status bar even with 0 changes
        displayStatusBar([], lastChangeTime);
        return;
    }

    // Collect all change data for status bar
    const allChangesData: ChangeTaskData[] = [];

    for (const changeId of changes) {
        const tasksPath = join(process.cwd(), 'openspec', 'changes', changeId, 'tasks.md');
        const { sections, totalTasks, completedTasks } = await parseTasksFile(tasksPath);

        const changeData: ChangeTaskData = {
            changeId,
            sections,
            totalTasks,
            completedTasks,
        };

        // Add to collection for status bar (even if no tasks)
        allChangesData.push(changeData);

        // Only display if there are tasks
        if (totalTasks > 0) {
            displayChange(changeData);
        }
    }

    // Display status bar at the bottom
    displayStatusBar(allChangesData, lastChangeTime);
}

export async function handleWatch(hasArgs: boolean): Promise<number> {
    if (hasArgs) {
        error('Error: watch command does not accept arguments');
        console.error('Usage: af watch');
        return 1;
    }

    const changesDir = join(process.cwd(), 'openspec', 'changes');

    // Track last change time
    let lastChangeTime = Date.now();

    // Display initial state
    await displayTodos(lastChangeTime);

    // Set up debouncing
    let debounceTimer: NodeJS.Timeout | null = null;

    // Set up periodic refresh timer for idle state
    let periodicRefreshTimer: NodeJS.Timeout | null = null;

    const startPeriodicRefresh = () => {
        // Clear existing timer if any
        if (periodicRefreshTimer) {
            clearInterval(periodicRefreshTimer);
        }

        // Refresh every 10 seconds when idle
        periodicRefreshTimer = setInterval(() => {
            const idleDurationMs = Date.now() - lastChangeTime;
            const idleThresholdMs = 60 * 1000; // 60 seconds

            // Only refresh if we're in idle state
            if (idleDurationMs > idleThresholdMs) {
                displayTodos(lastChangeTime).catch(err => {
                    console.error(`Error refreshing display: ${err}`);
                });
            }
        }, 10000); // 10 seconds
    };

    // Start periodic refresh
    startPeriodicRefresh();

    // Set up file watcher with recursive option
    const watcher = watch(changesDir, { recursive: true }, (_eventType, filename) => {
        // Ignore changes in archive directory
        if (filename && filename.includes('archive')) {
            return;
        }

        // Update last change time
        lastChangeTime = Date.now();

        // Debounce: wait 100ms after last change before refreshing
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
            displayTodos(lastChangeTime).catch(err => {
                console.error(`Error refreshing display: ${err}`);
            });
        }, 100);
    });

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
        console.log('\nStopping watch mode...');
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        if (periodicRefreshTimer) {
            clearInterval(periodicRefreshTimer);
        }
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
