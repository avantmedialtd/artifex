import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { error, info, success } from '../utils/output.ts';

/**
 * Check if we're in a git repository.
 *
 * @returns true if in a git repository, false otherwise
 */
export function isGitRepository(): boolean {
    try {
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the root directory of the current git repository.
 *
 * @returns The absolute path to the git root, or null if not in a repo
 */
export function getGitRoot(): string | null {
    try {
        return execSync('git rev-parse --show-toplevel', { stdio: 'pipe' }).toString().trim();
    } catch {
        return null;
    }
}

/**
 * Check if a worktree already exists at the given path.
 *
 * @param path - The path to check
 * @returns true if a directory exists at the path
 */
export function worktreeExists(path: string): boolean {
    return existsSync(path);
}

/**
 * Parse .git/info/exclude file and return patterns.
 * Filters out comments and empty lines.
 *
 * @param gitRoot - The root of the git repository
 * @returns Array of exclude patterns
 */
export function parseGitInfoExclude(gitRoot: string): string[] {
    const excludePath = join(gitRoot, '.git', 'info', 'exclude');

    if (!existsSync(excludePath)) {
        return [];
    }

    try {
        const content = readFileSync(excludePath, 'utf-8');
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));
    } catch {
        return [];
    }
}

/**
 * Find files matching patterns in .git/info/exclude using git ls-files.
 * Uses git's native pattern matching to avoid reimplementing gitignore logic.
 *
 * @param gitRoot - The root of the git repository
 * @returns Array of file paths that are excluded
 */
export function findExcludedFiles(gitRoot: string): string[] {
    const excludePath = join(gitRoot, '.git', 'info', 'exclude');

    if (!existsSync(excludePath)) {
        return [];
    }

    try {
        // Use git ls-files to find files matching exclude patterns
        const result = execSync(`git ls-files --others --ignored --exclude-from="${excludePath}"`, {
            cwd: gitRoot,
            stdio: 'pipe',
        });
        const files = result.toString().trim().split('\n').filter(Boolean);
        return files;
    } catch {
        return [];
    }
}

/**
 * Get the list of files to copy to the new worktree.
 * Includes .env, .env.local, and files matching .git/info/exclude patterns.
 *
 * @param gitRoot - The root of the git repository
 * @returns Array of file paths to copy
 */
export function getFilesToCopy(gitRoot: string): string[] {
    const files: string[] = [];

    // Add .env files if they exist
    const envFiles = ['.env', '.env.local'];
    for (const envFile of envFiles) {
        const envPath = join(gitRoot, envFile);
        if (existsSync(envPath)) {
            files.push(envFile);
        }
    }

    // Add files from .git/info/exclude
    const excludedFiles = findExcludedFiles(gitRoot);
    files.push(...excludedFiles);

    // Remove duplicates
    return [...new Set(files)];
}

/**
 * Copy a file to the worktree, creating parent directories if needed.
 *
 * @param sourceRoot - The source git root directory
 * @param targetRoot - The target worktree directory
 * @param relativePath - The relative path of the file to copy
 * @returns true if copy succeeded, false otherwise
 */
export function copyFileToWorktree(
    sourceRoot: string,
    targetRoot: string,
    relativePath: string,
): boolean {
    const sourcePath = join(sourceRoot, relativePath);
    const targetPath = join(targetRoot, relativePath);

    try {
        // Create parent directories if needed
        const targetDir = dirname(targetPath);
        if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
        }

        copyFileSync(sourcePath, targetPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Create a git worktree at the specified path.
 *
 * @param name - The name of the worktree (used for branch name and directory)
 * @param detach - If true, create with detached HEAD instead of new branch
 * @returns Object with success status and optional error message
 */
export function createWorktree(
    name: string,
    detach: boolean = false,
): { success: boolean; error?: string; path?: string } {
    const gitRoot = getGitRoot();
    if (!gitRoot) {
        return { success: false, error: 'Not in a git repository' };
    }

    // Calculate target path as sibling directory
    const parentDir = dirname(gitRoot);
    const targetPath = resolve(parentDir, name);

    // Check if target already exists
    if (worktreeExists(targetPath)) {
        return { success: false, error: `Directory already exists: ${targetPath}` };
    }

    // Build git worktree add command
    const args = detach
        ? ['worktree', 'add', '--detach', targetPath]
        : ['worktree', 'add', '-b', name, targetPath];

    const result = spawnSync('git', args, { cwd: gitRoot, stdio: 'pipe' });

    if (result.status !== 0) {
        const stderr = result.stderr?.toString().trim() || 'Unknown error';
        return { success: false, error: stderr };
    }

    return { success: true, path: targetPath };
}

/**
 * Handle the 'worktree new <name>' command.
 * Creates a new git worktree as a sibling directory and copies env files.
 *
 * @param name - The name for the worktree (also used as branch name)
 * @param detach - If true, create with detached HEAD instead of new branch
 * @returns Exit code (0 for success, 1 for error)
 */
export function handleWorktreeNew(name: string | undefined, detach: boolean = false): number {
    // Validate name is provided
    if (!name || name.trim() === '') {
        error('Error: worktree new requires a name');
        console.error('Usage: af worktree new <name> [--detach]');
        return 1;
    }

    // Check if in a git repository
    if (!isGitRepository()) {
        error('Error: Not in a git repository');
        return 1;
    }

    const gitRoot = getGitRoot();
    if (!gitRoot) {
        error('Error: Could not determine git root');
        return 1;
    }

    // Create the worktree
    info(`Creating worktree '${name}'${detach ? ' (detached)' : ' with new branch'}...`);
    const result = createWorktree(name, detach);

    if (!result.success) {
        error(`Error: ${result.error}`);
        return 1;
    }

    const targetPath = result.path!;
    success(`Worktree created at ${targetPath}`);

    // Copy files
    const filesToCopy = getFilesToCopy(gitRoot);
    if (filesToCopy.length > 0) {
        info(`Copying ${filesToCopy.length} file(s)...`);
        let copied = 0;
        for (const file of filesToCopy) {
            if (copyFileToWorktree(gitRoot, targetPath, file)) {
                copied++;
            }
        }
        success(`Copied ${copied} file(s)`);
    }

    return 0;
}

/**
 * Handle the 'worktree' command routing.
 *
 * @param args - Command arguments after 'worktree'
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleWorktree(args: string[]): Promise<number> {
    const [subcommand, ...restArgs] = args;

    if (subcommand === 'new') {
        // Parse arguments
        const detach = restArgs.includes('--detach');
        const name = restArgs.find(arg => !arg.startsWith('--'));
        return handleWorktreeNew(name, detach);
    }

    if (!subcommand) {
        error('Error: worktree command requires a subcommand');
        console.error("Run 'af help worktree' for more information.");
        return 1;
    }

    error(`Error: Unknown worktree subcommand: ${subcommand}`);
    console.error("Run 'af help worktree' for available subcommands.");
    return 1;
}
