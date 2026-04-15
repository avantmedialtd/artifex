import { execSync } from 'node:child_process';

/**
 * Stage files in a specific directory for git commit.
 *
 * @param directory - The directory path to stage (relative to repo root)
 * @returns true if staging succeeds, false otherwise
 */
export function stageDirectory(directory: string): boolean {
    try {
        console.log(`git add "${directory}"`);
        execSync(`git add "${directory}"`, { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Create a git commit with the specified message.
 *
 * @param message - The commit message
 * @returns true if commit succeeds, false otherwise
 */
export function createCommit(message: string): boolean {
    try {
        execSync(`git commit -m "${message}"`, { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Stage files and create a commit.
 *
 * @param directory - The directory to stage
 * @param message - The commit message
 * @returns Object with success status and optional error message
 */
export function stageAndCommit(
    directory: string,
    message: string,
): { success: boolean; error?: string } {
    if (!stageDirectory(directory)) {
        return { success: false, error: 'Failed to stage files' };
    }

    if (!createCommit(message)) {
        return { success: false, error: 'Failed to create commit' };
    }

    return { success: true };
}
