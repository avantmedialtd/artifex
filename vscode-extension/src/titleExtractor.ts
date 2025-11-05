import * as fs from 'fs';

/**
 * Extract the proposal title from the first line of a proposal.md file.
 * Strips leading '#', whitespace, and optional "Proposal: " prefix.
 *
 * @param proposalPath - Path to the proposal.md file
 * @returns The extracted title, or null if extraction fails
 */
export function extractProposalTitle(proposalPath: string): string | null {
    try {
        const content = fs.readFileSync(proposalPath, 'utf-8');
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
