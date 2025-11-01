import { readdirSync, readFileSync, statSync } from 'node:fs';
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
    console.log(`Extracting proposal title from: ${proposalPath}`);
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
    console.log(`Getting latest change ID from directory: ${changesDir}`);
    try {
        const entries = readdirSync(changesDir);

        console.log('Change entries:', entries);

        let latestTime = 0;
        let latestId: string | null = null;

        for (const entry of entries) {
            console.log('Checking entry:', entry);
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
