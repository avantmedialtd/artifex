import {
    getCurrentHeadCommit,
    hasUncommittedChanges,
    isGitRepository,
    listWorktrees,
    pushWorktree,
    resetWorktree,
} from '../git-worktree.ts';
import { info, success, error } from '../utils/output.ts';

/**
 * Force-pushes all version worktrees (matching /v\d+/ pattern) to their remote repositories.
 *
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleVersionsPush(): Promise<number> {
    try {
        // 1. Validate we're in a git repository
        if (!isGitRepository()) {
            error('Error: Not in a git repository');
            return 1;
        }

        // 2. Enumerate worktrees and filter by /v\d+/ pattern
        const allWorktrees = listWorktrees();
        const versionPattern = /^v\d+$/;
        const matchingWorktrees = allWorktrees.filter(wt => versionPattern.test(wt.branch));

        // Handle case where no matching worktrees are found
        if (matchingWorktrees.length === 0) {
            info('No worktrees with branches matching /v\\d+/ pattern found.');
            return 0;
        }

        // 3. Push each worktree
        for (const worktree of matchingWorktrees) {
            info(`Pushing worktree ${worktree.branch}...`);
            try {
                pushWorktree(worktree.path);
            } catch (err) {
                if (err instanceof Error) {
                    error(err.message);
                } else {
                    error(`Failed to push worktree '${worktree.branch}'`);
                }
                return 1;
            }
        }

        // 4. Display success summary
        const branchNames = matchingWorktrees.map(wt => wt.branch).join(', ');
        success(`Successfully pushed ${matchingWorktrees.length} worktree(s): ${branchNames}`);
        return 0;
    } catch (err) {
        if (err instanceof Error) {
            error(`Error: ${err.message}`);
        } else {
            error('An unexpected error occurred');
        }
        return 1;
    }
}

/**
 * Resets all version worktrees (matching /v\d+/ pattern) to the current branch HEAD.
 *
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleVersionsReset(): Promise<number> {
    try {
        // 1. Validate we're in a git repository
        if (!isGitRepository()) {
            error('Error: Not in a git repository');
            return 1;
        }

        // 2. Get current HEAD commit
        const targetRevision = getCurrentHeadCommit();

        // 3. Enumerate worktrees and filter by /v\d+/ pattern
        const allWorktrees = listWorktrees();
        const versionPattern = /^v\d+$/;
        const matchingWorktrees = allWorktrees.filter(wt => versionPattern.test(wt.branch));

        // Handle case where no matching worktrees are found
        if (matchingWorktrees.length === 0) {
            info('No worktrees with branches matching /v\\d+/ pattern found.');
            return 0;
        }

        // 4. Check each worktree for uncommitted changes
        const worktreesWithChanges: string[] = [];
        for (const worktree of matchingWorktrees) {
            try {
                if (hasUncommittedChanges(worktree.path)) {
                    worktreesWithChanges.push(worktree.branch);
                }
            } catch (err) {
                if (err instanceof Error) {
                    error(err.message);
                } else {
                    error(`Failed to check worktree '${worktree.branch}'`);
                }
                return 1;
            }
        }

        // 5. If any worktree has uncommitted changes, report and exit
        if (worktreesWithChanges.length > 0) {
            error('Error: Cannot reset worktrees with uncommitted changes');
            for (const worktree of matchingWorktrees) {
                if (worktreesWithChanges.includes(worktree.branch)) {
                    console.error(
                        `Worktree '${worktree.branch}' at ${worktree.path} has uncommitted changes`,
                    );
                }
            }
            console.error('\nPlease commit or stash changes and try again.');
            console.error('You can check the status by running: git status');
            return 1;
        }

        // 6. Reset each worktree
        for (const worktree of matchingWorktrees) {
            info(`Resetting worktree ${worktree.branch}...`);
            try {
                resetWorktree(worktree.path, targetRevision);
            } catch (err) {
                if (err instanceof Error) {
                    error(err.message);
                } else {
                    error(`Failed to reset worktree '${worktree.branch}'`);
                }
                return 1;
            }
        }

        // 7. Display success summary
        const branchNames = matchingWorktrees.map(wt => wt.branch).join(', ');
        success(`Successfully reset ${matchingWorktrees.length} worktree(s): ${branchNames}`);
        return 0;
    } catch (err) {
        if (err instanceof Error) {
            error(`Error: ${err.message}`);
        } else {
            error('An unexpected error occurred');
        }
        return 1;
    }
}
