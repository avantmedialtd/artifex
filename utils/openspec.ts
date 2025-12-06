import { execSync } from 'node:child_process';

/**
 * Represents an ongoing change from OpenSpec
 */
export interface OngoingChange {
    /** The change ID (e.g., "add-user-auth") */
    id: string;
    /** The task progress status (e.g., "3/8 tasks" or "✓ Complete") */
    status: string;
}

/**
 * Parse the output of `openspec list --changes` to extract ongoing changes.
 *
 * @param output - The raw output from `openspec list --changes`
 * @returns Array of ongoing changes with their IDs and statuses
 */
export function parseOpenspecListOutput(output: string): OngoingChange[] {
    const changes: OngoingChange[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and the "Changes:" header
        if (!trimmed || trimmed === 'Changes:') continue;

        // Parse lines like "  add-user-auth     3/8 tasks" or "  my-change     ✓ Complete"
        // The ID is the first word, status is everything after
        const match = trimmed.match(/^(\S+)\s+(.+)$/);
        if (match) {
            changes.push({
                id: match[1],
                status: match[2].trim(),
            });
        }
    }

    return changes;
}

/**
 * List all ongoing changes from OpenSpec.
 *
 * @returns Array of ongoing changes, or empty array if command fails
 */
export function listOngoingChanges(): OngoingChange[] {
    try {
        const output = execSync('openspec list --changes', { encoding: 'utf-8' });
        return parseOpenspecListOutput(output);
    } catch {
        return [];
    }
}
