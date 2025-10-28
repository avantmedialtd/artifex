import { execSync } from 'node:child_process';

export interface Worktree {
    path: string;
    branch: string;
}

/**
 * Checks if the current directory is inside a git repository.
 *
 * @returns true if inside a git repository, false otherwise
 */
export function isGitRepository(): boolean {
    try {
        execSync('git rev-parse --git-dir', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Gets the current HEAD commit hash.
 *
 * @returns The current HEAD commit hash
 * @throws Error if unable to get HEAD commit
 */
export function getCurrentHeadCommit(): string {
    try {
        const commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
        return commit;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to get current HEAD commit: ${error.message}`);
        }
        throw new Error('Failed to get current HEAD commit');
    }
}

/**
 * Lists all git worktrees in the repository.
 *
 * Parses the output of `git worktree list --porcelain` to extract
 * worktree paths and their associated branches.
 *
 * @returns Array of worktree objects with path and branch information
 * @throws Error if unable to list worktrees
 */
export function listWorktrees(): Worktree[] {
    try {
        const output = execSync('git worktree list --porcelain', { encoding: 'utf-8' });
        return parseWorktreeList(output);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to list worktrees: ${error.message}`);
        }
        throw new Error('Failed to list worktrees');
    }
}

/**
 * Parses the porcelain output from `git worktree list --porcelain`.
 *
 * The porcelain format outputs each worktree as a block separated by blank lines:
 * worktree <path>
 * HEAD <sha>
 * branch <branch-ref>
 *
 * @param output The raw output from git worktree list --porcelain
 * @returns Array of parsed worktree objects
 */
function parseWorktreeList(output: string): Worktree[] {
    const worktrees: Worktree[] = [];
    const lines = output.trim().split('\n');

    let currentPath: string | null = null;
    let currentBranch: string | null = null;

    for (const line of lines) {
        if (line.startsWith('worktree ')) {
            currentPath = line.substring('worktree '.length);
        } else if (line.startsWith('branch ')) {
            const branchRef = line.substring('branch '.length);
            currentBranch = getWorktreeBranch(branchRef);
        } else if (line === '') {
            // End of worktree block
            if (currentPath && currentBranch) {
                worktrees.push({ path: currentPath, branch: currentBranch });
            }
            currentPath = null;
            currentBranch = null;
        }
    }

    // Handle last worktree if file doesn't end with blank line
    if (currentPath && currentBranch) {
        worktrees.push({ path: currentPath, branch: currentBranch });
    }

    return worktrees;
}

/**
 * Extracts the branch name from a git branch reference.
 *
 * Converts refs/heads/branch-name to branch-name
 *
 * @param branchRef The full branch reference (e.g., "refs/heads/main")
 * @returns The branch name without the refs/heads/ prefix
 */
export function getWorktreeBranch(branchRef: string): string {
    if (branchRef.startsWith('refs/heads/')) {
        return branchRef.substring('refs/heads/'.length);
    }
    return branchRef;
}

/**
 * Checks if a worktree has uncommitted changes.
 *
 * Uses `git status --porcelain` which outputs a blank string when clean,
 * or non-empty output when there are changes.
 *
 * @param worktreePath The path to the worktree to check
 * @returns true if the worktree has uncommitted changes, false if clean
 * @throws Error if unable to check git status
 */
export function hasUncommittedChanges(worktreePath: string): boolean {
    try {
        const output = execSync('git status --porcelain', {
            cwd: worktreePath,
            encoding: 'utf-8',
        });
        return output.trim().length > 0;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(
                `Failed to check git status in worktree '${worktreePath}': ${error.message}`,
            );
        }
        throw new Error(`Failed to check git status in worktree '${worktreePath}'`);
    }
}

/**
 * Resets a worktree to a specific revision using `git reset --hard`.
 *
 * @param worktreePath The path to the worktree to reset
 * @param revision The git revision (commit hash, branch, tag) to reset to
 * @throws Error if the reset operation fails
 */
export function resetWorktree(worktreePath: string, revision: string): void {
    try {
        execSync(`git reset --hard ${revision}`, {
            cwd: worktreePath,
            stdio: 'ignore',
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to reset worktree '${worktreePath}': ${error.message}`);
        }
        throw new Error(`Failed to reset worktree '${worktreePath}'`);
    }
}

/**
 * Force-pushes a worktree to its remote repository.
 *
 * @param worktreePath The path to the worktree to push
 * @throws Error if the push operation fails
 */
export function pushWorktree(worktreePath: string): void {
    try {
        execSync('git push --force', {
            cwd: worktreePath,
            stdio: 'ignore',
        });
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to push worktree '${worktreePath}': ${error.message}`);
        }
        throw new Error(`Failed to push worktree '${worktreePath}'`);
    }
}
