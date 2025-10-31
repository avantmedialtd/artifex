import { readFileSync } from 'node:fs';

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
        const { readdirSync, statSync } = require('node:fs');
        const { join } = require('node:path');

        const entries = readdirSync(changesDir);

        let latestTime = 0;
        let latestId: string | null = null;

        for (const entry of entries) {
            const fullPath = join(changesDir, entry);
            const stats = statSync(fullPath);

            if (stats.isDirectory() && stats.mtimeMs > latestTime) {
                latestTime = stats.mtimeMs;
                latestId = entry;
            }
        }

        return latestId;
    } catch {
        return null;
    }
}
