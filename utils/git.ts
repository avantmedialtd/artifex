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

/**
 * Stage all changes (tracked and untracked) and create a commit.
 *
 * @param message - The commit message
 * @returns Object with success status and optional error message
 */
export function stageAllAndCommit(message: string): { success: boolean; error?: string } {
    try {
        execSync('git add -A', { stdio: 'pipe' });
    } catch {
        return { success: false, error: 'Failed to stage files' };
    }

    if (!createCommit(message)) {
        return { success: false, error: 'Failed to create commit' };
    }

    return { success: true };
}

/**
 * Check if there are any changes to commit.
 *
 * @returns true if there are staged or unstaged changes, false otherwise
 */
export function hasChangesToCommit(): boolean {
    try {
        const status = execSync('git status --porcelain', { stdio: 'pipe' }).toString();
        return status.trim().length > 0;
    } catch {
        return false;
    }
}

/**
 * Stage all changes and create a commit with optional trailers.
 *
 * @param message - The commit message
 * @param trailers - Array of trailer objects with key and value
 * @returns Object with success status and optional error message
 */
export function stageAllAndCommitWithTrailers(
    message: string,
    trailers: Array<{ key: string; value: string }> = [],
): { success: boolean; error?: string } {
    try {
        execSync('git add .', { stdio: 'pipe' });
    } catch {
        return { success: false, error: 'Failed to stage files' };
    }

    // Build commit command with trailers
    const trailerArgs = trailers.map(t => `--trailer "${t.key}: ${t.value}"`).join(' ');
    const commitCmd = trailerArgs
        ? `git commit -m "${message}" ${trailerArgs}`
        : `git commit -m "${message}"`;

    try {
        execSync(commitCmd, { stdio: 'pipe' });
    } catch {
        return { success: false, error: 'Failed to create commit' };
    }

    return { success: true };
}
