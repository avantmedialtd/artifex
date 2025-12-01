import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { error as logError } from './output.ts';

/**
 * Extract the proposal title from the first line of a proposal.md file.
 * Strips leading '#', whitespace, and optional "Proposal: " prefix.
 *
 * @param proposalPath - Path to the proposal.md file
 * @returns The extracted title, or null if extraction fails
 */
export function extractProposalTitle(proposalPath: string): string | null {
    try {
        const content = readFileSync(proposalPath, 'utf-8');
        const firstLine = content.split('\n')[0];

        if (!firstLine) {
            return null;
        }

        // Remove leading '#' and whitespace
        let title = firstLine.replace(/^#+\s*/, '');

        // Remove "Proposal: " prefix if present (case-insensitive)
        title = title.replace(/^Proposal:\s*/i, '');

        // Trim any remaining whitespace
        title = title.trim();

        return title || null;
    } catch {
        return null;
    }
}

/**
 * Get the most recently created change directory in openspec/changes.
 * This is useful for determining which proposal was just created.
 *
 * @param changesDir - Optional path to changes directory (defaults to 'openspec/changes')
 * @returns The change ID of the most recent change, or null if none found
 */
export function getLatestChangeId(changesDir: string = 'openspec/changes'): string | null {
    try {
        const entries = readdirSync(changesDir);

        let latestTime = 0;
        let latestId: string | null = null;

        for (const entry of entries) {
            if (entry === 'archive') {
                continue;
            }

            const fullPath = join(changesDir, entry);
            const stats = statSync(fullPath);

            if (stats.isDirectory() && stats.mtimeMs > latestTime) {
                latestTime = stats.mtimeMs;
                latestId = entry;
            }
        }

        return latestId;
    } catch (error) {
        logError(`Error getting latest change ID: ${error}`);
        return null;
    }
}

/**
 * Represents an active change with its title and task progress.
 */
export interface ActiveChange {
    id: string;
    title: string | null;
    completedTasks: number;
    totalTasks: number;
}

/**
 * Parse a tasks.md file and count completed and total tasks.
 * Tasks are markdown checkbox lines: `- [ ]` (uncompleted) or `- [x]` (completed).
 *
 * @param tasksPath - Path to the tasks.md file
 * @returns Object with completed and total task counts
 */
function countTasks(tasksPath: string): { completed: number; total: number } {
    try {
        const content = readFileSync(tasksPath, 'utf-8');
        const lines = content.split('\n');

        let completed = 0;
        let total = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
                completed++;
                total++;
            } else if (trimmed.startsWith('- [ ]')) {
                total++;
            }
        }

        return { completed, total };
    } catch {
        return { completed: 0, total: 0 };
    }
}

/**
 * Get all active changes with their titles and task progress.
 *
 * @param changesDir - Optional path to changes directory (defaults to 'openspec/changes')
 * @returns Array of active changes sorted alphabetically by ID
 */
export function getActiveChanges(changesDir: string = 'openspec/changes'): ActiveChange[] {
    try {
        if (!existsSync(changesDir)) {
            return [];
        }

        const entries = readdirSync(changesDir);
        const changes: ActiveChange[] = [];

        for (const entry of entries) {
            if (entry === 'archive') {
                continue;
            }

            const fullPath = join(changesDir, entry);
            const stats = statSync(fullPath);

            if (!stats.isDirectory()) {
                continue;
            }

            const proposalPath = join(fullPath, 'proposal.md');
            const tasksPath = join(fullPath, 'tasks.md');

            const title = extractProposalTitle(proposalPath);
            const { completed, total } = countTasks(tasksPath);

            changes.push({
                id: entry,
                title,
                completedTasks: completed,
                totalTasks: total,
            });
        }

        // Sort alphabetically by ID
        changes.sort((a, b) => a.id.localeCompare(b.id));

        return changes;
    } catch {
        return [];
    }
}
