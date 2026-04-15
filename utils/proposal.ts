import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function extractProposalTitle(proposalPath: string): string | null {
    try {
        const content = readFileSync(proposalPath, 'utf-8');
        const firstLine = content.split('\n')[0];

        if (!firstLine) {
            return null;
        }

        let title = firstLine.replace(/^#+\s*/, '');
        title = title.replace(/^Proposal:\s*/i, '');
        title = title.trim();

        return title || null;
    } catch {
        return null;
    }
}

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
